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
import { Input } from '@/components/ui/input';
import { Transaction } from '@/types/finance';
import { CalendarClock } from 'lucide-react';
import { format, addMonths, startOfMonth } from 'date-fns';
import { useLocale } from '@/i18n/useLocale';

interface PostponementSimulationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onSimulate: (newDueDate: string) => void;
}

export function PostponementSimulationDialog({
  open,
  onOpenChange,
  transaction,
  onSimulate,
}: PostponementSimulationDialogProps) {
  const [newDueDate, setNewDueDate] = useState('');
  const { t, formatCurrency, formatDateLong, dateLocale } = useLocale();

  // Set default to next month when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && transaction) {
      const currentDueDate = transaction.due_date || transaction.date;
      // Parse date-only string safely (no timezone shift)
      const [y, m, d] = currentDueDate.split('-').map(Number);
      const nextMonth = addMonths(new Date(y, m - 1, d), 1);
      setNewDueDate(format(startOfMonth(nextMonth), 'yyyy-MM-dd'));
    }
    onOpenChange(isOpen);
  };

  const handleSimulate = () => {
    if (newDueDate) {
      onSimulate(newDueDate);
      onOpenChange(false);
    }
  };

  if (!transaction) return null;

  const currentDueDate = transaction.due_date || transaction.date;
  const formattedCurrentDate = formatDateLong(currentDueDate);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{t('simulation.postponement.title')}</DialogTitle>
              <DialogDescription className="mt-1">
                {t('simulation.postponement.description')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-sm font-medium">{transaction.description || t('transactions.kind.expense')}</p>
            <p className="text-sm text-muted-foreground">
              {t('simulation.postponement.currentDueDate')}: {formattedCurrentDate}
            </p>
            <p className="text-lg font-semibold text-destructive">
              {formatCurrency(Number(transaction.amount))}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newDueDate">{t('simulation.postponement.newDueDate')}</Label>
            <Input
              id="newDueDate"
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
            {newDueDate && (
              <p className="text-xs text-muted-foreground">
                {t('simulation.postponement.simulateTo')}: {formatDateLong(newDueDate)}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSimulate} disabled={!newDueDate}>
            <CalendarClock className="h-4 w-4 mr-2" />
            {t('simulation.postponement.start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
