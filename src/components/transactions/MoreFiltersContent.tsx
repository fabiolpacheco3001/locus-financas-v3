import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TransactionKind, TransactionStatus } from '@/types/finance';
import { PaymentMethod } from '@/types/creditCards';
import { useLocale } from '@/i18n/useLocale';

interface MoreFiltersContentProps {
  draftFilterKind: TransactionKind | undefined;
  setDraftFilterKind: (kind: TransactionKind | undefined) => void;
  draftFilterStatus: TransactionStatus | 'all';
  setDraftFilterStatus: (status: TransactionStatus | 'all') => void;
  draftFilterPaymentMethod: PaymentMethod | undefined;
  setDraftFilterPaymentMethod: (method: PaymentMethod | undefined) => void;
  showCancelled: boolean;
}

export function MoreFiltersContent({
  draftFilterKind,
  setDraftFilterKind,
  draftFilterStatus,
  setDraftFilterStatus,
  draftFilterPaymentMethod,
  setDraftFilterPaymentMethod,
  showCancelled,
}: MoreFiltersContentProps) {
  const { t } = useLocale();

  return (
    <div className="space-y-3" data-testid="more-filters-content">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {t('transactions.type')}
        </label>
        <Select 
          value={draftFilterKind ?? "all"} 
          onValueChange={(v) => setDraftFilterKind(v === "all" ? undefined : v as TransactionKind)}
        >
          <SelectTrigger className="w-full" data-testid="filter-kind-select">
            <SelectValue placeholder={t('transactions.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="INCOME">{t('transactions.kind.income')}</SelectItem>
            <SelectItem value="EXPENSE">{t('transactions.kind.expense')}</SelectItem>
            <SelectItem value="TRANSFER">{t('transactions.kind.transfer')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {t('transactions.status')}
        </label>
        <Select 
          value={draftFilterStatus} 
          onValueChange={(v) => setDraftFilterStatus(v as TransactionStatus | 'all')}
        >
          <SelectTrigger className="w-full" data-testid="filter-status-select">
            <SelectValue placeholder={t('transactions.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="confirmed">{t('transactions.statusLabels.confirmed')}</SelectItem>
            <SelectItem value="planned">{t('transactions.statusLabels.planned')}</SelectItem>
            {showCancelled && (
              <SelectItem value="cancelled">{t('transactions.statusLabels.cancelled')}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {t('creditCards.paymentMethod.label')}
        </label>
        <Select 
          value={draftFilterPaymentMethod ?? "all"} 
          onValueChange={(v) => setDraftFilterPaymentMethod(v === "all" ? undefined : v as PaymentMethod)}
        >
          <SelectTrigger className="w-full" data-testid="filter-payment-method-select">
            <SelectValue placeholder={t('creditCards.paymentMethod.label')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="credit_card">{t('creditCards.paymentMethod.credit_card')}</SelectItem>
            <SelectItem value="debit">{t('creditCards.paymentMethod.debit')}</SelectItem>
            <SelectItem value="pix">{t('creditCards.paymentMethod.pix')}</SelectItem>
            <SelectItem value="cash">{t('creditCards.paymentMethod.cash')}</SelectItem>
            <SelectItem value="boleto">{t('creditCards.paymentMethod.boleto')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
