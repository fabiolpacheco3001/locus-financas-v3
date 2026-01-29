import { useState, useMemo, useCallback, useEffect } from 'react';
import { format, getMonth, getYear } from 'date-fns';
import { toast } from 'sonner';
import { useLocale } from '@/i18n/useLocale';
import { useBudgets } from '@/hooks/useBudgets';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useRecurringBudgets } from '@/hooks/useRecurringBudgets';
import type { RecurringBudget } from '@/types/finance';

export type BudgetTab = 'monthly' | 'recurrences';

interface SubcategoryBudgetData {
  id: string;
  name: string;
  planned: number;
  savedPlanned: number;
  actual: number;
  categoryId: string;
  fromRecurring: boolean;
}

export interface CategoryBudgetData {
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

export function useBudgetPageState() {
  const { t } = useLocale();
  
  // Month selection
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const year = getYear(selectedMonth);
  const month = getMonth(selectedMonth) + 1;

  // Tab state
  const [activeTab, setActiveTab] = useState<BudgetTab>('monthly');
  
  // Pending edits for real-time validation
  const [pendingEdits, setPendingEdits] = useState<Record<string, number | undefined>>({});
  
  // Expanded categories
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  
  // Recurring dialog state
  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);
  const [recurringCategoryId, setRecurringCategoryId] = useState<string>('');
  const [recurringSubcategoryId, setRecurringSubcategoryId] = useState<string>('');
  const [recurringAmount, setRecurringAmount] = useState<number | undefined>(undefined);
  const [recurringStartMonth, setRecurringStartMonth] = useState('');
  const [recurringEndMonth, setRecurringEndMonth] = useState('');
  
  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [recurringToDelete, setRecurringToDelete] = useState<RecurringBudget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Data hooks
  const { budgets, isLoading: budgetsLoading, upsertBudget } = useBudgets(year, month);
  const { transactions, isLoading: transactionsLoading } = useTransactions({ month: selectedMonth });
  const { budgetCategories, isLoading: categoriesLoading } = useCategories();
  const { 
    recurringBudgets, 
    isLoading: recurringLoading, 
    createRecurringBudget, 
    deleteRecurringBudget,
    getRecurringBudgetFor,
    ensureBudgetsForMonth 
  } = useRecurringBudgets();

  const isLoading = budgetsLoading || transactionsLoading || categoriesLoading || recurringLoading;

  // Ensure budgets are generated for the selected month
  useEffect(() => {
    if (recurringBudgets.length > 0) {
      ensureBudgetsForMonth(year, month);
    }
  }, [year, month, recurringBudgets.length, ensureBudgetsForMonth]);

  // Toggle category expansion
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  }, []);

  // Reset recurring dialog form
  const resetRecurringForm = useCallback((categoryId?: string, subcategoryId?: string) => {
    setRecurringCategoryId(categoryId || '');
    setRecurringSubcategoryId(subcategoryId || '');
    setRecurringAmount(undefined);
    setRecurringStartMonth(format(selectedMonth, 'yyyy-MM'));
    setRecurringEndMonth('');
  }, [selectedMonth]);

  // Open recurring dialog
  const openRecurringDialog = useCallback((categoryId?: string, subcategoryId?: string) => {
    resetRecurringForm(categoryId, subcategoryId);
    setIsRecurringDialogOpen(true);
  }, [resetRecurringForm]);

  // Handle create recurring
  const handleCreateRecurring = useCallback(async () => {
    if (!recurringCategoryId || !recurringAmount || !recurringStartMonth) {
      toast.error(t('budget.validation.fillRequired'));
      return;
    }

    try {
      await createRecurringBudget.mutateAsync({
        category_id: recurringCategoryId,
        subcategory_id: recurringSubcategoryId || null,
        amount: recurringAmount,
        start_month: recurringStartMonth,
        end_month: recurringEndMonth || null
      });

      setIsRecurringDialogOpen(false);
      resetRecurringForm();
    } catch {
      // Error already handled by mutation
    }
  }, [recurringCategoryId, recurringSubcategoryId, recurringAmount, recurringStartMonth, recurringEndMonth, createRecurringBudget, resetRecurringForm, t]);

  // Open delete dialog
  const openDeleteDialog = useCallback((rb: RecurringBudget) => {
    setRecurringToDelete(rb);
    setIsDeleteDialogOpen(true);
  }, []);

  // Handle confirm delete
  const handleConfirmDelete = useCallback(async (recurringId: string, fromMonth: string) => {
    setIsDeleting(true);
    try {
      await deleteRecurringBudget.mutateAsync({ id: recurringId, fromMonth });
      toast.success(t('budget.recurring.deleted'));
      setIsDeleteDialogOpen(false);
      setRecurringToDelete(null);
    } catch {
      // Error already handled
    } finally {
      setIsDeleting(false);
    }
  }, [deleteRecurringBudget, t]);

  // Handle input change for real-time validation
  const handleInputChange = useCallback((key: string, value: number | undefined) => {
    setPendingEdits(prev => ({ ...prev, [key]: value }));
  }, []);

  // Calculate actual expenses per category
  const actualByCategory = useMemo(() => {
    const result: Record<string, number> = {};
    transactions
      .filter(tx => tx.kind === 'EXPENSE' && tx.category_id)
      .forEach(tx => {
        const key = tx.subcategory_id || tx.category_id!;
        result[key] = (result[key] || 0) + Number(tx.amount);
      });
    return result;
  }, [transactions]);

  // Helper to get effective value
  const getEffectiveValue = useCallback((key: string, savedValue: number) => {
    return pendingEdits[key] !== undefined ? pendingEdits[key] : savedValue;
  }, [pendingEdits]);

  // Build budget data
  const budgetData = useMemo((): CategoryBudgetData[] => {
    return budgetCategories.map(category => {
      const categoryBudget = budgets.find(b => b.category_id === category.id && !b.subcategory_id);
      const savedCategoryPlanned = Number(categoryBudget?.planned_amount) || 0;
      const categoryPlanned = getEffectiveValue(`cat_${category.id}`, savedCategoryPlanned) ?? 0;
      const categoryFromRecurring = categoryBudget?.recurring_budget_id != null;
      
      const subcategoryData = (category.subcategories || []).map(sub => {
        const subBudget = budgets.find(b => b.subcategory_id === sub.id);
        const savedSubPlanned = Number(subBudget?.planned_amount) || 0;
        const subPlanned = getEffectiveValue(`sub_${sub.id}`, savedSubPlanned) ?? 0;
        const subActual = actualByCategory[sub.id] || 0;
        const subFromRecurring = subBudget?.recurring_budget_id != null;
        return {
          id: sub.id,
          name: sub.name,
          planned: subPlanned,
          savedPlanned: savedSubPlanned,
          actual: subActual,
          categoryId: category.id,
          fromRecurring: subFromRecurring,
        };
      });

      const subcategoriesPlannedSum = subcategoryData.reduce((sum, s) => sum + s.planned, 0);
      const effectivePlanned = categoryPlanned > 0 ? categoryPlanned : subcategoriesPlannedSum;
      const exceedsCeiling = categoryPlanned > 0 && subcategoriesPlannedSum > categoryPlanned;
      
      const categoryActual = actualByCategory[category.id] || 0;
      const subcategoriesActual = subcategoryData.reduce((sum, s) => sum + s.actual, 0);
      const totalActual = categoryActual + subcategoriesActual;

      return {
        id: category.id,
        name: category.name,
        categoryPlanned,
        savedCategoryPlanned,
        subcategoriesPlannedSum,
        planned: effectivePlanned,
        actual: totalActual,
        subcategories: subcategoryData,
        hasCategoryBudget: categoryPlanned > 0,
        exceedsCeiling,
        fromRecurring: categoryFromRecurring,
      };
    });
  }, [budgetCategories, budgets, actualByCategory, getEffectiveValue]);

  // Totals
  const totalPlanned = useMemo(() => 
    budgetData.reduce((sum, c) => sum + c.planned, 0), 
    [budgetData]
  );
  
  const totalActual = useMemo(() => 
    budgetData.reduce((sum, c) => sum + c.actual, 0), 
    [budgetData]
  );

  // Handle save with validation
  const handleBudgetSave = useCallback(async (
    categoryId: string, 
    subcategoryId: string | null, 
    value: number | undefined
  ) => {
    const amount = value ?? 0;
    const key = subcategoryId ? `sub_${subcategoryId}` : `cat_${categoryId}`;
    
    const category = budgetData.find(c => c.id === categoryId);
    if (!category) return;

    let newCategoryPlanned = category.categoryPlanned;
    let newSubcategoriesSum = category.subcategoriesPlannedSum;

    if (subcategoryId) {
      const oldSubValue = category.subcategories.find(s => s.id === subcategoryId)?.planned || 0;
      newSubcategoriesSum = category.subcategoriesPlannedSum - oldSubValue + amount;
    } else {
      newCategoryPlanned = amount;
    }

    if (newCategoryPlanned > 0 && newSubcategoriesSum > newCategoryPlanned) {
      toast.error(t('budget.validation.subcategoryExceedsCeiling'));
      return;
    }

    setPendingEdits(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    try {
      await upsertBudget.mutateAsync({
        category_id: categoryId,
        subcategory_id: subcategoryId,
        planned_amount: amount,
      });
    } catch {
      setPendingEdits(prev => ({ ...prev, [key]: amount }));
    }
  }, [budgetData, upsertBudget, t]);

  return {
    // Month
    selectedMonth,
    setSelectedMonth,
    year,
    month,

    // Tab
    activeTab,
    setActiveTab,

    // Loading
    isLoading,

    // Budget data
    budgetData,
    totalPlanned,
    totalActual,
    budgetCategories,

    // Pending edits
    pendingEdits,
    handleInputChange,
    handleBudgetSave,

    // Category expansion
    expandedCategories,
    toggleCategory,

    // Recurring budgets
    recurringBudgets,
    
    // Recurring dialog
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
    createRecurringBudgetPending: createRecurringBudget.isPending,

    // Delete dialog
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    recurringToDelete,
    openDeleteDialog,
    handleConfirmDelete,
    isDeleting,
  };
}
