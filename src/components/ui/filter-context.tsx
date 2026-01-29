import { Calendar, Landmark, X, AlertCircle, TrendingDown, Clock, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/i18n/useLocale';

interface FilterContextProps {
  selectedMonth: Date;
  accountFilter?: {
    id: string;
    name: string;
  } | null;
  onClearAccountFilter?: () => void;
  overdueFilter?: boolean;
  onClearOverdueFilter?: () => void;
  monthPendingFilter?: boolean;
  onClearMonthPendingFilter?: () => void;
  singleTransactionFilter?: {
    description: string;
  } | null;
  onClearSingleTransactionFilter?: () => void;
  latePatternFilter?: {
    categoryName: string;
    subcategoryName?: string;
  } | null;
  onClearLatePatternFilter?: () => void;
}

export function FilterContext({
  selectedMonth,
  accountFilter,
  onClearAccountFilter,
  overdueFilter,
  onClearOverdueFilter,
  monthPendingFilter,
  onClearMonthPendingFilter,
  singleTransactionFilter,
  onClearSingleTransactionFilter,
  latePatternFilter,
  onClearLatePatternFilter,
}: FilterContextProps) {
  const { t, formatMonthYear } = useLocale();
  const monthYear = formatMonthYear(selectedMonth);

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:-mx-6 md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="font-semibold capitalize text-foreground">
            {monthYear}
          </span>
        </div>

        {accountFilter && (
          <Badge variant="secondary" className="flex items-center gap-1 pl-2">
            <Landmark className="h-3 w-3" />
            <span>{t('filters.account')}: {accountFilter.name}</span>
            {onClearAccountFilter && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
                onClick={onClearAccountFilter}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Badge>
        )}

        {overdueFilter && (
          <Badge variant="destructive" className="flex items-center gap-1 pl-2">
            <AlertCircle className="h-3 w-3" />
            <span>{t('filters.overdueExpenses')}</span>
            {onClearOverdueFilter && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-4 w-4 p-0 hover:bg-transparent hover:text-destructive-foreground"
                onClick={onClearOverdueFilter}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Badge>
        )}

        {monthPendingFilter && (
          <Badge variant="outline" className="flex items-center gap-1 pl-2 border-warning text-warning">
            <Clock className="h-3 w-3" />
            <span>{t('filters.pendingExpenses')}</span>
            {onClearMonthPendingFilter && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
                onClick={onClearMonthPendingFilter}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Badge>
        )}

        {singleTransactionFilter && (
          <Badge variant="outline" className="flex items-center gap-1 pl-2 border-warning text-warning">
            <Eye className="h-3 w-3" />
            <span>{t('filters.viewing')}: {singleTransactionFilter.description}</span>
            {onClearSingleTransactionFilter && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
                onClick={onClearSingleTransactionFilter}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Badge>
        )}

        {latePatternFilter && (
          <Badge variant="outline" className="flex items-center gap-1 pl-2 border-warning text-warning">
            <TrendingDown className="h-3 w-3" />
            <span>
              {t('filters.latePattern')}: {latePatternFilter.subcategoryName 
                ? `${latePatternFilter.subcategoryName} – ${latePatternFilter.categoryName}` 
                : latePatternFilter.categoryName}
            </span>
            {onClearLatePatternFilter && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
                onClick={onClearLatePatternFilter}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Badge>
        )}
      </div>
    </div>
  );
}
