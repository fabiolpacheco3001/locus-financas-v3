import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TransactionKind } from '@/types/finance';

interface BudgetWarning {
  type: 'no_budget' | 'exceeds_budget';
  message: string;
}

interface UseBudgetValidationProps {
  categoryId?: string;
  subcategoryId?: string;
  amount: number;
  /** The competence date - uses due_date for expenses, date as fallback */
  competenceDate: string;
  kind: TransactionKind;
  editingTransactionId?: string | null;
}

export function useBudgetValidation({
  categoryId,
  subcategoryId,
  amount,
  competenceDate,
  kind,
  editingTransactionId,
}: UseBudgetValidationProps) {
  const { householdId } = useAuth();

  // Parse month/year from competence date (due_date for expenses, or date as fallback)
  const effectiveDate = competenceDate ? new Date(competenceDate) : new Date();
  const year = effectiveDate.getFullYear();
  const month = effectiveDate.getMonth() + 1;

  // Fetch all budgets for the month (category and subcategory level)
  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', householdId, year, month],
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('household_id', householdId)
        .eq('year', year)
        .eq('month', month);
      
      if (error) throw error;
      return data;
    },
    enabled: !!householdId && !!categoryId && kind === 'EXPENSE',
  });

  // Fetch transactions for the month to calculate spent amount (for both category and subcategory)
  // Uses due_date for competence matching, with fallback to date for legacy transactions
  const { data: monthTransactions = [] } = useQuery({
    queryKey: ['transactions-budget-check', householdId, year, month, categoryId],
    queryFn: async () => {
      if (!householdId || !categoryId) return [];
      
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      // Query using due_date as primary, with fallback for transactions with null due_date
      const { data, error } = await supabase
        .from('transactions')
        .select('id, amount, category_id, subcategory_id, status, due_date, date')
        .eq('household_id', householdId)
        .eq('kind', 'EXPENSE')
        .eq('category_id', categoryId)
        .in('status', ['planned', 'confirmed'])
        .is('cancelled_at', null)
        .or(
          `and(due_date.gte.${startDate},due_date.lte.${endDate}),and(due_date.is.null,date.gte.${startDate},date.lte.${endDate})`
        );
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!householdId && !!categoryId && kind === 'EXPENSE',
  });

  const warning = useMemo<BudgetWarning | null>(() => {
    // Only validate for EXPENSE transactions
    if (kind !== 'EXPENSE' || !categoryId) {
      return null;
    }

    // Find category-level budget (subcategory_id = null)
    const categoryBudget = budgets.find(b => 
      b.category_id === categoryId && !b.subcategory_id
    );
    const categoryPlanned = Number(categoryBudget?.planned_amount) || 0;

    // Find subcategory-level budget if subcategory is selected
    const subcategoryBudget = subcategoryId 
      ? budgets.find(b => b.subcategory_id === subcategoryId)
      : null;
    const subcategoryPlanned = Number(subcategoryBudget?.planned_amount) || 0;

    // Calculate sum of all subcategory budgets for this category
    const subcategoriesBudgets = budgets.filter(b => 
      b.category_id === categoryId && b.subcategory_id
    );
    const subcategoriesSum = subcategoriesBudgets.reduce(
      (sum, b) => sum + Number(b.planned_amount), 0
    );

    // Determine which budget to validate against (hybrid mode):
    // 1. If subcategory has a budget > 0, validate against subcategory
    // 2. Else if category has a ceiling > 0, validate against category ceiling
    // 3. Else if sum of subcategories > 0, validate against sum
    // 4. If no budget defined, no alert
    
    let effectiveBudget = 0;
    let budgetLabel = '';
    
    if (subcategoryPlanned > 0) {
      effectiveBudget = subcategoryPlanned;
      budgetLabel = 'subcategoria';
    } else if (categoryPlanned > 0) {
      effectiveBudget = categoryPlanned;
      budgetLabel = 'categoria';
    } else if (subcategoriesSum > 0) {
      effectiveBudget = subcategoriesSum;
      budgetLabel = 'categoria (soma)';
    } else {
      // No budget defined at any level
      return {
        type: 'no_budget',
        message: 'Categoria sem orçamento definido para este mês.',
      };
    }

    // Calculate spent amount based on the budget level we're validating
    let spentAmount = 0;
    
    if (subcategoryPlanned > 0 && subcategoryId) {
      // Validate against subcategory: only count transactions for this subcategory
      spentAmount = monthTransactions
        .filter(t => t.subcategory_id === subcategoryId)
        .filter(t => editingTransactionId ? t.id !== editingTransactionId : true)
        .reduce((sum, t) => sum + Number(t.amount), 0);
    } else {
      // Validate against category: count all transactions for this category
      spentAmount = monthTransactions
        .filter(t => editingTransactionId ? t.id !== editingTransactionId : true)
        .reduce((sum, t) => sum + Number(t.amount), 0);
    }

    const availableBudget = effectiveBudget - spentAmount;

    // Check if amount exceeds available budget
    if (amount > 0 && amount > availableBudget) {
      return {
        type: 'exceeds_budget',
        message: `Este lançamento ultrapassa o orçamento da ${budgetLabel}.`,
      };
    }

    return null;
  }, [budgets, monthTransactions, categoryId, subcategoryId, amount, kind, editingTransactionId]);

  return { warning };
}
