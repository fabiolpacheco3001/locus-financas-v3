import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/money-input';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Repeat, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { useIsMobile } from '@/hooks/use-mobile';

type BudgetStatus = 'ok' | 'warning' | 'over' | 'neutral';

interface SubcategoryBudgetData {
  id: string;
  name: string;
  planned: number;
  savedPlanned: number;
  actual: number;
  categoryId: string;
  fromRecurring: boolean;
}

interface CategoryBudgetData {
  id: string;
  name: string;
  categoryPlanned: number;
  savedCategoryPlanned: number;
  subcategoriesPlannedSum: number;
  planned: number;
  actual: number;
  subcategories: SubcategoryBudgetData[];
  hasCategoryBudget: boolean;
  exceedsCeiling: boolean;
  fromRecurring: boolean;
}

interface BudgetCategoryCardProps {
  category: CategoryBudgetData;
  isExpanded: boolean;
  pendingEdits: Record<string, number | undefined>;
  onToggle: () => void;
  onInputChange: (key: string, value: number | undefined) => void;
  onSave: (categoryId: string, subcategoryId: string | null, value: number | undefined) => void;
  onSetRecurrence: (categoryId: string, subcategoryId?: string) => void;
}

export function BudgetCategoryCard({
  category,
  isExpanded,
  pendingEdits,
  onToggle,
  onInputChange,
  onSave,
  onSetRecurrence,
}: BudgetCategoryCardProps) {
  const { t, formatCurrency } = useLocale();
  const isMobile = useIsMobile();

  const getPercentage = (actual: number, planned: number): number => {
    if (planned === 0) return actual > 0 ? 100 : 0;
    return Math.min((actual / planned) * 100, 100);
  };

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

  const getStatusColorClass = (status: BudgetStatus): string => {
    switch (status) {
      case 'over': return 'text-destructive';
      case 'warning': return 'text-warning';
      case 'ok': return 'text-success';
      default: return 'text-muted-foreground';
    }
  };

  const getProgressColorClass = (status: BudgetStatus): string => {
    switch (status) {
      case 'over': return '[&>div]:bg-destructive';
      case 'warning': return '[&>div]:bg-warning';
      default: return '[&>div]:bg-success';
    }
  };

  const categoryStatus = getStatus(category.actual, category.planned);
  const categoryValue = pendingEdits[`cat_${category.id}`] !== undefined 
    ? pendingEdits[`cat_${category.id}`] 
    : (category.savedCategoryPlanned || undefined);

  return (
    <Card 
      className={`w-full max-w-full overflow-hidden ${category.exceedsCeiling ? 'border-destructive border-2' : ''}`} 
      data-testid={`budget-card-${category.id}`}
    >
      <CardHeader className="pb-2">
        {/* Mobile Layout: Stack everything vertically */}
        {isMobile ? (
          <div className="flex flex-col gap-3 w-full">
            {/* Row 1: Title + Recurrence Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{category.name}</CardTitle>
              {category.fromRecurring ? (
                <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  <Repeat className="h-3 w-3" />
                  {t('common.recurrent')}
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
                  onClick={() => onSetRecurrence(category.id)}
                >
                  <Repeat className="h-3 w-3" />
                  {t('common.setRecurrence')}
                </Button>
              )}
            </div>

            {/* Row 2: Budget Ceiling Input */}
            <div className="flex items-center gap-2 w-full">
              <span className="text-xs text-muted-foreground shrink-0">{t('budget.budgetCeiling')}:</span>
              <MoneyInput
                value={categoryValue}
                onChange={(value) => onInputChange(`cat_${category.id}`, value)}
                onBlur={() => onSave(category.id, null, categoryValue)}
                className={`h-8 flex-1 min-w-0 text-sm ${category.exceedsCeiling ? 'border-destructive' : ''}`}
              />
            </div>

            {/* Row 3: Progress Bar */}
            <Progress 
              value={getPercentage(category.actual, category.planned)} 
              className={`h-2 w-full ${getProgressColorClass(categoryStatus)}`}
            />

            {/* Row 4: Actual vs Planned + Percentage */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {formatCurrency(category.actual)} / {formatCurrency(category.planned)}
              </span>
              <span className={`font-medium ${getStatusColorClass(categoryStatus)}`}>
                {category.planned > 0 ? Math.round((category.actual / category.planned) * 100) : 0}%
              </span>
            </div>

            {/* Row 5: Warnings */}
            {category.exceedsCeiling && (
              <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('budget.validation.subcategoryExceedsCeiling')}
              </span>
            )}
          </div>
        ) : (
          /* Desktop Layout: Original horizontal design */
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  {category.fromRecurring ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            <Repeat className="h-3 w-3" />
                            {t('common.recurrent')}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('budget.recurring.monthly')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
                            onClick={() => onSetRecurrence(category.id)}
                          >
                            <Repeat className="h-3 w-3" />
                            {t('common.setRecurrence')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('budget.recurring.createFor')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t('budget.budgetCeiling')}:</span>
                    <MoneyInput
                      value={categoryValue}
                      onChange={(value) => onInputChange(`cat_${category.id}`, value)}
                      onBlur={() => onSave(category.id, null, categoryValue)}
                      className={`h-7 w-28 text-sm ${category.exceedsCeiling ? 'border-destructive' : ''}`}
                    />
                  </div>
                </div>
                {/* Budget summary info */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className={category.exceedsCeiling ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                    {t('budget.budgetCeiling')}: {formatCurrency(category.categoryPlanned)}
                  </span>
                  {category.subcategories.length > 0 && (
                    <span className={category.exceedsCeiling ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                      {t('budget.subcategoriesSum')}: {formatCurrency(category.subcategoriesPlannedSum)}
                    </span>
                  )}
                  {category.exceedsCeiling && (
                    <span className="flex items-center gap-1 font-medium text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t('budget.validation.subcategoryExceedsCeiling')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  {t('budget.actual')}: {formatCurrency(category.actual)} / {formatCurrency(category.planned)}
                </span>
                <div className="flex flex-col items-end gap-0.5">
                  <span className={`text-xs font-medium ${getStatusColorClass(categoryStatus)}`}>
                    {getStatusLabel(category.actual, category.planned)}
                  </span>
                  <span className={`font-medium ${getStatusColorClass(categoryStatus)}`}>
                    {category.planned > 0 ? Math.round((category.actual / category.planned) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
            <Progress 
              value={getPercentage(category.actual, category.planned)} 
              className={`h-2 ${getProgressColorClass(categoryStatus)}`}
            />
          </>
        )}
      </CardHeader>

      {category.subcategories.length > 0 && (
        <Collapsible open={isExpanded} onOpenChange={onToggle}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full flex items-center justify-start gap-2 px-6 py-2 h-auto text-sm text-muted-foreground hover:text-foreground border-t border-border rounded-none"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span>
                {isExpanded 
                  ? t('budget.collapse') 
                  : t('budget.expand', { count: category.subcategories.length })}
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {category.subcategories.map(sub => {
                  const subStatus = getStatus(sub.actual, sub.planned);
                  const subValue = pendingEdits[`sub_${sub.id}`] !== undefined 
                    ? pendingEdits[`sub_${sub.id}`] 
                    : (sub.savedPlanned || undefined);

                  return (
                    <div 
                      key={sub.id} 
                      className="flex flex-wrap items-center gap-4 border-t border-border pt-3 first:border-0 first:pt-0"
                      data-testid={`budget-subcategory-${sub.id}`}
                    >
                      <div className="flex min-w-[180px] items-center gap-2">
                        <span className="text-sm">{sub.name}</span>
                        {sub.fromRecurring ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Repeat className="h-3 w-3 text-primary" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('budget.recurring.monthly')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-muted-foreground hover:text-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSetRecurrence(category.id, sub.id);
                                  }}
                                >
                                  <Repeat className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('budget.recurring.createForSubcategory')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <MoneyInput
                        value={subValue}
                        onChange={(value) => onInputChange(`sub_${sub.id}`, value)}
                        onBlur={() => onSave(category.id, sub.id, subValue)}
                        className={`w-28 ${category.exceedsCeiling ? 'border-destructive' : ''}`}
                      />
                      <div className="flex flex-1 items-center gap-2">
                        <Progress 
                          value={getPercentage(sub.actual, sub.planned)} 
                          className={`h-1.5 flex-1 ${getProgressColorClass(subStatus)}`}
                        />
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(sub.actual)} / {formatCurrency(sub.planned)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}
