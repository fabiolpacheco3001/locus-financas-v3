import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Transaction } from '@/types/finance';
import { CreditCard, Calendar } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { useLocale } from '@/i18n/useLocale';

interface InstallmentSimulationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onSimulate: (installmentCount: number) => void;
}

export function InstallmentSimulationDialog({
  open,
  onOpenChange,
  transaction,
  onSimulate,
}: InstallmentSimulationDialogProps) {
  const [installmentCount, setInstallmentCount] = useState(2);
  const { t, formatCurrency, formatDateLong, dateLocale } = useLocale();

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setInstallmentCount(2);
    }
    onOpenChange(isOpen);
  };

  const handleSimulate = () => {
    onSimulate(installmentCount);
    onOpenChange(false);
  };

  if (!transaction) return null;

  const totalAmount = Number(transaction.amount);
  const installmentAmount = totalAmount / installmentCount;
  const baseDueDate = transaction.due_date || transaction.date;

  // Generate preview of installment dates
  const installmentPreview = Array.from({ length: installmentCount }, (_, i) => {
    const dueDate = addMonths(new Date(baseDueDate + 'T12:00:00'), i);
    return {
      number: i + 1,
      dueDate: format(dueDate, "MMM/yy", { locale: dateLocale }),
      amount: installmentAmount,
    };
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{t('simulation.installment.title')}</DialogTitle>
              <DialogDescription className="mt-1">
                {t('simulation.installment.description')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Original expense info */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-sm font-medium">{transaction.description || t('transactions.kind.expense')}</p>
            <p className="text-lg font-semibold text-destructive">
              {formatCurrency(totalAmount)}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {t('simulation.installment.dueDate')}: {formatDateLong(new Date(baseDueDate + 'T12:00:00'))}
            </p>
          </div>

          {/* Installment count slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('simulation.installment.numberOfInstallments')}</Label>
              <span className="text-lg font-bold text-primary">{installmentCount}x</span>
            </div>
            <Slider
              value={[installmentCount]}
              onValueChange={([value]) => setInstallmentCount(value)}
              min={2}
              max={12}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>2x</span>
              <span>12x</span>
            </div>
          </div>

          {/* Installment amount */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('simulation.installment.amountPerInstallment')}</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(installmentAmount)}
              </span>
            </div>
          </div>

          {/* Preview of installments */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('simulation.installment.installmentPreview')}</Label>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {installmentPreview.map((inst) => (
                <div 
                  key={inst.number} 
                  className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/30"
                >
                  <span className="text-muted-foreground">
                    {inst.number}/{installmentCount} • {inst.dueDate}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(inst.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSimulate}>
            <CreditCard className="h-4 w-4 mr-2" />
            {t('simulation.installment.start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
