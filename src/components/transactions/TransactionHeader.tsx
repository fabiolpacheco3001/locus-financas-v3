import { useState, useEffect, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MonthPicker } from '@/components/ui/month-picker';
import { X, Landmark, SlidersHorizontal, Plus, Eye, EyeOff, Check, CheckCircle2, Calendar } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategoryTreeCombobox } from './CategoryTreeCombobox';

export interface TransactionHeaderProps {
  // Month control
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  
  // Primary action
  onNewTransaction: () => void;
  
  // Account filter
  accounts: Array<{ id: string; name: string }>;
  filterAccount?: string;
  onAccountChange: (value: string | undefined) => void;
  
  // Category filter
  categories: Array<{ id: string; name: string; subcategories?: Array<{ id: string; name: string }> }>;
  filterCategory?: string;
  onCategoryChange: (value: string | undefined) => void;
  filterSubcategory?: string;
  onSubcategoryChange: (value: string | undefined) => void;
  
  // Show cancelled toggle
  showCancelled: boolean;
  onShowCancelledChange: (checked: boolean) => void;
  
  // More filters drawer content
  moreFiltersContent?: ReactNode;
  hasActiveMoreFilters?: boolean;
  moreFiltersSummary?: string;
  isMoreFiltersOpen?: boolean;
  onMoreFiltersOpenChange?: (open: boolean) => void;
  onApplyMoreFilters?: () => void;
  onClearMoreFilters?: () => void;
  onClearAllFilters?: () => void;
  
  // Bulk confirmation
  pendingExpenseCount?: number;
  pendingIncomeCount?: number;
  onConfirmExpenses?: () => void;
  onConfirmIncomes?: () => void;
  
  // Context bar (overdue/pending badges)
  contextBar?: ReactNode;
}

export function TransactionHeader({
  selectedMonth,
  onMonthChange,
  onNewTransaction,
  accounts,
  filterAccount,
  onAccountChange,
  categories,
  filterCategory,
  onCategoryChange,
  filterSubcategory,
  onSubcategoryChange,
  showCancelled,
  onShowCancelledChange,
  moreFiltersContent,
  hasActiveMoreFilters = false,
  moreFiltersSummary,
  isMoreFiltersOpen,
  onMoreFiltersOpenChange,
  onApplyMoreFilters,
  onClearMoreFilters,
  onClearAllFilters,
  pendingExpenseCount = 0,
  pendingIncomeCount = 0,
  onConfirmExpenses,
  onConfirmIncomes,
  contextBar,
}: TransactionHeaderProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const hasActiveFilters = !!(filterAccount || filterCategory || filterSubcategory);
  const hasAnyActiveFilter = hasActiveFilters || hasActiveMoreFilters;
  const activeFilterCount = [filterAccount, filterCategory, filterSubcategory].filter(Boolean).length + (hasActiveMoreFilters ? 1 : 0);

  // Filter pill button component
  const FilterPill = ({
    icon: Icon,
    label,
    active,
    onClick,
    onClear,
  }: {
    icon: typeof Landmark;
    label: string;
    active?: boolean;
    onClick?: () => void;
    onClear?: () => void;
  }) => (
    <div className="relative inline-flex">
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        className={cn(
          "h-8 gap-1.5 rounded-full border-border/60 bg-background px-3 text-sm font-normal transition-all hover:bg-accent/50",
          active && "border-primary/50 bg-primary/5 text-primary"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="max-w-[100px] truncate">{label}</span>
      </Button>
      {active && onClear && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        'sticky top-0 z-30 -mx-4 mb-4 bg-background px-4 pb-3 pt-2 transition-all duration-200 md:-mx-6 md:px-6',
        isScrolled && 'shadow-sm border-b border-border/50'
      )}
    >
      {/* Row 1: Title | Month Picker (centered) | CTA */}
      <div className="relative flex items-center justify-between gap-3">
        {/* Left: Title */}
        <h1 className="shrink-0 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t('transactions.title')}
        </h1>
        
        {/* Center: Month Picker (absolute positioned for true center on desktop) */}
        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 md:flex">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <MonthPicker value={selectedMonth} onChange={onMonthChange} />
        </div>
        
        {/* Right: CTA Button - Hidden on mobile, FAB handles actions */}
        <Button onClick={onNewTransaction} size="sm" className="hidden shrink-0 gap-1.5 sm:flex">
          <Plus className="h-4 w-4" />
          <span>{t('transactions.new')}</span>
        </Button>
      </div>

      {/* Mobile: Month Picker centered below title */}
      <div className="mt-2 flex items-center justify-center gap-1.5 md:hidden">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <MonthPicker value={selectedMonth} onChange={onMonthChange} />
      </div>

      {/* Row 2: Filter Pills */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isMobile ? (
          // Mobile: Single "Filters" button that opens drawer
          <Drawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
            <DrawerTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full px-3">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {t('common.filters')}
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85vh] flex flex-col">
              <DrawerHeader className="pb-2 shrink-0">
                <DrawerTitle>{t('transactions.filters.filtersTitle')}</DrawerTitle>
                <DrawerDescription>{t('stickyFilters.filterDescription')}</DrawerDescription>
              </DrawerHeader>
              <div className="flex-1 overflow-y-auto px-4 pb-2">
                <div className="space-y-4">
                  {/* Account */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('transactions.account')}</label>
                    <Select value={filterAccount ?? "all"} onValueChange={(v) => onAccountChange(v === "all" ? undefined : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('transactions.account')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('filters.allAccounts')}</SelectItem>
                        {accounts.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Category Tree Selector */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('transactions.category')}</label>
                    <CategoryTreeCombobox
                      categories={categories}
                      selectedCategoryId={filterCategory}
                      selectedSubcategoryId={filterSubcategory}
                      onCategoryChange={onCategoryChange}
                      onSubcategoryChange={onSubcategoryChange}
                    />
                  </div>
                  
                  {/* Show Cancelled */}
                  <div className="flex items-center justify-between py-2">
                    <label className="text-sm text-muted-foreground">{t('transactions.filters.showCancelled')}</label>
                    <Button
                      variant={showCancelled ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => onShowCancelledChange(!showCancelled)}
                      className="h-8 gap-1.5"
                    >
                      {showCancelled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {showCancelled ? t('common.visible') : t('common.hidden')}
                    </Button>
                  </div>
                  
                  {/* More filters content */}
                  {moreFiltersContent && (
                    <div className="border-t pt-4 space-y-3">
                      <p className="text-sm font-medium text-foreground">{t('transactions.filters.moreFilters')}</p>
                      {moreFiltersContent}
                    </div>
                  )}
                </div>
              </div>
              <DrawerFooter className="flex-row gap-2 pt-2 shrink-0 border-t">
                {(onClearAllFilters || onClearMoreFilters) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      onClearAllFilters?.();
                      onClearMoreFilters?.();
                      setMobileDrawerOpen(false);
                    }}
                  >
                    {t('transactions.filters.clear')}
                  </Button>
                )}
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    onApplyMoreFilters?.();
                    setMobileDrawerOpen(false);
                  }}
                >
                  {t('transactions.filters.apply')}
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          // Desktop: Pill-style filters inline
          <>
            {/* Account pill */}
            <Select value={filterAccount ?? "all"} onValueChange={(v) => onAccountChange(v === "all" ? undefined : v)}>
              <SelectTrigger className={cn(
                "h-8 w-auto gap-1.5 rounded-full border-border/60 bg-background px-3 text-sm font-normal",
                filterAccount && "border-primary/50 bg-primary/5 text-primary"
              )}>
                <Landmark className="h-3.5 w-3.5" />
                <SelectValue placeholder={t('filters.allAccounts')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allAccounts')}</SelectItem>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Category Tree Combobox - replaces both category and subcategory selectors */}
            <CategoryTreeCombobox
              categories={categories}
              selectedCategoryId={filterCategory}
              selectedSubcategoryId={filterSubcategory}
              onCategoryChange={onCategoryChange}
              onSubcategoryChange={onSubcategoryChange}
              variant="pill"
            />
            
            {/* Show cancelled toggle */}
            <Button
              variant={showCancelled ? "secondary" : "outline"}
              size="sm"
              onClick={() => onShowCancelledChange(!showCancelled)}
              className="h-8 gap-1.5 rounded-full border-border/60 px-3"
            >
              {showCancelled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span className="hidden lg:inline">{t('transactions.filters.showCancelled')}</span>
            </Button>
            
            {/* More filters - Popover instead of Drawer */}
            {moreFiltersContent && (
              <Popover open={isMoreFiltersOpen} onOpenChange={onMoreFiltersOpenChange}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn(
                    "h-8 gap-1.5 rounded-full border-border/60 px-3",
                    hasActiveMoreFilters && "border-primary/50 bg-primary/5 text-primary"
                  )}>
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {t('transactions.filters.moreFilters')}
                    {hasActiveMoreFilters && (
                      <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-72 p-4 bg-popover border shadow-lg z-50" 
                  align="start"
                  sideOffset={8}
                >
                  <div className="space-y-3">
                    {moreFiltersContent}
                  </div>
                  <div className="mt-4 flex gap-2 border-t pt-3">
                    {onClearMoreFilters && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 text-xs" 
                        onClick={() => {
                          onClearMoreFilters();
                          onMoreFiltersOpenChange?.(false);
                        }}
                      >
                        {t('transactions.filters.clear')}
                      </Button>
                    )}
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="flex-1 text-xs" 
                      onClick={() => {
                        onApplyMoreFilters?.();
                        onMoreFiltersOpenChange?.(false);
                      }}
                    >
                      {t('transactions.filters.apply')}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            {/* Clear all filters button (when any filter is active) */}
            {hasAnyActiveFilter && (onClearAllFilters || onClearMoreFilters) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClearAllFilters?.();
                  onClearMoreFilters?.();
                }}
                className="h-8 gap-1 rounded-full px-2 text-muted-foreground hover:text-destructive"
                data-testid="btn-clear-all-filters"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{t('transactions.filters.clearFilters')}</span>
              </Button>
            )}
            
            {/* Spacer to push bulk actions to the right */}
            <div className="flex-1" />
            
            {/* Bulk confirmation actions - always present for stable height */}
            <div className="flex items-center gap-2 min-h-[32px]">
              {pendingExpenseCount > 0 ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onConfirmExpenses}
                  className="h-7 rounded-full text-xs text-warning border-warning/50 hover:bg-warning/10"
                >
                  <Check className="mr-1 h-3 w-3" />
                  {t('transactions.bulkConfirm.expenses', { count: pendingExpenseCount })}
                </Button>
              ) : null}
              {pendingIncomeCount > 0 ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onConfirmIncomes}
                  className="h-7 rounded-full text-xs text-success border-success/50 hover:bg-success/10"
                >
                  <Check className="mr-1 h-3 w-3" />
                  {t('transactions.bulkConfirm.incomes', { count: pendingIncomeCount })}
                </Button>
              ) : null}
              {pendingExpenseCount === 0 && pendingIncomeCount === 0 && (
                <Badge variant="outline" className="h-7 rounded-full border-success/30 bg-success/5 px-2.5 text-[11px] font-normal text-success">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {t('transactions.monthInOrder')}
                </Badge>
              )}
            </div>
          </>
        )}
      </div>

      {/* Context bar (overdue, pending, etc.) */}
      {contextBar && (
        <div className="mt-2">
          {contextBar}
        </div>
      )}
    </div>
  );
}
