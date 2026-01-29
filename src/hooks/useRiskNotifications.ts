import { useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { differenceInDays, endOfMonth, startOfMonth, startOfDay, parseISO, format } from 'date-fns';
import { Transaction } from '@/types/finance';
import { LOCALE_CONFIG, SupportedLocale } from '@/i18n';

interface RiskNotificationInput {
  projectedBalance: number;
  realizedBalance: number;
  pendingExpenses: number;
  transactions: Transaction[];
  selectedMonth: Date;
  enabled?: boolean;
}

interface OverdueExpense {
  id: string;
  description: string;
  daysOverdue: number;
  subcategoryName?: string;
  categoryName?: string;
}

interface CoverageRiskExpense {
  id: string;
  description: string;
  daysUntilDue: number;
  amount: number;
  subcategoryName?: string;
  categoryName?: string;
}

export interface RiskIndicators {
  // PAYMENT_DELAYED
  overdueExpenses: OverdueExpense[];
  hasOverdueExpenses: boolean;
  
  // MONTH_AT_RISK
  isMonthAtRisk: boolean;
  monthRiskAmount: number;
  
  // MONTH_AT_RISK_PREVIEW
  showRiskPreview: boolean;
  
  // UPCOMING_EXPENSE_COVERAGE_RISK
  coverageRiskExpenses: CoverageRiskExpense[];
  hasCoverageRisk: boolean;
}

// Balance state for the state machine
type BalanceState = 'NEGATIVE' | 'NON_NEGATIVE';

// LocalStorage key for persisting ONLY the last known state per (householdId, month)
// NO "toastShown" flags - only the state is persisted for comparison
const BALANCE_STATE_STORAGE_KEY = 'risk_forecast_states';

/**
 * Get the persisted balance states from localStorage
 * Format: { [householdId|monthKey]: BalanceState }
 */
function getPersistedStates(): Record<string, BalanceState> {
  try {
    const stored = localStorage.getItem(BALANCE_STATE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Persist ONLY the last forecast state for a specific household+month
 * No "shown" flags - just the state for next comparison
 */
function persistState(householdId: string, monthKey: string, state: BalanceState): void {
  try {
    const states = getPersistedStates();
    states[`${householdId}|${monthKey}`] = state;
    localStorage.setItem(BALANCE_STATE_STORAGE_KEY, JSON.stringify(states));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get the persisted state for a specific household+month
 */
function getPersistedState(householdId: string, monthKey: string): BalanceState | null {
  const states = getPersistedStates();
  return states[`${householdId}|${monthKey}`] || null;
}

/**
 * Hook that calculates risk indicators for UI display only.
 * NO database writes - just computes state for toasts/banners.
 * 
 * State Machine:
 * - state = NEGATIVE when projectedBalance < 0
 * - state = NON_NEGATIVE when projectedBalance >= 0
 * 
 * Toast Rules:
 * - NON_NEGATIVE -> NEGATIVE: show risk warning (once per transition)
 * - NEGATIVE -> NON_NEGATIVE: show recovery message (once per transition)
 * 
 * Persistence:
 * - Only the last state per (householdId, month) is stored in localStorage
 * - Toasts show on every state TRANSITION, not blocked forever
 * 
 * i18n-safe: All toast messages use translation keys.
 */
export function useRiskNotifications({
  projectedBalance,
  realizedBalance,
  pendingExpenses,
  transactions,
  selectedMonth,
  enabled = true,
}: RiskNotificationInput): RiskIndicators & { notifyRiskReduced: (amount: number) => void } {
  const { householdId } = useAuth();
  const { t, i18n } = useTranslation();
  
  // Get locale-aware currency formatter
  const currentLocale = (i18n.language || 'pt-BR') as SupportedLocale;
  const config = LOCALE_CONFIG[currentLocale] || LOCALE_CONFIG['pt-BR'];
  
  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat(config.numberFormat, {
      style: 'currency',
      currency: config.currency
    }).format(value);
  }, [config]);

  // Calculate all risk indicators (no side effects)
  const riskIndicators = useMemo<RiskIndicators>(() => {
    if (!householdId || !enabled) {
      return {
        overdueExpenses: [],
        hasOverdueExpenses: false,
        isMonthAtRisk: false,
        monthRiskAmount: 0,
        showRiskPreview: false,
        coverageRiskExpenses: [],
        hasCoverageRisk: false,
      };
    }

    const today = startOfDay(new Date());
    const isNegative = projectedBalance < 0;

    // Calculate days until end of month
    const monthEnd = endOfMonth(selectedMonth);
    const daysUntilMonthEnd = differenceInDays(monthEnd, today);
    
    // Check if we're still in the selected month
    const monthStart = startOfMonth(selectedMonth);
    const isCurrentOrFutureMonth = today <= monthEnd && today >= monthStart;
    const isFutureMonth = today < monthStart;
    const monthNotEnded = isCurrentOrFutureMonth || isFutureMonth;

    // ========================================
    // PAYMENT_DELAYED: Overdue planned transactions
    // ========================================
    const overdueTransactions = transactions.filter(t => {
      if (t.status !== 'planned' || t.kind !== 'EXPENSE') return false;
      const dueDate = t.due_date ? parseISO(t.due_date) : parseISO(t.date);
      return dueDate < today;
    });

    const overdueExpenses: OverdueExpense[] = overdueTransactions.map(tx => {
      const dueDate = tx.due_date ? parseISO(tx.due_date) : parseISO(tx.date);
      const daysOverdue = differenceInDays(today, dueDate);
      
      return {
        id: tx.id,
        description: tx.description || t('transactions.kind.expense'),
        daysOverdue,
        subcategoryName: tx.subcategory?.name,
        categoryName: tx.category?.name,
      };
    });

    // ========================================
    // MONTH_AT_RISK_PREVIEW - AI Warning (Âmbar)
    // ========================================
    const hasPendingExpenses = pendingExpenses > 0;
    const atLeast5DaysRemaining = daysUntilMonthEnd >= 5;
    
    const showRiskPreview = 
      isNegative && 
      hasPendingExpenses && 
      monthNotEnded && 
      atLeast5DaysRemaining;

    // ========================================
    // UPCOMING_EXPENSE_COVERAGE_RISK
    // ========================================
    const hasOverdueAlerts = overdueExpenses.length > 0;
    const shouldCheckCoverageRisk = !hasOverdueAlerts && !isNegative;
    
    const coverageRiskExpenses: CoverageRiskExpense[] = shouldCheckCoverageRisk 
      ? transactions
          .filter(tx => {
            if (tx.status !== 'planned' || tx.kind !== 'EXPENSE') return false;
            
            const dueDate = tx.due_date ? parseISO(tx.due_date) : parseISO(tx.date);
            const daysUntilDue = differenceInDays(dueDate, today);
            
            // Must be due in 1-7 days
            if (daysUntilDue < 1 || daysUntilDue > 7) return false;
            
            // Amount must exceed current balance
            const amount = Number(tx.amount);
            if (amount <= realizedBalance) return false;
            
            return true;
          })
          .map(tx => {
            const dueDate = tx.due_date ? parseISO(tx.due_date) : parseISO(tx.date);
            const daysUntilDue = differenceInDays(dueDate, today);
            
            return {
              id: tx.id,
              description: tx.description || t('transactions.kind.expense'),
              daysUntilDue,
              amount: Number(tx.amount),
              subcategoryName: tx.subcategory?.name,
              categoryName: tx.category?.name,
            };
          })
      : [];

    return {
      overdueExpenses,
      hasOverdueExpenses: overdueExpenses.length > 0,
      isMonthAtRisk: isNegative,
      monthRiskAmount: isNegative ? Math.abs(projectedBalance) : 0,
      showRiskPreview,
      coverageRiskExpenses,
      hasCoverageRisk: coverageRiskExpenses.length > 0,
    };
  }, [
    householdId,
    enabled,
    projectedBalance,
    realizedBalance,
    pendingExpenses,
    selectedMonth,
    transactions,
    t,
  ]);

  // State machine: show toasts on state TRANSITIONS
  // Uses localStorage to persist state across page refreshes
  useEffect(() => {
    if (!householdId || !enabled) return;

    const monthKey = format(selectedMonth, 'yyyy-MM');
    
    // Determine current state based on projected balance
    const currentState: BalanceState = riskIndicators.isMonthAtRisk ? 'NEGATIVE' : 'NON_NEGATIVE';
    
    // Get the last known state from localStorage
    const previousState = getPersistedState(householdId, monthKey);
    
    // Check for state transitions - show toast on EVERY transition (no permanent blocking)
    if (previousState !== null && previousState !== currentState) {
      // ========================================
      // Transition: NON_NEGATIVE -> NEGATIVE
      // Show risk toast
      // ========================================
      if (previousState === 'NON_NEGATIVE' && currentState === 'NEGATIVE') {
        toast({
          variant: 'destructive',
          title: t('toasts.risk_month_negative.title'),
          description: t('toasts.risk_month_negative.description', { 
            amount: formatCurrency(riskIndicators.monthRiskAmount) 
          }),
        });
      }
      
      // ========================================
      // Transition: NEGATIVE -> NON_NEGATIVE
      // Show recovery toast
      // ========================================
      if (previousState === 'NEGATIVE' && currentState === 'NON_NEGATIVE') {
        toast({
          title: t('toasts.month_recovered.title'),
          description: t('toasts.month_recovered.description'),
        });
      }
    }
    
    // Always persist the current state (for next comparison)
    persistState(householdId, monthKey, currentState);
    
  }, [householdId, enabled, riskIndicators.isMonthAtRisk, riskIndicators.monthRiskAmount, selectedMonth, t, formatCurrency]);

  // Function to show risk reduced toast (UI only)
  const notifyRiskReduced = useCallback((improvementAmount: number) => {
    if (improvementAmount <= 0) return;
    
    toast({
      title: t('toasts.good_decision.title'),
      description: t('toasts.good_decision.description', { 
        amount: formatCurrency(improvementAmount) 
      }),
    });
  }, [t, formatCurrency]);

  return {
    ...riskIndicators,
    notifyRiskReduced,
  };
}
