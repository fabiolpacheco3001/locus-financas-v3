import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Repeat, Trash2 } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import type { RecurringBudget, Category } from '@/types/finance';

interface RecurringBudgetListProps {
  recurringBudgets: RecurringBudget[];
  categories: Category[];
  onDelete: (rb: RecurringBudget) => void;
}

export function RecurringBudgetList({ 
  recurringBudgets, 
  categories, 
  onDelete 
}: RecurringBudgetListProps) {
  const { t, formatCurrency } = useLocale();

  if (recurringBudgets.length === 0) {
    return (
      <Card className="p-6" data-testid="recurring-budget-empty">
        <p className="text-center text-muted-foreground">
          {t('budget.recurring.emptyState')}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2" data-testid="recurring-budget-list">
      {recurringBudgets.map(rb => {
        const category = categories.find(c => c.id === rb.category_id);
        const subcategory = category?.subcategories?.find(s => s.id === rb.subcategory_id);

        return (
          <Card key={rb.id} className="p-4" data-testid={`recurring-budget-item-${rb.id}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Repeat className="h-4 w-4 text-primary" />
                <div>
                  <span className="font-medium">
                    {category?.name}
                    {subcategory && ` → ${subcategory.name}`}
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(rb.amount)} / {t('budget.recurring.perMonth')}
                    {' • '}
                    {t('budget.recurring.from')} {rb.start_month}
                    {rb.end_month 
                      ? ` ${t('budget.recurring.until')} ${rb.end_month}` 
                      : ` (${t('budget.recurring.noEnd')})`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(rb)}
                data-testid="delete-recurring-budget-btn"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
