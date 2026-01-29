import { useState } from 'react';
import { CreditCard as CreditCardIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreditCards } from '@/hooks/useCreditCards';
import { CreditCardVisual } from './CreditCardVisual';
import { CreditCardDialog } from './CreditCardDialog';
import { CreditCardInvoiceDrawer } from './CreditCardInvoiceDrawer';
import { useLocale } from '@/i18n/useLocale';
import { CreditCard } from '@/types/creditCards';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface ExtendedCreditCard extends CreditCard {
  current_invoice_amount: number;
  available_limit: number;
  current_invoice_month?: string;
  total_liability: number;
}

export function CreditCardsSection() {
  const { t } = useLocale();
  const { creditCards, isLoading, createCreditCard, updateCreditCard, deleteCreditCard } = useCreditCards();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);
  
  // Invoice drawer state
  const [invoiceDrawerOpen, setInvoiceDrawerOpen] = useState(false);
  const [selectedCardForInvoices, setSelectedCardForInvoices] = useState<ExtendedCreditCard | null>(null);

  const handleOpenNew = () => {
    setEditingCard(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (card: CreditCard) => {
    setEditingCard(card);
    setIsDialogOpen(true);
  };

  const handleDelete = (card: CreditCard) => {
    setCardToDelete(card);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (cardToDelete) {
      await deleteCreditCard.mutateAsync(cardToDelete.id);
      setDeleteConfirmOpen(false);
      setCardToDelete(null);
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CreditCardIcon className="h-5 w-5" />
            {t('creditCards.myCards')}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CreditCardIcon className="h-5 w-5" />
          {t('creditCards.myCards')}
        </h2>
        <Button onClick={handleOpenNew} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('creditCards.new')}
        </Button>
      </div>

      {creditCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CreditCardIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">{t('creditCards.empty.title')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('creditCards.empty.description')}</p>
          <Button onClick={handleOpenNew}>
            <Plus className="mr-2 h-4 w-4" />
            {t('creditCards.new')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {creditCards.map(card => {
            const extCard = card as ExtendedCreditCard;
            return (
              <div key={card.id} className="group">
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('creditCards.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('creditCards.deleteConfirm.description', { name: cardToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              {t('common.delete')}
            </AlertDialogAction>
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
    </div>
  );
}
