import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { useCreditCards } from '@/hooks/useCreditCards';
import { CreditCardVisual } from '@/components/credit-cards/CreditCardVisual';
import { CreditCardDialog } from '@/components/credit-cards/CreditCardDialog';
import { CreditCardInvoiceDrawer } from '@/components/credit-cards/CreditCardInvoiceDrawer';
import { useLocale } from '@/i18n/useLocale';
import { CreditCard as CreditCardType } from '@/types/creditCards';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard as CreditCardIcon, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExtendedCreditCard extends CreditCardType {
  current_invoice_amount: number;
  available_limit: number;
  current_invoice_month?: string;
  total_liability: number;
}

export default function CreditCardsPage() {
  const { user, householdId, loading: authLoading } = useAuth();
  const { t } = useLocale();
  const { creditCards, isLoading, createCreditCard, updateCreditCard, deleteCreditCard } = useCreditCards();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardType | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<CreditCardType | null>(null);
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(null);
  const [checkingTransactions, setCheckingTransactions] = useState(false);
  
  // Invoice drawer state
  const [invoiceDrawerOpen, setInvoiceDrawerOpen] = useState(false);
  const [selectedCardForInvoices, setSelectedCardForInvoices] = useState<ExtendedCreditCard | null>(null);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleOpenNew = () => {
    setEditingCard(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (card: CreditCardType) => {
    setEditingCard(card);
    setIsDialogOpen(true);
  };

  const handleDelete = async (card: CreditCardType) => {
    // Check if there are linked transactions before allowing deletion
    setCheckingTransactions(true);
    setDeleteBlockedReason(null);
    
    try {
      const { count, error } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('credit_card_id', card.id)
        .is('cancelled_at', null);
      
      if (error) throw error;
      
      if (count && count > 0) {
        setDeleteBlockedReason(t('creditCards.deleteBlocked', { count }));
      }
      
      setCardToDelete(card);
      setDeleteConfirmOpen(true);
    } catch (error) {
      console.error('Error checking transactions:', error);
      toast.error(t('common.error'));
    } finally {
      setCheckingTransactions(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (cardToDelete && !deleteBlockedReason) {
      await deleteCreditCard.mutateAsync(cardToDelete.id);
      setDeleteConfirmOpen(false);
      setCardToDelete(null);
      setDeleteBlockedReason(null);
    }
  };

  const handleViewInvoices = (card: ExtendedCreditCard) => {
    setSelectedCardForInvoices(card);
    setInvoiceDrawerOpen(true);
  };

  const handleSubmit = async (data: {
    name: string;
    limit_amount: number;
    closing_day: number;
    due_day: number;
    color: string;
    brand?: string | null;
  }) => {
    if (editingCard) {
      await updateCreditCard.mutateAsync({ id: editingCard.id, ...data });
    } else {
      await createCreditCard.mutateAsync(data);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader
          title={t('creditCards.pageTitle')}
          description={t('creditCards.pageDescription')}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-52 min-h-[200px] rounded-2xl" />
          <Skeleton className="h-52 min-h-[200px] rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={t('creditCards.pageTitle')}
        description={t('creditCards.pageDescription')}
        actions={
          // Mobile: Hide header button (user relies on Bottom FAB)
          // Desktop: Show action button
          <Button onClick={handleOpenNew} className="hidden sm:flex">
            <Plus className="mr-2 h-4 w-4" />
            {t('creditCards.new')}
          </Button>
        }
      />

      {creditCards.length === 0 ? (
        <EmptyState
          icon={CreditCardIcon}
          title={t('creditCards.empty.title')}
          description={t('creditCards.empty.description')}
          actionLabel={t('creditCards.new')}
          onAction={handleOpenNew}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {creditCards.map(card => {
            const extCard = card as ExtendedCreditCard;
            return (
              <div key={card.id} className="min-h-[200px] overflow-hidden">
                <CreditCardVisual
                  id={card.id}
                  name={card.name}
                  brand={card.brand}
                  color={card.color}
                  limitAmount={Number(card.limit_amount)}
                  availableLimit={extCard.available_limit}
                  closingDay={card.closing_day}
                  dueDay={card.due_day}
                  invoiceMonth={extCard.current_invoice_month}
                  currentInvoiceAmount={extCard.current_invoice_amount}
                  totalLiability={extCard.total_liability}
                  onEdit={() => handleEdit(card)}
                  onDelete={() => handleDelete(card)}
                  onViewInvoices={() => handleViewInvoices(extCard)}
                  className="h-full"
                />
              </div>
            );
          })}
        </div>
      )}

      <CreditCardDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingCard={editingCard}
        onSubmit={handleSubmit}
        isPending={createCreditCard.isPending || updateCreditCard.isPending}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => {
        setDeleteConfirmOpen(open);
        if (!open) {
          setDeleteBlockedReason(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('creditCards.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlockedReason ? (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{deleteBlockedReason}</AlertDescription>
                </Alert>
              ) : (
                t('creditCards.deleteConfirm.description', { name: cardToDelete?.name })
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            {!deleteBlockedReason && (
              <AlertDialogAction 
                onClick={handleConfirmDelete}
                disabled={checkingTransactions || deleteCreditCard.isPending}
              >
                {(checkingTransactions || deleteCreditCard.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t('common.delete')}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice Drawer */}
      {selectedCardForInvoices && (
        <CreditCardInvoiceDrawer
          open={invoiceDrawerOpen}
          onOpenChange={setInvoiceDrawerOpen}
          cardId={selectedCardForInvoices.id}
          cardName={selectedCardForInvoices.name}
          cardColor={selectedCardForInvoices.color}
          closingDay={selectedCardForInvoices.closing_day}
          limitAmount={Number(selectedCardForInvoices.limit_amount)}
        />
      )}
    </AppLayout>
  );
}
