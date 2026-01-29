import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useLocale } from '@/i18n/useLocale';
import { toast } from 'sonner';
import { Search, AlertTriangle, Check, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

interface PendingTransaction {
  id: string;
  description: string | null;
  amount: number;
  date: string;
  due_date: string | null;
  status: string;
  kind: string;
  category?: { name: string } | null;
  account?: { name: string } | null;
}

export function PendingTransactionsAudit() {
  const { householdId, member } = useAuth();
  const { t, formatCurrency } = useLocale();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

  // Query ALL pending expenses (no date filter)
  const { data: pendingTransactions = [], isLoading, refetch } = useQuery({
    queryKey: ['audit-pending-transactions', householdId],
    queryFn: async () => {
      if (!householdId) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          description,
          amount,
          date,
          due_date,
          status,
          kind,
          category:categories(name),
          account:accounts!account_id(name)
        `)
        .eq('household_id', householdId)
        .eq('kind', 'EXPENSE')
        .eq('status', 'planned')
        .is('cancelled_at', null)
        .order('due_date', { ascending: true, nullsFirst: true });

      if (error) throw error;
      return data as PendingTransaction[];
    },
    enabled: !!householdId && isExpanded,
  });

  // Mutation to mark as paid (confirmed)
  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: member?.id || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-projections'] });
      queryClient.invalidateQueries({ queryKey: ['audit-pending-transactions'] });
      toast.success(t('audit.markedAsPaid'));
    },
    onError: () => {
      toast.error(t('common.error'));
    },
  });

  // Mutation to cancel (soft delete)
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: member?.id || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-projections'] });
      queryClient.invalidateQueries({ queryKey: ['audit-pending-transactions'] });
      toast.success(t('audit.transactionCancelled'));
    },
    onError: () => {
      toast.error(t('common.error'));
    },
  });

  const totalPending = pendingTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

  const formatDateSafe = (dateStr: string | null, label: string) => {
    if (!dateStr) return <span className="text-muted-foreground italic">{t('audit.noDate')}</span>;
    try {
      const date = parseISO(dateStr);
      const today = new Date();
      const daysDiff = differenceInDays(today, date);
      
      // Highlight old dates (more than 30 days in the past)
      if (daysDiff > 30) {
        return (
          <span className="text-destructive font-medium">
            {format(date, 'dd/MM/yyyy')}
            <Badge variant="destructive" className="ml-1 text-xs">
              -{daysDiff}d
            </Badge>
          </span>
        );
      }
      // Highlight future dates
      if (daysDiff < 0) {
        return (
          <span className="text-primary">
            {format(date, 'dd/MM/yyyy')}
            <Badge variant="secondary" className="ml-1 text-xs">
              +{Math.abs(daysDiff)}d
            </Badge>
          </span>
        );
      }
      return format(date, 'dd/MM/yyyy');
    } catch {
      return <span className="text-muted-foreground italic">{t('audit.invalidDate')}</span>;
    }
  };

  return (
    <Card className="bg-warning/5 border-warning/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-warning" />
            <CardTitle className="text-lg text-warning">
              🕵️‍♂️ {t('audit.title')}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-1"
          >
            {isExpanded ? (
              <>
                {t('common.collapse')} <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                {t('common.expand')} <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      <CardDescription className="text-warning/70">
        {t('audit.description')}
      </CardDescription>
    </CardHeader>

    {isExpanded && (
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-warning" />
            </div>
          ) : pendingTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Check className="h-8 w-8 mb-2 text-success" />
              <p>{t('audit.noPendingTransactions')}</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="mb-4 flex items-center justify-between rounded-lg bg-warning/10 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <span className="text-sm font-medium">
                    {t('audit.found', { count: pendingTransactions.length })}
                  </span>
                </div>
                <span className="text-lg font-bold text-warning">
                  {formatCurrency(totalPending)}
                </span>
              </div>

              {/* Table */}
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('transactions.description')}</TableHead>
                      <TableHead>{t('transactions.amount')}</TableHead>
                      <TableHead>{t('audit.originalDate')}</TableHead>
                      <TableHead>{t('transactions.dueDate')}</TableHead>
                      <TableHead>{t('transactions.status')}</TableHead>
                      <TableHead className="text-right">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {tx.description || tx.category?.name || t('common.noDescription')}
                            </span>
                            {tx.account && (
                              <span className="text-xs text-muted-foreground">
                                {tx.account.name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-medium text-destructive">
                          -{formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell>{formatDateSafe(tx.date, 'date')}</TableCell>
                        <TableCell>{formatDateSafe(tx.due_date, 'due_date')}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Mark as Paid */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => confirmMutation.mutate(tx.id)}
                              disabled={confirmMutation.isPending || cancelMutation.isPending}
                              className="h-7 px-2 text-success hover:text-success hover:bg-success/10"
                              title={t('audit.markAsPaid')}
                            >
                              <Check className="h-4 w-4" />
                            </Button>

                            {/* Delete/Cancel */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={confirmMutation.isPending || cancelMutation.isPending}
                                  className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title={t('audit.cancel')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('audit.confirmCancel')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('audit.confirmCancelDescription', {
                                      description: tx.description || tx.category?.name || '',
                                      amount: formatCurrency(tx.amount),
                                    })}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => cancelMutation.mutate(tx.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {t('audit.confirmDelete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Refresh Button */}
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  {t('common.refresh')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
