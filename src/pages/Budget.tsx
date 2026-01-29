import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { StickyHeaderFilters } from '@/components/layout/StickyHeaderFilters';
import { MonthPicker } from '@/components/ui/month-picker';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';

// Budget feature components
import { BudgetSummary } from '@/components/budget/BudgetSummary';
import { BudgetCategoryCard } from '@/components/budget/BudgetCategoryCard';
import { RecurringBudgetList } from '@/components/budget/RecurringBudgetList';
import { RecurringBudgetDialog } from '@/components/budget/RecurringBudgetDialog';
import { DeleteRecurringBudgetDialog } from '@/components/budget/DeleteRecurringBudgetDialog';
import { useBudgetPageState } from '@/components/budget/hooks/useBudgetPageState';

export default function BudgetPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocale();

  // All state and handlers extracted to custom hook
  const {
    selectedMonth,
    setSelectedMonth,
    activeTab,
    setActiveTab,
    isLoading,
    budgetData,
    totalPlanned,
    totalActual,
    budgetCategories,
    pendingEdits,
    handleInputChange,
    handleBudgetSave,
    expandedCategories,
    toggleCategory,
    recurringBudgets,
    isRecurringDialogOpen,
    setIsRecurringDialogOpen,
    recurringCategoryId,
    setRecurringCategoryId,
    recurringSubcategoryId,
    setRecurringSubcategoryId,
    recurringAmount,
    setRecurringAmount,
    recurringStartMonth,
    setRecurringStartMonth,
    recurringEndMonth,
    setRecurringEndMonth,
    openRecurringDialog,
    handleCreateRecurring,
    createRecurringBudgetPending,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    recurringToDelete,
    openDeleteDialog,
    handleConfirmDelete,
    isDeleting,
  } = useBudgetPageState();

  // Auth guards
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AppLayout>
      {/* Sticky Header */}
      <StickyHeaderFilters
        titleKey={activeTab === 'monthly' ? 'budget.title' : 'budget.tabs.recurrencesTitle'}
        primaryAction={{
          labelKey: 'budget.recurring.newCta',
          onClick: () => {
            setActiveTab('recurrences');
            openRecurringDialog();
          },
          icon: <Plus className="mr-2 h-4 w-4" />,
        }}
        monthControl={activeTab === 'monthly' ? (
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        ) : undefined}
      />

      {/* Summary Cards - Only in Monthly tab */}
      {activeTab === 'monthly' && (
        <BudgetSummary 
          totalPlanned={totalPlanned} 
          totalActual={totalActual} 
        />
      )}

      {/* Tab Selector */}
      <div className="mb-6 inline-flex items-center rounded-full border bg-muted/40 p-1">
        <Button
          size="sm"
          variant={activeTab === 'monthly' ? 'default' : 'ghost'}
          data-testid="budget-tab-monthly"
          onClick={() => setActiveTab('monthly')}
          className={activeTab === 'monthly' 
            ? 'rounded-full bg-background text-foreground shadow-sm hover:bg-background' 
            : 'rounded-full'}
        >
          {t('budget.tabs.monthly')}
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'recurrences' ? 'default' : 'ghost'}
          data-testid="budget-tab-recurrences"
          onClick={() => setActiveTab('recurrences')}
          className={activeTab === 'recurrences' 
            ? 'rounded-full bg-background text-foreground shadow-sm hover:bg-background' 
            : 'rounded-full'}
        >
          {t('budget.tabs.recurrences')}
          {recurringBudgets.length > 0 && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 text-xs font-medium text-primary">
              {recurringBudgets.length}
            </span>
          )}
        </Button>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <main>
          {/* Monthly View */}
          {activeTab === 'monthly' && (
            <div className="space-y-4">
              {budgetData.map(category => (
                <BudgetCategoryCard
                  key={category.id}
                  category={category}
                  isExpanded={expandedCategories[category.id] || false}
                  pendingEdits={pendingEdits}
                  onToggle={() => toggleCategory(category.id)}
                  onInputChange={handleInputChange}
                  onSave={handleBudgetSave}
                  onSetRecurrence={openRecurringDialog}
                />
              ))}
            </div>
          )}

          {/* Recurrences View */}
          {activeTab === 'recurrences' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('budget.recurring.activeTitle')}</h3>
              <RecurringBudgetList
                recurringBudgets={recurringBudgets}
                categories={budgetCategories}
                onDelete={openDeleteDialog}
              />
            </div>
          )}
        </main>
      )}

      {/* Recurring Budget Dialog */}
      <RecurringBudgetDialog
        open={isRecurringDialogOpen}
        onOpenChange={setIsRecurringDialogOpen}
        categories={budgetCategories}
        categoryId={recurringCategoryId}
        subcategoryId={recurringSubcategoryId}
        amount={recurringAmount}
        startMonth={recurringStartMonth}
        endMonth={recurringEndMonth}
        onCategoryChange={setRecurringCategoryId}
        onSubcategoryChange={setRecurringSubcategoryId}
        onAmountChange={setRecurringAmount}
        onStartMonthChange={setRecurringStartMonth}
        onEndMonthChange={setRecurringEndMonth}
        onSubmit={handleCreateRecurring}
        isPending={createRecurringBudgetPending}
      />

      {/* Delete Recurring Budget Dialog */}
      <DeleteRecurringBudgetDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        recurringBudget={recurringToDelete}
        selectedMonth={selectedMonth}
        categoryName={budgetCategories.find(c => c.id === recurringToDelete?.category_id)?.name || ''}
        subcategoryName={
          budgetCategories
            .find(c => c.id === recurringToDelete?.category_id)
            ?.subcategories?.find(s => s.id === recurringToDelete?.subcategory_id)?.name
        }
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </AppLayout>
  );
}
