/**
 * computeRiskAssessment - Pure function to assess transaction risks
 * 
 * PURE FUNCTION - No side effects, deterministic
 */

import { Transaction } from '@/types/finance';
import { 
  RiskAssessment, 
  OverdueExpense, 
  CoverageRiskExpense 
} from './types';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { logger } from './logger';

export interface RiskAssessmentInput {
  transactions: Transaction[];
  realizedBalance: number;
  projectedBalance: number;
  referenceDate?: Date;
}

/**
 * Compute risk assessment from transactions
 * 
 * @param input - Transactions and balance information
 * @returns RiskAssessment with overdue and coverage risk lists
 */
export function computeRiskAssessment(input: RiskAssessmentInput): RiskAssessment {
  const { 
    transactions, 
    realizedBalance, 
    projectedBalance,
    referenceDate = new Date() 
  } = input;
  
  const today = startOfDay(referenceDate);
  const isNegative = projectedBalance < 0;
  
  logger.risk('Computing risk assessment', { 
    transactionCount: transactions.length,
    realizedBalance,
    projectedBalance,
  });
  
  // ========================================
  // OVERDUE EXPENSES
  // ========================================
  const overdueExpenses: OverdueExpense[] = transactions
    .filter(t => {
      if (t.status !== 'planned' || t.kind !== 'EXPENSE') return false;
      const dueDate = t.due_date ? parseISO(t.due_date) : parseISO(t.date);
      return dueDate < today;
    })
    .map(tx => {
      const dueDate = tx.due_date ? parseISO(tx.due_date) : parseISO(tx.date);
      const daysOverdue = differenceInDays(today, dueDate);
      
      return {
        id: tx.id,
        description: tx.description || 'Despesa',
        daysOverdue,
        amount: Number(tx.amount),
        subcategoryName: tx.subcategory?.name,
        categoryName: tx.category?.name,
      };
    });
  
  const hasOverdueExpenses = overdueExpenses.length > 0;
  
  // ========================================
  // COVERAGE RISK EXPENSES
  // Only evaluate if no overdue and not already negative
  // ========================================
  const shouldCheckCoverageRisk = !hasOverdueExpenses && !isNegative;
  
  const coverageRiskExpenses: CoverageRiskExpense[] = shouldCheckCoverageRisk
    ? transactions
        .filter(t => {
          if (t.status !== 'planned' || t.kind !== 'EXPENSE') return false;
          
          const dueDate = t.due_date ? parseISO(t.due_date) : parseISO(t.date);
          const daysUntilDue = differenceInDays(dueDate, today);
          
          // Must be due in 1-7 days
          if (daysUntilDue < 1 || daysUntilDue > 7) return false;
          
          // Amount must exceed current balance
          const amount = Number(t.amount);
          if (amount <= realizedBalance) return false;
          
          return true;
        })
        .map(tx => {
          const dueDate = tx.due_date ? parseISO(tx.due_date) : parseISO(tx.date);
          const daysUntilDue = differenceInDays(dueDate, today);
          
          return {
            id: tx.id,
            description: tx.description || 'Despesa',
            daysUntilDue,
            amount: Number(tx.amount),
            subcategoryName: tx.subcategory?.name,
            categoryName: tx.category?.name,
          };
        })
    : [];
  
  const assessment: RiskAssessment = {
    overdueExpenses,
    hasOverdueExpenses,
    coverageRiskExpenses,
    hasCoverageRisk: coverageRiskExpenses.length > 0,
  };
  
  logger.risk('Risk assessment computed', {
    overdueCount: overdueExpenses.length,
    coverageRiskCount: coverageRiskExpenses.length,
  });
  
  return assessment;
}
