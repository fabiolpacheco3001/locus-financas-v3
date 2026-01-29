import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PiggyBank, TrendingDown, TrendingUp, Info } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';

type BudgetStatus = 'ok' | 'warning' | 'over' | 'neutral';

interface BudgetSummaryProps {
  totalPlanned: number;
  totalActual: number;
}

export function BudgetSummary({ totalPlanned, totalActual }: BudgetSummaryProps) {
  const { t, formatCurrency } = useLocale();

  const getStatus = (actual: number, planned: number): BudgetStatus => {
    if (planned === 0) return 'neutral';
    const ratio = actual / planned;
    if (ratio > 1) return 'over';
    if (ratio > 0.8) return 'warning';
    return 'ok';
  };

  const getStatusLabel = (actual: number, planned: number): string => {
    const status = getStatus(actual, planned);
    if (status === 'over') return t('status.budgetExceeded');
    if (status === 'warning') return t('status.closeToLimit');
    if (status === 'ok') return t('status.underBudget');
    return '';
  };

  const status = getStatus(totalActual, totalPlanned);
  const percentUsed = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-3" data-testid="budget-summary">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <PiggyBank className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('budget.planned')}</p>
              <p className="text-2xl font-bold" data-testid="budget-planned-total">
                {formatCurrency(totalPlanned)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <TrendingDown className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('budget.actual')}</p>
              <p className="text-2xl font-bold" data-testid="budget-actual-total">
                {formatCurrency(totalActual)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
              status === 'over' 
                ? 'bg-red-100 dark:bg-red-900/20'
                : status === 'warning'
                ? 'bg-amber-100 dark:bg-amber-900/20'
                : 'bg-emerald-100 dark:bg-emerald-900/20'
            }`}>
              <TrendingUp className={`h-6 w-6 ${
                status === 'over' 
                  ? 'text-red-600 dark:text-red-400'
                  : status === 'warning'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`} />
            </div>
            <div>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                {t('budget.overallStatus')}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('budget.statusTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </p>
              <p className={`text-lg font-bold ${
                status === 'over' 
                  ? 'text-red-600 dark:text-red-400'
                  : status === 'warning'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`} data-testid="budget-status-label">
                {getStatusLabel(totalActual, totalPlanned)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('budget.percentUsed', { percent: percentUsed })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
