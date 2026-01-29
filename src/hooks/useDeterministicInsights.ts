import { useMemo } from 'react';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { Transaction } from '@/types/finance';
import { AccountProjection, ProjectionTotals } from '@/lib/riskEngine';

export type InsightType = 
  | 'month_closes_negative'
  | 'days_in_red'
  | 'postpone_benefit'
  | 'pending_income_helps'
  | 'largest_pending_expense'
  | 'overdue_payments';

export type InsightSeverity = 'info' | 'warning' | 'critical';

/**
 * i18n-safe Insight interface.
 * Contains messageKey and params instead of pre-rendered text.
 * UI components must translate using t(messageKey, params).
 */
export interface DeterministicInsight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  /** i18n message key - translate at render time */
  messageKey: string;
  /** Parameters for interpolation - amounts are raw numbers */
  params: Record<string, unknown>;
  value?: number;
  /** i18n key for action hint */
  actionHintKey?: string;
}

interface InsightsInput {
  projections: AccountProjection[];
  totals: ProjectionTotals;
  transactions: Transaction[];
  selectedMonth: Date;
}

/**
 * Generates i18n-safe deterministic insights.
 * Returns messageKey + params instead of pre-rendered text.
 * UI must use t(messageKey, params) for translation.
 */
export function useDeterministicInsights({
  projections,
  totals,
  transactions,
  selectedMonth,
}: InsightsInput): DeterministicInsight[] {
  return useMemo(() => {
    const insights: DeterministicInsight[] = [];
    const today = startOfDay(new Date());
    
    const { projectedBalance, pendingExpenses, pendingIncome, realizedBalance } = totals;
    
    // Only generate insights if there's some risk (negative projection or high pending)
    const hasRisk = projectedBalance < 0 || (pendingExpenses > 0 && projectedBalance < pendingExpenses * 0.2);
    
    if (!hasRisk) {
      return insights;
    }

    // 1. Month closes negative
    if (projectedBalance < 0) {
      insights.push({
        id: 'month_closes_negative',
        type: 'month_closes_negative',
        severity: 'critical',
        messageKey: 'insights.month_closes_negative',
        params: { amount: Math.abs(projectedBalance) },
        value: projectedBalance,
      });
    }

    // 2. Days in red (if realized balance is already negative)
    if (realizedBalance < 0) {
      const confirmedExpenses = transactions
        .filter(t => t.kind === 'EXPENSE' && t.status === 'confirmed')
        .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
      
      if (confirmedExpenses.length > 0) {
        const firstNegativeDate = parseISO(confirmedExpenses[0].date);
        const daysInRed = differenceInDays(today, firstNegativeDate);
        
        if (daysInRed > 0) {
          insights.push({
            id: 'days_in_red',
            type: 'days_in_red',
            severity: 'warning',
            messageKey: 'insights.days_in_red',
            params: { days: daysInRed },
            value: daysInRed,
          });
        }
      }
    }

    // 3. Find largest pending expense and suggest postponement benefit
    const plannedExpenses = transactions.filter(
      t => t.kind === 'EXPENSE' && t.status === 'planned'
    );

    if (plannedExpenses.length > 0 && projectedBalance < 0) {
      const largestExpense = plannedExpenses.reduce((max, t) => 
        Number(t.amount) > Number(max.amount) ? t : max
      , plannedExpenses[0]);

      const potentialBalanceAfterPostpone = projectedBalance + Number(largestExpense.amount);
      const balances = potentialBalanceAfterPostpone >= 0;
      
      insights.push({
        id: 'postpone_benefit',
        type: 'postpone_benefit',
        severity: balances ? 'info' : 'warning',
        messageKey: balances ? 'insights.postpone_benefit.balances' : 'insights.postpone_benefit.reduces',
        params: {
          description: largestExpense.description || 'expense',
          amount: Number(largestExpense.amount),
          deficit: Math.abs(potentialBalanceAfterPostpone),
        },
        value: Number(largestExpense.amount),
        actionHintKey: 'insights.action_hint.postpone',
      });
    }

    // 4. Pending income that could help
    if (pendingIncome > 0 && projectedBalance < 0) {
      const balanceWithIncome = realizedBalance + pendingIncome - pendingExpenses;
      const balances = balanceWithIncome >= 0;
      
      insights.push({
        id: 'pending_income_helps',
        type: 'pending_income_helps',
        severity: 'info',
        messageKey: balances ? 'insights.pending_income_helps.balances' : 'insights.pending_income_helps.still_missing',
        params: {
          amount: pendingIncome,
          missing: Math.abs(balanceWithIncome),
        },
        value: pendingIncome,
      });
    }

    // 5. Overdue payments count
    const overduePayments = transactions.filter(t => {
      if (t.status !== 'planned' || t.kind !== 'EXPENSE') return false;
      const dueDate = t.due_date || t.date;
      return parseISO(dueDate) < today;
    });

    if (overduePayments.length > 0) {
      const totalOverdue = overduePayments.reduce((sum, t) => sum + Number(t.amount), 0);
      
      insights.push({
        id: 'overdue_payments',
        type: 'overdue_payments',
        severity: 'critical',
        // Use i18next pluralization: _one / _other suffix
        messageKey: overduePayments.length === 1 
          ? 'insights.overdue_payments_one' 
          : 'insights.overdue_payments_other',
        params: {
          count: overduePayments.length,
          total: totalOverdue,
        },
        value: totalOverdue,
        actionHintKey: 'insights.action_hint.regularize',
      });
    }

    // 6. Largest pending expense info (if not in critical state)
    if (plannedExpenses.length > 0 && projectedBalance >= 0) {
      const largestExpense = plannedExpenses.reduce((max, t) => 
        Number(t.amount) > Number(max.amount) ? t : max
      , plannedExpenses[0]);

      if (Number(largestExpense.amount) > projectedBalance * 0.5) {
        const percentage = Math.round((Number(largestExpense.amount) / pendingExpenses) * 100);
        
        insights.push({
          id: 'largest_pending_expense',
          type: 'largest_pending_expense',
          severity: 'info',
          messageKey: 'insights.largest_pending_expense',
          params: {
            description: largestExpense.description || 'no description',
            amount: Number(largestExpense.amount),
            percentage,
          },
          value: Number(largestExpense.amount),
        });
      }
    }

    // Sort by severity
    const severityOrder: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return insights;
  }, [projections, totals, transactions, selectedMonth]);
}
