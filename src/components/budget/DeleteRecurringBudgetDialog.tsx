import { useState, useMemo } from 'react';
import { useLocale } from '@/i18n/useLocale';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Trash2, Loader2, Circle } from 'lucide-react';
import { RecurringBudget } from '@/types/finance';
import { format } from 'date-fns';

type CutoffOption = 'current' | 'selected' | 'all';

interface DeleteRecurringBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurringBudget: RecurringBudget | null;
  selectedMonth: Date;
  categoryName: string;
  subcategoryName?: string | null;
  onConfirm: (recurringId: string, fromMonth: string) => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteRecurringBudgetDialog({
  open,
  onOpenChange,
  recurringBudget,
  selectedMonth,
  categoryName,
  subcategoryName,
  onConfirm,
  isDeleting = false,
}: DeleteRecurringBudgetDialogProps) {
  const { t, formatCurrency } = useLocale();
  const [cutoffOption, setCutoffOption] = useState<CutoffOption>('current');

  const currentMonth = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const selectedMonthStr = useMemo(() => format(selectedMonth, 'yyyy-MM'), [selectedMonth]);

  // Compute the cutoff month based on selected option
  const getCutoffMonth = (): string => {
    switch (cutoffOption) {
      case 'current':
        return currentMonth;
      case 'selected':
        return selectedMonthStr;
      case 'all':
        return 'all';
      default:
        return currentMonth;
    }
  };

  const handleConfirm = async () => {
    if (!recurringBudget) return;
    const fromMonth = getCutoffMonth();
    await onConfirm(recurringBudget.id, fromMonth);
  };

  if (!recurringBudget) return null;

  const displayName = subcategoryName 
    ? `${categoryName} → ${subcategoryName}` 
    : categoryName;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('budget.recurring.delete.title')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            {t('budget.recurring.delete.desc')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Impact list */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Circle className="h-2 w-2 fill-current shrink-0 mt-1.5" />
                {t('budget.recurring.delete.b1')}
              </li>
              <li className="flex items-start gap-2">
                <Circle className="h-2 w-2 fill-warning shrink-0 mt-1.5" />
                <span className="text-warning">{t('budget.recurring.delete.b2')}</span>
              </li>
              <li className="flex items-start gap-2">
                <Circle className="h-2 w-2 fill-destructive shrink-0 mt-1.5" />
                <span className="text-destructive">{t('budget.recurring.delete.b3')}</span>
              </li>
            </ul>
          </div>

          {/* Cutoff selection */}
          <div className="space-y-3">
            <Label>{t('budget.recurring.deleteFromLabel')}</Label>
            <RadioGroup
              value={cutoffOption}
              onValueChange={(v) => setCutoffOption(v as CutoffOption)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="current" id="cutoff-current" />
                <Label htmlFor="cutoff-current" className="font-normal cursor-pointer">
                  {t('budget.recurring.deleteFromCurrentMonth')} ({currentMonth})
                </Label>
              </div>
              {selectedMonthStr !== currentMonth && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="cutoff-selected" />
                  <Label htmlFor="cutoff-selected" className="font-normal cursor-pointer">
                    {t('budget.recurring.deleteFromSelectedMonth')} ({selectedMonthStr})
                  </Label>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="cutoff-all" />
                <Label htmlFor="cutoff-all" className="font-normal cursor-pointer">
                  {t('budget.recurring.deleteFromAllMonths')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Budget name reminder */}
          <p className="text-sm text-muted-foreground">
            {displayName} • {formatCurrency(recurringBudget.amount)}/{t('budget.recurring.perMonth')}
          </p>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isDeleting}>
            {t('budget.recurring.delete.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="confirm-delete-recurring-budget"
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {t('budget.recurring.delete.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
