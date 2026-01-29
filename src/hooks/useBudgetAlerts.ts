import { useMemo } from 'react';
import { Transaction, Budget, Category } from '@/types/finance';

export interface BudgetAlert {
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  budgetAmount: number;
  realizedAmount: number;
  pendingAmount: number;
  totalAmount: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'over';
}

export function useBudgetAlerts(
  transactions: Transaction[],
  budgets: Budget[],
  categories: Category[]
) {
  const alerts = useMemo(() => {
    if (!budgets.length || !transactions.length) return [];

    const budgetAlerts: BudgetAlert[] = [];

    budgets.forEach((budget) => {
      if (Number(budget.planned_amount) === 0) return;

      const category = categories.find((c) => c.id === budget.category_id);
      if (!category) return;

      // Get transactions for this budget (category + optional subcategory)
      const relevantTransactions = transactions.filter((t) => {
        if (t.kind !== 'EXPENSE') return false;
        if (t.category_id !== budget.category_id) return false;
        if (budget.subcategory_id && t.subcategory_id !== budget.subcategory_id) return false;
        return true;
      });

      const realizedAmount = relevantTransactions
        .filter((t) => t.status === 'confirmed')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const pendingAmount = relevantTransactions
        .filter((t) => t.status === 'planned')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalAmount = realizedAmount + pendingAmount;
      const budgetAmount = Number(budget.planned_amount);
      const percentUsed = budgetAmount > 0 ? (totalAmount / budgetAmount) * 100 : 0;

      // Only include if over budget or close to it
      if (percentUsed >= 80) {
        const subcategory = budget.subcategory_id
          ? category.subcategories?.find((s) => s.id === budget.subcategory_id)
          : null;

        budgetAlerts.push({
          categoryId: budget.category_id,
          categoryName: category.name,
          subcategoryId: budget.subcategory_id,
          subcategoryName: subcategory?.name || null,
          budgetAmount,
          realizedAmount,
          pendingAmount,
          totalAmount,
          percentUsed,
          status: percentUsed > 100 ? 'over' : 'warning',
        });
      }
    });

    // Sort by percentage used (highest first)
    return budgetAlerts.sort((a, b) => b.percentUsed - a.percentUsed);
  }, [transactions, budgets, categories]);

  const overBudgetCount = alerts.filter((a) => a.status === 'over').length;
  const warningCount = alerts.filter((a) => a.status === 'warning').length;

  return {
    alerts,
    overBudgetCount,
    warningCount,
    hasAlerts: alerts.length > 0,
  };
}
