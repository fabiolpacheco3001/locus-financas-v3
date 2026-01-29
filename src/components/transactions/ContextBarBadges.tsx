import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, X, EyeOff, TrendingDown, CalendarDays, CalendarClock } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { Transaction } from '@/types/finance';

interface Category {
  id: string;
  name: string;
  subcategories?: Array<{ id: string; name: string }>;
}

interface ContextBarBadgesProps {
  isOverdueView: boolean;
  isTodayView: boolean;
  isWeekView: boolean;
  isMonthPendingView: boolean;
  isSingleTransactionView: boolean;
  filterLatePattern: boolean;
  latePatternCategoryId: string | null;
  latePatternSubcategoryId: string | null;
  transactions: Transaction[];
  categories: Category[];
  onClearOverdueView: () => void;
  onClearTodayView: () => void;
  onClearWeekView: () => void;
  onClearMonthPendingView: () => void;
  onClearSingleTransactionView: () => void;
  onClearLatePattern: () => void;
}

export function ContextBarBadges({
  isOverdueView,
  isTodayView,
  isWeekView,
  isMonthPendingView,
  isSingleTransactionView,
  filterLatePattern,
  latePatternCategoryId,
  latePatternSubcategoryId,
  transactions,
  categories,
  onClearOverdueView,
  onClearTodayView,
  onClearWeekView,
  onClearMonthPendingView,
  onClearSingleTransactionView,
  onClearLatePattern,
}: ContextBarBadgesProps) {
  const { t } = useLocale();

  // Don't render if no active view
  if (!isOverdueView && !isTodayView && !isWeekView && !isMonthPendingView && !isSingleTransactionView && !filterLatePattern) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="context-bar-badges">
      {isOverdueView && (
        <Badge variant="destructive" className="flex items-center gap-1 rounded-full pl-2">
          <AlertTriangle className="h-3 w-3" />
          <span>{t('filters.overdueExpenses')}</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 h-4 w-4 p-0 hover:bg-transparent hover:text-destructive-foreground"
            onClick={onClearOverdueView}
            data-testid="clear-overdue-view"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {isTodayView && (
        <Badge variant="outline" className="flex items-center gap-1 rounded-full border-amber-500 bg-amber-50 pl-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50">
          <CalendarClock className="h-3 w-3" />
          <span>{t('filters.dueToday')}</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
            onClick={onClearTodayView}
            data-testid="clear-today-view"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {isWeekView && (
        <Badge variant="outline" className="flex items-center gap-1 rounded-full border-blue-500 bg-blue-50 pl-2 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/50">
          <CalendarDays className="h-3 w-3" />
          <span>{t('filters.dueThisWeek')}</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
            onClick={onClearWeekView}
            data-testid="clear-week-view"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {isMonthPendingView && (
        <Badge variant="outline" className="flex items-center gap-1 rounded-full border-warning pl-2 text-warning">
          <Clock className="h-3 w-3" />
          <span>{t('filters.pendingExpenses')}</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
            onClick={onClearMonthPendingView}
            data-testid="clear-pending-view"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {isSingleTransactionView && transactions.length > 0 && (
        <Badge variant="outline" className="flex items-center gap-1 rounded-full border-warning pl-2 text-warning">
          <EyeOff className="h-3 w-3" />
          <span>
            {t('filters.viewing')}: {transactions[0]?.subcategory?.name 
              ? `${transactions[0].subcategory.name} – ${transactions[0].category?.name || t('transactions.kind.expense')}`
              : transactions[0]?.category?.name || transactions[0]?.description || t('common.transaction')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
            onClick={onClearSingleTransactionView}
            data-testid="clear-single-view"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {filterLatePattern && latePatternCategoryId && (() => {
        const category = categories.find(c => c.id === latePatternCategoryId);
        const subcategory = latePatternSubcategoryId 
          ? category?.subcategories?.find(s => s.id === latePatternSubcategoryId)
          : null;
        return category ? (
          <Badge variant="outline" className="flex items-center gap-1 rounded-full border-warning pl-2 text-warning">
            <TrendingDown className="h-3 w-3" />
            <span>
              {t('filters.latePattern')}: {subcategory?.name 
                ? `${subcategory.name} – ${category.name}` 
                : category.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
              onClick={onClearLatePattern}
              data-testid="clear-late-pattern"
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ) : null;
      })()}
    </div>
  );
}
