import { useState, useEffect, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Filter, Calendar, Landmark, Tag, SlidersHorizontal } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

export interface ActiveFilter {
  type: 'account' | 'category' | 'subcategory' | 'status' | 'kind' | 'expenseType';
  label: string;
  value: string;
  onClear: () => void;
}

interface StickyHeaderFiltersProps {
  // Line 1: Header
  titleKey: string;
  primaryAction?: {
    labelKey: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  
  // Line 2: Filters
  monthControl: ReactNode;
  
  // Desktop inline filters (essential)
  accountControl?: ReactNode;
  categoryControl?: ReactNode;
  
  // Toggle for showing cancelled (always visible)
  showCancelledControl?: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  };
  
  // "More filters" drawer content
  moreFiltersContent?: ReactNode;
  hasActiveMoreFilters?: boolean;
  onClearMoreFilters?: () => void;
  onApplyMoreFilters?: () => void;
  isMoreFiltersOpen?: boolean;
  onMoreFiltersOpenChange?: (open: boolean) => void;
  
  // Active filters summary for drawer chip (e.g. "Tipo: Todos · Status: Todos")
  moreFiltersSummary?: string;
  
  // Active filter chips (for mobile drawer feedback)
  activeFilters?: ActiveFilter[];
  
  // Clear all filters (for drawer)
  onClearAllFilters?: () => void;
  
  // Context bar (overdue/pending filter badges)
  contextBar?: ReactNode;
}

export function StickyHeaderFilters({
  titleKey,
  primaryAction,
  monthControl,
  accountControl,
  categoryControl,
  showCancelledControl,
  moreFiltersContent,
  hasActiveMoreFilters = false,
  onClearMoreFilters,
  onApplyMoreFilters,
  isMoreFiltersOpen: externalIsMoreFiltersOpen,
  onMoreFiltersOpenChange,
  moreFiltersSummary,
  activeFilters = [],
  onClearAllFilters,
  contextBar,
}: StickyHeaderFiltersProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const [internalIsMoreFiltersOpen, setInternalIsMoreFiltersOpen] = useState(false);
  const isMoreFiltersOpen = externalIsMoreFiltersOpen ?? internalIsMoreFiltersOpen;
  const setIsMoreFiltersOpen = onMoreFiltersOpenChange ?? setInternalIsMoreFiltersOpen;

  // Track scroll position for shadow effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Filter out month-related active filters (month is always visible in sticky)
  const nonMonthFilters = activeFilters.filter(
    f => f.type !== 'status' && f.type !== 'kind' && f.type !== 'expenseType'
  );
  
  const accountAndCategoryFilters = nonMonthFilters.filter(
    f => f.type === 'account' || f.type === 'category' || f.type === 'subcategory'
  );

  const hasActiveFilters = accountAndCategoryFilters.length > 0;

  return (
    <div
      className={cn(
        'sticky top-0 z-30 -mx-4 mb-6 bg-background px-4 py-3 transition-all duration-200 md:-mx-6 md:px-6',
        isScrolled && 'shadow-sm border-b border-border/50'
      )}
    >
      {/* Line 1: Header - Title (left) + Month Picker (center) + CTA (right) */}
      <div className="relative mb-3 flex items-center justify-between gap-3">
        {/* Left: Title */}
        <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t(titleKey)}
        </h1>
        
        {/* Center: Month Picker (absolute positioned for true center) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {monthControl}
        </div>
        
        {/* Right: Primary Action (HIDDEN on mobile - FAB handles actions) */}
        <div className="hidden items-center sm:flex">
          {primaryAction ? (
            <Button onClick={primaryAction.onClick} size="sm" className="shrink-0">
              {primaryAction.icon}
              <span>{t(primaryAction.labelKey)}</span>
            </Button>
          ) : (
            /* Spacer for centering when no CTA */
            <div className="w-24" />
          )}
        </div>
      </div>

      {/* Line 2: Mobile Month Picker + Filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Month picker - mobile only (desktop is centered above) */}
        <div className="flex sm:hidden items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {monthControl}
        </div>

        {isMobile ? (
          // Mobile: Filters button + Drawer (contains account, category, show cancelled, more filters)
          <>
            {(accountControl || categoryControl || moreFiltersContent) && (
              <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5">
                    <Filter className="h-3.5 w-3.5" />
                    {t('common.filters')}
                    {(hasActiveFilters || hasActiveMoreFilters) && (
                      <Badge variant="secondary" className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px]">
                        {accountAndCategoryFilters.length + (hasActiveMoreFilters ? 1 : 0)}
                      </Badge>
                    )}
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[80vh] flex flex-col">
                  <DrawerHeader className="pb-2 shrink-0">
                    <DrawerTitle>{t('transactions.filters.filtersTitle')}</DrawerTitle>
                    <DrawerDescription>
                      {t('stickyFilters.filterDescription')}
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="flex-1 overflow-y-auto px-4 pb-2">
                    <div className="space-y-2.5">
                      {accountControl && (
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-foreground">
                            {t('transactions.account')}
                          </label>
                          {accountControl}
                        </div>
                      )}
                      {categoryControl && (
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-foreground">
                            {t('transactions.category')}
                          </label>
                          {categoryControl}
                        </div>
                      )}
                      {showCancelledControl && (
                        <div className="flex items-center gap-2 py-0.5">
                          <Switch
                            id="show-cancelled-mobile"
                            checked={showCancelledControl.checked}
                            onCheckedChange={showCancelledControl.onCheckedChange}
                          />
                          <Label htmlFor="show-cancelled-mobile" className="text-sm text-muted-foreground cursor-pointer">
                            {t('transactions.filters.showCancelled')}
                          </Label>
                        </div>
                      )}
                      {moreFiltersContent && (
                        <div className="space-y-2 border-t pt-2">
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
                          setIsDrawerOpen(false);
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
                        setIsDrawerOpen(false);
                      }}
                    >
                      {t('transactions.filters.apply')}
                    </Button>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            )}
          </>
        ) : (
          // Desktop: Inline essential filters + More filters drawer
          <>
            {accountControl && (
              <div className="flex items-center gap-1">
                <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                {accountControl}
              </div>
            )}
            {categoryControl && (
              <div className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                {categoryControl}
              </div>
            )}
            {showCancelledControl && (
              <div className="flex items-center gap-2">
                <Switch
                  id="show-cancelled"
                  checked={showCancelledControl.checked}
                  onCheckedChange={showCancelledControl.onCheckedChange}
                />
                <Label htmlFor="show-cancelled" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
                  {t('transactions.filters.showCancelled')}
                </Label>
              </div>
            )}
            {moreFiltersContent && (
              <div className="flex items-center gap-1.5">
                <Drawer open={isMoreFiltersOpen} onOpenChange={setIsMoreFiltersOpen}>
                  <DrawerTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {t('transactions.filters.moreFilters')}
                      {hasActiveMoreFilters && (
                        <Badge variant="secondary" className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px]">
                          •
                        </Badge>
                      )}
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-h-[80vh] flex flex-col">
                    <DrawerHeader className="pb-2 shrink-0">
                      <DrawerTitle>{t('transactions.filters.moreFilters')}</DrawerTitle>
                      <DrawerDescription>
                        {t('stickyFilters.filterDescription')}
                      </DrawerDescription>
                    </DrawerHeader>
                    <div className="flex-1 overflow-y-auto px-4 pb-2">
                      <div className="space-y-2.5">
                        {moreFiltersContent}
                      </div>
                    </div>
                    <DrawerFooter className="flex-row gap-2 pt-2 shrink-0 border-t">
                      {onClearMoreFilters && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            onClearMoreFilters();
                            setIsMoreFiltersOpen(false);
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
                          setIsMoreFiltersOpen(false);
                        }}
                      >
                        {t('transactions.filters.apply')}
                      </Button>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
                {/* Active filters summary chip */}
                {moreFiltersSummary && (
                  <Badge 
                    variant="outline" 
                    className="h-6 px-2 text-[11px] font-normal text-muted-foreground border-border/60"
                  >
                    {moreFiltersSummary}
                  </Badge>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Active filter chips - mobile only, below filters row */}
      {isMobile && hasActiveFilters && (
        <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {accountAndCategoryFilters.map((filter, index) => (
            <Badge 
              key={`${filter.type}-${index}`}
              variant="secondary" 
              className="flex shrink-0 items-center gap-0.5 whitespace-nowrap py-0.5 pl-1.5 pr-1 text-xs"
            >
              {filter.type === 'account' && <Landmark className="h-2.5 w-2.5" />}
              {(filter.type === 'category' || filter.type === 'subcategory') && <Tag className="h-2.5 w-2.5" />}
              <span>{filter.label}</span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
                onClick={filter.onClear}
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Context bar (overdue, pending, etc.) */}
      {contextBar && (
        <div className="mt-1.5">
          {contextBar}
        </div>
      )}
    </div>
  );
}