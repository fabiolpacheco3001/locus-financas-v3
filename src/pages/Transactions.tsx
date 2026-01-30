import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionHeader } from '@/components/transactions/TransactionHeader';
import { TransactionSummaryCards } from '@/components/transactions/TransactionSummaryCards';
import { TransactionTable, SortField, SortDirection } from '@/components/transactions/TransactionTable';
import { MoreFiltersContent } from '@/components/transactions/MoreFiltersContent';
import { ContextBarBadges } from '@/components/transactions/ContextBarBadges';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useMembers } from '@/hooks/useMembers';
import { useSimulation } from '@/hooks/useSimulation';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useBudgets } from '@/hooks/useBudgets';
import { useTransactionHandlers } from '@/hooks/useTransactionHandlers';
import { useRecurrenceDetection } from '@/hooks/useRecurrenceDetection';
import { InstallmentActionDialog } from '@/components/transactions/InstallmentActionDialog';
import { PostponementSimulationDialog } from '@/components/transactions/PostponementSimulationDialog';
import { InstallmentSimulationDialog } from '@/components/transactions/InstallmentSimulationDialog';
import { SimulationBanner } from '@/components/transactions/SimulationBanner';
import { TransactionKind, TransactionStatus, ExpenseType, Transaction } from '@/types/finance';
import { PaymentMethod } from '@/types/creditCards';
import { useTransactionForm, TransactionFormDialog } from '@/components/transactions/TransactionForm';
import { ArrowLeftRight, Loader2, Check, CalendarClock } from 'lucide-react';
import { calculateMonthlyMetrics } from '@/lib/financeMetrics';
import { useLocale } from '@/i18n/useLocale';
import { toast } from 'sonner';

const PAGE_SIZE = 10; // Reduced from 20 for better mobile UX

export default function TransactionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, formatCurrency } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Core filter state
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [filterAccount, setFilterAccount] = useState<string | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState<string | undefined>(undefined);
  const [filterSubcategory, setFilterSubcategory] = useState<string | undefined>(undefined);
  const [filterKind, setFilterKind] = useState<TransactionKind | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'all'>('all');
  const [filterExpenseType, setFilterExpenseType] = useState<ExpenseType | undefined>(undefined);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<PaymentMethod | undefined>(undefined);
  const [showCancelled, setShowCancelled] = useState(false);
  
  // Draft filter state (for "More Filters" popover)
  const [draftFilterKind, setDraftFilterKind] = useState<TransactionKind | undefined>(undefined);
  const [draftFilterStatus, setDraftFilterStatus] = useState<TransactionStatus | 'all'>('all');
  const [draftFilterPaymentMethod, setDraftFilterPaymentMethod] = useState<PaymentMethod | undefined>(undefined);
  const [isMoreFiltersDrawerOpen, setIsMoreFiltersDrawerOpen] = useState(false);
  
  // Pagination & sorting
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // URL-based view state
  const urlView = searchParams.get('view');
  const urlFilter = searchParams.get('filter');
  const urlCategoryId = searchParams.get('category');
  const urlSubcategoryId = searchParams.get('subcategory');
  const urlMonth = searchParams.get('month');
  const urlTransactionId = searchParams.get('id');
  const urlPeriod = searchParams.get('period'); // 'overdue' | 'today' | 'week'
  const urlStatus = searchParams.get('status'); // 'planned' | 'confirmed' | 'all'
  const urlAction = searchParams.get('action'); // 'new' for opening form
  
  const isOverdueView = urlView === 'overdue' || urlFilter === 'overdue' || urlPeriod === 'overdue';
  const isTodayView = urlPeriod === 'today';
  const isWeekView = urlPeriod === 'week';
  const isMonthPendingView = urlView === 'month_pending';
  const isSingleTransactionView = urlView === 'single' && !!urlTransactionId;
  
  // Handle URL action to open new transaction dialog (from mobile bottom nav)
  useEffect(() => {
    if (urlAction === 'new') {
      transactionForm.openNewDialog();
      setSearchParams({}, { replace: true });
    }
  }, [urlAction]);
  
  // Late pattern filter
  const [filterLatePattern, setFilterLatePattern] = useState(false);
  const [latePatternCategoryId, setLatePatternCategoryId] = useState<string | null>(null);
  const [latePatternSubcategoryId, setLatePatternSubcategoryId] = useState<string | null>(null);
  
  // Dialogs state
  const [isConfirmAllDialogOpen, setIsConfirmAllDialogOpen] = useState(false);
  const [bulkConfirmType, setBulkConfirmType] = useState<'incomes' | 'expenses'>('incomes');
  const [postponementDialogOpen, setPostponementDialogOpen] = useState(false);
  const [postponementTransaction, setPostponementTransaction] = useState<Transaction | null>(null);
  const [installmentSimDialogOpen, setInstallmentSimDialogOpen] = useState(false);
  const [installmentSimTransaction, setInstallmentSimTransaction] = useState<Transaction | null>(null);
  
  // Animation state
  const [aPagarAnimating, setAPagarAnimating] = useState(false);
  const prevAPagarRef = useRef<number | null>(null);

  // ========== Data Hooks ==========
  const isSpecialPeriodView = isOverdueView || isTodayView || isWeekView;
  const { transactions, isLoading, createTransaction, updateTransaction, deleteTransaction, confirmTransaction, confirmAllPlannedIncomes, confirmAllPlannedExpenses } = useTransactions({
    month: isSpecialPeriodView || isSingleTransactionView ? undefined : selectedMonth,
    accountId: isSingleTransactionView ? undefined : filterAccount,
    categoryId: isSingleTransactionView ? undefined : filterCategory,
    subcategoryId: isSingleTransactionView ? undefined : filterSubcategory,
    kind: isSingleTransactionView ? undefined : filterKind,
    status: isSingleTransactionView ? 'all' : filterStatus,
    includeCancelled: showCancelled,
    overdueOnly: isOverdueView,
    todayOnly: isTodayView,
    weekOnly: isWeekView,
    singleTransactionId: isSingleTransactionView ? urlTransactionId : undefined,
  });
  
  const { accounts, isLoading: isLoadingAccounts, refetchAccounts } = useAccounts();
  const { categories, activeCategories } = useCategories();
  const { members } = useMembers();
  const { creditCards } = useCreditCards(selectedMonth);
  const { budgets } = useBudgets(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1);
  
  // Transaction form hook
  const transactionForm = useTransactionForm({ 
    accounts, 
    categories, 
    activeCategories, 
    creditCards,
    isLoadingAccounts,
    refetchAccounts,
  });
  
  // Transaction handlers hook
  const handlers = useTransactionHandlers({
    transactionForm: transactionForm as any,
    accounts,
    categories: activeCategories,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    confirmTransaction,
  });

  // Recurrence detection
  const { pattern: recurrencePattern } = useRecurrenceDetection({
    description: handlers.lastSavedTransaction?.description || '',
    categoryId: handlers.lastSavedTransaction?.category_id,
    subcategoryId: handlers.lastSavedTransaction?.subcategory_id,
    amount: handlers.lastSavedTransaction?.amount || 0,
    enabled: handlers.showRecurrenceSuggestion && !!handlers.lastSavedTransaction,
  });

  // Simulation hook
  const { comparison, startPostponementSimulation, startInstallmentSimulation, startDeletionSimulation, clearSimulation, isSimulating } = useSimulation({
    accounts: accounts as any,
    transactionsBase: transactions,
    budgets,
    categories,
    selectedMonth,
  });

  // ========== Computed Values (before early returns) ==========
  const sortedTransactions = useMemo(() => {
    let filtered = [...transactions];
    if (filterExpenseType) filtered = filtered.filter(tx => tx.expense_type === filterExpenseType);
    if (filterPaymentMethod) filtered = filtered.filter(tx => tx.payment_method === filterPaymentMethod);
    
    return filtered.sort((a, b) => {
      let cmp = 0;
      
      switch (sortField) {
        case 'date': cmp = a.date.localeCompare(b.date); break;
        case 'category': cmp = (a.category?.name || '').localeCompare(b.category?.name || '', 'pt-BR'); break;
        case 'description': cmp = (a.description || '').localeCompare(b.description || '', 'pt-BR'); break;
        case 'kind': cmp = a.kind.localeCompare(b.kind); break;
        case 'amount': cmp = Number(a.amount) - Number(b.amount); break;
      }
      const result = sortDirection === 'asc' ? cmp : -cmp;
      return result === 0 ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime() : result;
    });
  }, [transactions, sortField, sortDirection, filterExpenseType, filterPaymentMethod]);
  
  const displayedTransactions = useMemo(() => sortedTransactions.slice(0, displayCount), [sortedTransactions, displayCount]);
  const hasSegmentingFilter = !!(filterCategory || filterSubcategory);
  
  const totals = useMemo(() => {
    const metrics = calculateMonthlyMetrics(transactions, selectedMonth);
    return {
      incomeRealized: metrics.incomeRealized,
      incomePlanned: metrics.incomePlanned,
      expenseRealized: metrics.expenseRealized,
      expensePlanned: metrics.aPagarMes,
      saldoMes: metrics.saldoMes,
      aPagarMes: metrics.aPagarMes,
      saldoPrevistoMes: metrics.saldoPrevistoMes,
      plannedIncomeCount: metrics.plannedIncomeCount,
      plannedExpenseCount: metrics.plannedExpenseCount,
      showTotalFiltered: hasSegmentingFilter && metrics.incomeRealized === 0 && metrics.incomePlanned === 0,
    };
  }, [transactions, selectedMonth, hasSegmentingFilter]);

  // Available balance derived from database-calculated account balances (Database-First SSoT)
  const availableBalance = useMemo(() => {
    if (!accounts.length) {
      return { saldoDisponivel: totals.saldoMes, transfersToReserve: 0, transfersFromReserve: 0, baseBalance: totals.saldoMes };
    }
    // Sum balances from non-reserve accounts (operational cash)
    const operationalAccounts = accounts.filter(a => !a.is_reserve);
    const saldoDisponivel = operationalAccounts.reduce((sum, a) => sum + (a.calculated_balance ?? a.current_balance ?? 0), 0);
    return { saldoDisponivel, transfersToReserve: 0, transfersFromReserve: 0, baseBalance: saldoDisponivel };
  }, [accounts, totals.saldoMes]);

  // ========== Effects ==========
  useEffect(() => { setDisplayCount(PAGE_SIZE); }, [selectedMonth, filterAccount, filterCategory, filterSubcategory, filterKind, filterStatus, filterExpenseType, isOverdueView, isTodayView, isWeekView, showCancelled]);

  // Handle URL-based period filters (overdue, today, week)
  useEffect(() => {
    if (isOverdueView) {
      setFilterKind('EXPENSE'); setFilterStatus('planned'); setSortField('date'); setSortDirection('asc');
      setFilterCategory(undefined); setFilterSubcategory(undefined); setFilterLatePattern(false);
      if (urlFilter === 'overdue' && urlView !== 'overdue') setSearchParams({ period: 'overdue' }, { replace: true });
    } else if (isTodayView) {
      setFilterKind('EXPENSE'); setFilterStatus('planned'); setSortField('date'); setSortDirection('asc');
      setFilterCategory(undefined); setFilterSubcategory(undefined); setFilterLatePattern(false);
    } else if (isWeekView) {
      setFilterKind('EXPENSE'); setFilterStatus('planned'); setSortField('date'); setSortDirection('asc');
      setFilterCategory(undefined); setFilterSubcategory(undefined); setFilterLatePattern(false);
    } else if (isMonthPendingView && urlMonth) {
      const [year, month] = urlMonth.split('-').map(Number);
      if (year && month) setSelectedMonth(new Date(year, month - 1, 1));
      setFilterKind('EXPENSE'); setFilterStatus('planned'); setSortField('date'); setSortDirection('asc');
    } else if (isSingleTransactionView) {
      setFilterKind(undefined); setFilterStatus('all'); setFilterCategory(undefined); setFilterSubcategory(undefined);
    } else if (urlStatus === 'planned') {
      // Apply status filter from URL
      setFilterStatus('planned');
    }
  }, [isOverdueView, isTodayView, isWeekView, isMonthPendingView, isSingleTransactionView, urlMonth, urlFilter, urlView, urlStatus, setSearchParams]);

  useEffect(() => {
    if (urlFilter === 'late_pattern' && urlCategoryId) {
      setFilterLatePattern(true); setLatePatternCategoryId(urlCategoryId); setLatePatternSubcategoryId(urlSubcategoryId);
      setFilterKind('EXPENSE'); setSortField('date'); setSortDirection('desc'); setFilterCategory(urlCategoryId);
      if (urlSubcategoryId) setFilterSubcategory(urlSubcategoryId);
      setTimeout(() => setSearchParams({}, { replace: true }), 0);
    }
  }, [urlFilter, urlCategoryId, urlSubcategoryId, setSearchParams]);

  useEffect(() => {
    if (prevAPagarRef.current !== null && totals.aPagarMes < prevAPagarRef.current) {
      setAPagarAnimating(true);
      const timer = setTimeout(() => setAPagarAnimating(false), 600);
      return () => clearTimeout(timer);
    }
    prevAPagarRef.current = totals.aPagarMes;
  }, [totals.aPagarMes]);

  // ========== Callbacks (must be before early returns) ==========
  const onClearView = useCallback(() => {
    setFilterKind(undefined); setFilterStatus('all'); setSortField('date'); setSortDirection('desc');
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const onClearLatePattern = useCallback(() => {
    setFilterLatePattern(false); setLatePatternCategoryId(null); setLatePatternSubcategoryId(null);
    setFilterCategory(undefined); setFilterSubcategory(undefined); setFilterKind(undefined);
    setSortField('date'); setSortDirection('desc');
  }, []);

  // ========== Early Returns ==========
  if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  // ========== Derived handlers (after early returns) ==========
  const hasMore = sortedTransactions.length > displayCount;
  const handleLoadMore = () => setDisplayCount(prev => prev + PAGE_SIZE);
  const handleSort = (field: SortField) => {
    setSortDirection(prev => sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortField(field);
    setDisplayCount(PAGE_SIZE);
  };

  // ========== Render ==========
  return (
    <AppLayout>
      <TransactionHeader
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        onNewTransaction={transactionForm.openNewDialog}
        accounts={accounts.filter(a => a.id).map(a => ({ id: a.id, name: a.name }))}
        filterAccount={filterAccount}
        onAccountChange={setFilterAccount}
        categories={categories.filter(c => c.id).map(c => ({ id: c.id, name: c.name, subcategories: c.subcategories?.map(s => ({ id: s.id, name: s.name })) }))}
        filterCategory={filterCategory}
        onCategoryChange={setFilterCategory}
        filterSubcategory={filterSubcategory}
        onSubcategoryChange={setFilterSubcategory}
        showCancelled={showCancelled}
        onShowCancelledChange={setShowCancelled}
        moreFiltersContent={
          <MoreFiltersContent
            draftFilterKind={draftFilterKind}
            setDraftFilterKind={setDraftFilterKind}
            draftFilterStatus={draftFilterStatus}
            setDraftFilterStatus={setDraftFilterStatus}
            draftFilterPaymentMethod={draftFilterPaymentMethod}
            setDraftFilterPaymentMethod={setDraftFilterPaymentMethod}
            showCancelled={showCancelled}
          />
        }
        hasActiveMoreFilters={filterKind !== undefined || filterStatus !== 'all' || filterPaymentMethod !== undefined}
        isMoreFiltersOpen={isMoreFiltersDrawerOpen}
        onMoreFiltersOpenChange={(open) => {
          if (open) { setDraftFilterKind(filterKind); setDraftFilterStatus(filterStatus); setDraftFilterPaymentMethod(filterPaymentMethod); }
          setIsMoreFiltersDrawerOpen(open);
        }}
        onApplyMoreFilters={() => { setFilterKind(draftFilterKind); setFilterStatus(draftFilterStatus); setFilterPaymentMethod(draftFilterPaymentMethod); setDisplayCount(PAGE_SIZE); }}
        onClearMoreFilters={() => { setDraftFilterKind(undefined); setDraftFilterStatus('all'); setDraftFilterPaymentMethod(undefined); setFilterKind(undefined); setFilterStatus('all'); setFilterPaymentMethod(undefined); }}
        onClearAllFilters={() => { setFilterAccount(undefined); setFilterCategory(undefined); setFilterSubcategory(undefined); }}
        pendingExpenseCount={totals.plannedExpenseCount}
        pendingIncomeCount={totals.plannedIncomeCount}
        onConfirmExpenses={() => { setBulkConfirmType('expenses'); setIsConfirmAllDialogOpen(true); }}
        onConfirmIncomes={() => { setBulkConfirmType('incomes'); setIsConfirmAllDialogOpen(true); }}
        contextBar={
          <ContextBarBadges
            isOverdueView={isOverdueView}
            isTodayView={isTodayView}
            isWeekView={isWeekView}
            isMonthPendingView={isMonthPendingView}
            isSingleTransactionView={isSingleTransactionView}
            filterLatePattern={filterLatePattern}
            latePatternCategoryId={latePatternCategoryId}
            latePatternSubcategoryId={latePatternSubcategoryId}
            transactions={transactions}
            categories={categories}
            onClearOverdueView={onClearView}
            onClearTodayView={onClearView}
            onClearWeekView={onClearView}
            onClearMonthPendingView={onClearView}
            onClearSingleTransactionView={onClearView}
            onClearLatePattern={onClearLatePattern}
          />
        }
      />

      <TransactionSummaryCards
        data={{ incomeRealized: totals.incomeRealized, expenseRealized: totals.expenseRealized, saldoDisponivel: availableBalance.saldoDisponivel, aPagarMes: totals.aPagarMes, saldoPrevistoMes: totals.saldoPrevistoMes, plannedExpenseCount: totals.plannedExpenseCount, showTotalFiltered: totals.showTotalFiltered }}
        isAnimatingAPagar={aPagarAnimating}
        hasSegmentingFilter={hasSegmentingFilter}
      />

      {isSimulating && comparison && <SimulationBanner description={t('simulation.description')} comparison={comparison} onClear={clearSimulation} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : transactions.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title={t('transactions.empty.title')} description={t('transactions.empty.description')} actionLabel={t('transactions.new')} onAction={transactionForm.openNewDialog} />
      ) : (
        <TransactionTable
          transactions={displayedTransactions}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onEdit={handlers.handleOpenEditDialog}
          onDelete={handlers.handleDelete}
          onDuplicate={transactionForm.openDuplicateDialog}
          onConfirm={handlers.handleConfirm}
          onPostpone={(tx) => { setPostponementTransaction(tx); setPostponementDialogOpen(true); }}
          onSimulateInstallments={(tx) => { setInstallmentSimTransaction(tx); setInstallmentSimDialogOpen(true); }}
          onSimulateDeletion={startDeletionSimulation}
        />
      )}

      {!isLoading && transactions.length > 0 && hasMore && (
        <div className="flex flex-col items-center gap-2 py-4 border-t border-border">
          <p className="text-sm text-muted-foreground">{t('transactions.pagination.showing', { displayed: displayedTransactions.length, total: sortedTransactions.length })}</p>
          <Button variant="outline" onClick={handleLoadMore}>{t('common.loadMore')} ({t('common.remaining', { count: sortedTransactions.length - displayedTransactions.length })})</Button>
        </div>
      )}

      {/* Form Dialog */}
      <TransactionFormDialog
        open={transactionForm.isDialogOpen} onOpenChange={transactionForm.setIsDialogOpen} editingId={transactionForm.editingId}
        form={transactionForm.form}
        submitTransaction={transactionForm.submitTransaction}
        formKind={transactionForm.formKind} setFormKind={transactionForm.setFormKind}
        formAccountId={transactionForm.formAccountId} setFormAccountId={transactionForm.setFormAccountId}
        formToAccountId={transactionForm.formToAccountId} setFormToAccountId={transactionForm.setFormToAccountId}
        formCategoryId={transactionForm.formCategoryId} setFormCategoryId={transactionForm.setFormCategoryId}
        formSubcategoryId={transactionForm.formSubcategoryId} setFormSubcategoryId={transactionForm.setFormSubcategoryId}
        formAmount={transactionForm.formAmount} setFormAmount={transactionForm.setFormAmount}
        formDate={transactionForm.formDate} setFormDate={transactionForm.setFormDate}
        formDescription={transactionForm.formDescription} setFormDescription={transactionForm.setFormDescription}
        formMemberId={transactionForm.formMemberId} setFormMemberId={transactionForm.setFormMemberId}
        formIsPlanned={transactionForm.formIsPlanned} setFormIsPlanned={transactionForm.setFormIsPlanned}
        
        isEditingConfirmed={transactionForm.isEditingConfirmed} isEditingPastMonth={transactionForm.isEditingPastMonth} isFieldsLocked={transactionForm.isFieldsLocked}
        formIsInstallment={transactionForm.formIsInstallment} setFormIsInstallment={transactionForm.setFormIsInstallment}
        formInstallmentCount={transactionForm.formInstallmentCount} setFormInstallmentCount={transactionForm.setFormInstallmentCount}
        formInstallmentDueDate={transactionForm.formInstallmentDueDate} setFormInstallmentDueDate={transactionForm.setFormInstallmentDueDate}
        formIsRecurring={transactionForm.formIsRecurring} setFormIsRecurring={transactionForm.setFormIsRecurring}
        formRecurringStartMonth={transactionForm.formRecurringStartMonth} setFormRecurringStartMonth={transactionForm.setFormRecurringStartMonth}
        formRecurringEndMonth={transactionForm.formRecurringEndMonth} setFormRecurringEndMonth={transactionForm.setFormRecurringEndMonth}
        formHasEndMonth={transactionForm.formHasEndMonth} setFormHasEndMonth={transactionForm.setFormHasEndMonth}
        formDayOfMonth={transactionForm.formDayOfMonth} setFormDayOfMonth={transactionForm.setFormDayOfMonth}
        formPaymentMethod={transactionForm.formPaymentMethod} setFormPaymentMethod={transactionForm.setFormPaymentMethod}
        formCreditCardId={transactionForm.formCreditCardId} setFormCreditCardId={transactionForm.setFormCreditCardId}
        accounts={accounts} selectableCategories={transactionForm.selectableCategories} selectableSubcategories={transactionForm.selectableSubcategories}
        members={members} creditCards={creditCards} budgetWarning={transactionForm.budgetWarning}
        descriptionSuggestions={transactionForm.descriptionSuggestions} categorySuggestion={transactionForm.categorySuggestion} showCategorySuggestion={transactionForm.showCategorySuggestion}
        amountInputRef={transactionForm.amountInputRef} justSavedTransaction={transactionForm.justSavedTransaction}
        onCreateSimilar={transactionForm.handleCreateSimilar} onClose={transactionForm.closeDialog}
      />

      {/* Confirmation Dialog */}
      <AlertDialog open={handlers.isConfirmDialogOpen} onOpenChange={handlers.setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('transactions.confirmDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{handlers.getConfirmationMessage(categories)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handlers.setPendingTransactionData(null)}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handlers.handleConfirmSave}>{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recurrence Suggestion Dialog */}
      <AlertDialog open={handlers.showRecurrenceSuggestion && !!recurrencePattern} onOpenChange={(open) => { if (!open) handlers.clearRecurrenceSuggestion(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><CalendarClock className="h-5 w-5 text-primary" /></div>
              <AlertDialogTitle>{t('transactions.recurrence.title')}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2">
              <p>{t('transactions.recurrence.detected', { description: recurrencePattern?.description, count: recurrencePattern?.occurrences })}</p>
              <p className="text-xs text-muted-foreground">{t('transactions.recurrence.months')}: {recurrencePattern?.months.slice(0, 4).join(', ')}{(recurrencePattern?.months.length || 0) > 4 && '...'}</p>
              <p className="mt-4">{t('transactions.recurrence.createPrompt')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handlers.clearRecurrenceSuggestion}>{t('transactions.recurrence.noThanks')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { handlers.clearRecurrenceSuggestion(); toast.info(t('transactions.recurrence.comingSoon')); }}>{t('transactions.recurrence.create')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Confirm Dialog */}
      <AlertDialog open={isConfirmAllDialogOpen} onOpenChange={setIsConfirmAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bulkConfirmType === 'expenses' ? t('transactions.bulkConfirm.expensesTitle') : t('transactions.bulkConfirm.incomesTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkConfirmType === 'expenses' ? (
                <>{t('transactions.bulkConfirm.expensesMessage', { count: totals.plannedExpenseCount, amount: formatCurrency(totals.expensePlanned) })}<br /><br />{t('transactions.bulkConfirm.expensesEffect')}</>
              ) : (
                <>{t('transactions.bulkConfirm.incomesMessage', { count: totals.plannedIncomeCount, amount: formatCurrency(totals.incomePlanned) })}<br /><br />{t('transactions.bulkConfirm.incomesEffect')}</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { try { if (bulkConfirmType === 'expenses') await confirmAllPlannedExpenses.mutateAsync(selectedMonth); else await confirmAllPlannedIncomes.mutateAsync(selectedMonth); setIsConfirmAllDialogOpen(false); } catch {} }}
              disabled={bulkConfirmType === 'expenses' ? confirmAllPlannedExpenses.isPending : confirmAllPlannedIncomes.isPending}
              className={bulkConfirmType === 'expenses' ? 'bg-amber-600 hover:bg-amber-700' : ''}
            >
              {(bulkConfirmType === 'expenses' ? confirmAllPlannedExpenses.isPending : confirmAllPlannedIncomes.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {t('transactions.actions.confirmAll')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Installment Action Dialog */}
      <InstallmentActionDialog
        open={handlers.installmentActionDialogOpen}
        onOpenChange={handlers.setInstallmentActionDialogOpen}
        actionType={handlers.installmentActionType}
        installmentNumber={handlers.pendingInstallmentAction?.installment_number ?? 1}
        installmentTotal={handlers.pendingInstallmentAction?.installment_total ?? 1}
        onSelectScope={(scope) => scope === 'single' || scope === 'this_and_future' ? (handlers.installmentActionType === 'edit' ? handlers.handleInstallmentEditScope(scope) : handlers.handleInstallmentDeleteScope(scope)) : null}
      />

      {/* Simulation Dialogs */}
      <PostponementSimulationDialog open={postponementDialogOpen} onOpenChange={setPostponementDialogOpen} transaction={postponementTransaction} onSimulate={(newDueDate) => { if (postponementTransaction) startPostponementSimulation(postponementTransaction, newDueDate); }} />
      <InstallmentSimulationDialog open={installmentSimDialogOpen} onOpenChange={setInstallmentSimDialogOpen} transaction={installmentSimTransaction} onSimulate={(count) => { if (installmentSimTransaction) startInstallmentSimulation(installmentSimTransaction, count); }} />
    </AppLayout>
  );
}
