import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, Calculator, Calendar } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';

interface InstallmentFieldsProps {
  isInstallment: boolean;
  onIsInstallmentChange: (checked: boolean) => void;
  installmentCount: number;
  onInstallmentCountChange: (count: number) => void;
  totalAmount: number;
  dueDate: string;
  onDueDateChange: (date: string) => void;
  disabled?: boolean;
}

export function InstallmentFields({
  isInstallment,
  onIsInstallmentChange,
  installmentCount,
  onInstallmentCountChange,
  totalAmount,
  dueDate,
  onDueDateChange,
  disabled = false,
}: InstallmentFieldsProps) {
  const { t, formatCurrency } = useLocale();
  const installmentAmount = installmentCount > 0 ? totalAmount / installmentCount : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="is-installment"
          checked={isInstallment}
          onCheckedChange={(checked) => onIsInstallmentChange(checked === true)}
          disabled={disabled}
        />
        <Label 
          htmlFor="is-installment" 
          className="cursor-pointer flex items-center gap-2 text-sm font-medium"
        >
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          {t('transactions.installments.purchase')}
        </Label>
      </div>

      {isInstallment && (
        <div className="space-y-3 pl-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="installment-count">
                {t('transactions.installments.countLabel')}<span className="text-destructive">*</span>
              </Label>
              <Input
                id="installment-count"
                type="number"
                min={2}
                max={24}
                value={installmentCount || ''}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 2 && value <= 24) {
                    onInstallmentCountChange(value);
                  } else if (e.target.value === '') {
                    onInstallmentCountChange(0);
                  }
                }}
                placeholder={t('transactions.installments.countPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="installment-due-date">
                {t('transactions.dueDate')}<span className="text-destructive">*</span>
              </Label>
              <Input
                id="installment-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => onDueDateChange(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {totalAmount > 0 && installmentCount >= 2 && (
            <Alert className="bg-primary/5 border-primary/20">
              <Calculator className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                <div className="font-medium text-foreground">
                  {t('transactions.installments.total')}: {formatCurrency(totalAmount)}
                </div>
                <div className="text-muted-foreground">
                  {installmentCount}x {t('transactions.installments.of')} {formatCurrency(installmentAmount)}
                </div>
                {dueDate && (
                  <div className="text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    {t('transactions.installments.allPendingNote')}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
