import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoneyInput } from '@/components/ui/money-input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Plus } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { safeSelectValue } from '@/lib/utils';
import type { Category } from '@/types/finance';

interface RecurringBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  categoryId: string;
  subcategoryId: string;
  amount: number | undefined;
  startMonth: string;
  endMonth: string;
  onCategoryChange: (id: string) => void;
  onSubcategoryChange: (id: string) => void;
  onAmountChange: (amount: number | undefined) => void;
  onStartMonthChange: (month: string) => void;
  onEndMonthChange: (month: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function RecurringBudgetDialog({
  open,
  onOpenChange,
  categories,
  categoryId,
  subcategoryId,
  amount,
  startMonth,
  endMonth,
  onCategoryChange,
  onSubcategoryChange,
  onAmountChange,
  onStartMonthChange,
  onEndMonthChange,
  onSubmit,
  isPending,
}: RecurringBudgetDialogProps) {
  const { t } = useLocale();

  const selectedCategory = categories.find(c => c.id === categoryId);
  const subcategories = selectedCategory?.subcategories || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('budget.recurring.new')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Category */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              {t('budget.category')}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-destructive cursor-help">*</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">{t('common.required')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select 
              value={safeSelectValue(categoryId)} 
              onValueChange={(v) => {
                onCategoryChange(v || '');
                onSubcategoryChange('');
              }}
            >
              <SelectTrigger data-testid="recurring-category-select">
                <SelectValue placeholder={t('transactions.selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {categories.filter(cat => cat.id).map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategory */}
          {subcategories.length > 0 && (
            <div className="space-y-2">
              <Label>{t('budget.subcategory')} ({t('common.optional')})</Label>
              <Select 
                value={subcategoryId || '__none__'} 
                onValueChange={(v) => onSubcategoryChange(v === '__none__' ? '' : v)}
              >
                <SelectTrigger data-testid="recurring-subcategory-select">
                  <SelectValue placeholder={t('budget.recurring.entireCategory')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('budget.recurring.entireCategory')}</SelectItem>
                  {subcategories.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              {t('budget.recurring.monthlyAmount')}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-destructive cursor-help">*</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">{t('common.required')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <MoneyInput
              value={amount}
              onChange={onAmountChange}
              placeholder="0,00"
              className={!amount ? 'border-destructive/50' : ''}
              data-testid="recurring-amount-input"
            />
            {!amount && (
              <p className="text-xs text-destructive">{t('budget.recurring.enterMonthlyAmount')}</p>
            )}
          </div>

          {/* Month Range - 2x2 Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2" data-testid="recurring-budget-month-grid">
            {/* Row 1: Labels */}
            <Label className="flex items-center gap-1 leading-none">
              {t('budget.recurring.startMonth')}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-destructive cursor-help">*</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">{t('common.required')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Label className="leading-none">{t('budget.recurring.endMonth')}</Label>
            
            {/* Row 2: Inputs */}
            <div className="space-y-1">
              <Input
                type="month"
                value={startMonth}
                onChange={(e) => onStartMonthChange(e.target.value)}
                className={`h-10 ${!startMonth ? 'border-destructive/50' : ''}`}
                data-testid="recurring-start-month"
              />
              {!startMonth && (
                <p className="text-xs text-destructive">{t('budget.recurring.enterStartMonth')}</p>
              )}
            </div>
            <Input
              type="month"
              value={endMonth}
              onChange={(e) => onEndMonthChange(e.target.value)}
              min={startMonth}
              className="h-10"
              data-testid="recurring-end-month"
            />
          </div>

          <p className="text-sm text-muted-foreground">
            {t('budget.recurring.autoGenerateNote')}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={onSubmit} 
            disabled={isPending}
            data-testid="btn-add-budget"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {t('budget.recurring.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
