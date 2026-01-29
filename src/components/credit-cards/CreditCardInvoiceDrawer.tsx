import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard as CreditCardIcon, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface InvoiceBreakdown {
  month: string; // YYYY-MM
  amount: number;
  status: 'closed' | 'open' | 'future';
  transactions: Array<{
    id: string;
    description: string | null;
    amount: number;
    date: string;
    category_name?: string;
  }>;
}

interface CreditCardInvoiceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  cardName: string;
  cardColor: string;
  closingDay: number;
  limitAmount: number;
}

export function CreditCardInvoiceDrawer({
  open,
  onOpenChange,
  cardId,
  cardName,
  cardColor,
  closingDay,
  limitAmount,
}: CreditCardInvoiceDrawerProps) {
  const { formatCurrency } = useLocale();
  const { householdId } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalLiability, setTotalLiability] = useState(0);

  useEffect(() => {
    if (open && cardId && householdId) {
      fetchAllInvoices();
    }
  }, [open, cardId, householdId]);

  const fetchAllInvoices = async () => {
    setIsLoading(true);
    try {
      // Fetch ALL transactions for this card (no month filter)
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          id,
          amount,
          description,
          date,
          invoice_month,
          status,
          category:categories(name)
        `)
        .eq('household_id', householdId!)
        .eq('credit_card_id', cardId)
        .in('status', ['planned', 'confirmed'])
        .is('cancelled_at', null)
        .not('invoice_month', 'is', null)
        .order('invoice_month', { ascending: false });

      if (error) throw error;

      // Group by invoice month
      const byMonth: Record<string, InvoiceBreakdown['transactions']> = {};
      transactions?.forEach(tx => {
        const month = tx.invoice_month as string;
        if (!byMonth[month]) byMonth[month] = [];
        byMonth[month].push({
          id: tx.id,
          description: tx.description,
          amount: Number(tx.amount),
          date: tx.date,
          category_name: (tx.category as { name?: string } | null)?.name,
        });
      });

      // Determine status for each month
      const today = new Date();
      const currentMonth = format(today, 'yyyy-MM');
      
      // Calculate the "open" invoice month based on closing day
      const dayOfMonth = today.getDate();
      let openInvoiceMonth: string;
      if (dayOfMonth >= closingDay) {
        // After closing, purchases go to NEXT month's invoice
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        openInvoiceMonth = format(nextMonth, 'yyyy-MM');
      } else {
        openInvoiceMonth = currentMonth;
      }

      const invoiceList: InvoiceBreakdown[] = Object.entries(byMonth)
        .map(([month, txs]) => {
          let status: 'closed' | 'open' | 'future';
          if (month < openInvoiceMonth) {
            status = 'closed';
          } else if (month === openInvoiceMonth) {
            status = 'open';
          } else {
            status = 'future';
          }

          return {
            month,
            amount: txs.reduce((sum, tx) => sum + tx.amount, 0),
            status,
            transactions: txs.sort((a, b) => b.date.localeCompare(a.date)),
          };
        })
        .sort((a, b) => b.month.localeCompare(a.month));

      setInvoices(invoiceList);
      
      // Total liability = sum of all non-future invoices (closed + open)
      const liability = invoiceList
        .filter(inv => inv.status !== 'future')
        .reduce((sum, inv) => sum + inv.amount, 0);
      setTotalLiability(liability);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatInvoiceMonth = (month: string) => {
    const date = parseISO(`${month}-01`);
    return format(date, "MMMM 'de' yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: InvoiceBreakdown['status']) => {
    switch (status) {
      case 'closed':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Fechada
          </Badge>
        );
      case 'open':
        return (
          <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-600">
            <Clock className="h-3 w-3" />
            Aberta
          </Badge>
        );
      case 'future':
        return (
          <Badge variant="outline" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Futura
          </Badge>
        );
    }
  };

  const usagePercentage = limitAmount > 0 ? (totalLiability / limitAmount) * 100 : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="space-y-4">
          <SheetTitle className="flex items-center gap-2">
            <CreditCardIcon className="h-5 w-5" style={{ color: cardColor }} />
            {cardName} - Faturas
          </SheetTitle>
          
          {/* Total Liability Summary */}
          <div 
            className="rounded-xl p-4 space-y-3"
            style={{ backgroundColor: `${cardColor}15` }}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total a Pagar</span>
              <span className={cn(
                "text-2xl font-bold",
                usagePercentage > 100 ? "text-destructive" : usagePercentage > 80 ? "text-amber-500" : "text-foreground"
              )}>
                {formatCurrency(totalLiability)}
              </span>
            </div>
            
            {/* Usage bar */}
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    usagePercentage > 100 ? 'bg-destructive' : usagePercentage > 80 ? 'bg-amber-400' : 'bg-emerald-400'
                  )}
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{usagePercentage.toFixed(0)}% do limite</span>
                <span>Limite: {formatCurrency(limitAmount)}</span>
              </div>
            </div>
            
            {usagePercentage > 100 && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Limite estourado!
              </div>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-280px)] mt-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma fatura encontrada
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {invoices.map(invoice => (
                <AccordionItem 
                  key={invoice.month} 
                  value={invoice.month}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-1 items-center justify-between pr-4">
                      <div className="flex items-center gap-3">
                        <span className="font-medium capitalize">
                          {formatInvoiceMonth(invoice.month)}
                        </span>
                        {getStatusBadge(invoice.status)}
                      </div>
                      <span className={cn(
                        "font-semibold",
                        invoice.status === 'closed' ? "text-destructive" : ""
                      )}>
                        {formatCurrency(invoice.amount)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {invoice.transactions.map(tx => (
                        <div 
                          key={tx.id}
                          className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {tx.description || 'Sem descrição'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(tx.date), 'dd/MM/yyyy')} 
                              {tx.category_name && ` • ${tx.category_name}`}
                            </p>
                          </div>
                          <span className="text-sm font-medium ml-4">
                            {formatCurrency(tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
