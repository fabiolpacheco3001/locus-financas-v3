import { useMemo } from 'react';
import { format, isAfter, startOfDay, parseISO } from 'date-fns';
import { useRiskEvents } from './useRiskEvents';
import { Transaction } from '@/types/finance';
import { AccountProjection } from '@/lib/riskEngine';
import { useAuth } from '@/contexts/AuthContext';

interface RiskDetectionInput {
  projections: AccountProjection[];
  transactions: Transaction[];
  selectedMonth: Date;
  enabled?: boolean;
}

interface DelayedPayment {
  id: string;
  description: string | null;
  amount: number;
  dueDate: string;
  daysOverdue: number;
}

export interface RiskDetectionResult {
  isAtRisk: boolean;
  totalProjectedBalance: number;
  delayedPayments: DelayedPayment[];
  events: ReturnType<typeof useRiskEvents>['events'];
}

/**
 * Hook that calculates risk indicators for UI display only.
 * NO database writes - just computes state for UI display.
 * 
 * Risk events are persisted ONLY by:
 * - Transaction data events (create/edit/confirm/cancel)
 * - Daily scheduled job
 */
export function useRiskDetection({
  projections,
  transactions,
  selectedMonth,
  enabled = true,
}: RiskDetectionInput): RiskDetectionResult {
  const { householdId } = useAuth();
  const { events } = useRiskEvents(selectedMonth);
  
  const today = startOfDay(new Date());

  // Calculate risk indicators (no side effects)
  const result = useMemo<RiskDetectionResult>(() => {
    if (!enabled || !householdId) {
      return {
        isAtRisk: false,
        totalProjectedBalance: 0,
        delayedPayments: [],
        events: [],
      };
    }

    // Calculate total projected balance
    const totalProjectedBalance = projections.reduce(
      (sum, p) => sum + p.projectedBalance,
      0
    );
    const isAtRisk = totalProjectedBalance < 0;

    // Find delayed payments (planned expenses past due date)
    const delayedPayments: DelayedPayment[] = transactions
      .filter((t) => {
        if (t.status !== 'planned' || t.kind !== 'EXPENSE') return false;
        
        const dueDate = t.due_date || t.date;
        const dueDateParsed = parseISO(dueDate);
        
        return isAfter(today, dueDateParsed);
      })
      .map((t) => {
        const dueDate = t.due_date || t.date;
        const dueDateParsed = parseISO(dueDate);
        const daysOverdue = Math.floor(
          (today.getTime() - dueDateParsed.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          id: t.id,
          description: t.description,
          amount: Number(t.amount),
          dueDate,
          daysOverdue,
        };
      });

    return {
      isAtRisk,
      totalProjectedBalance,
      delayedPayments,
      events,
    };
  }, [enabled, householdId, projections, transactions, today, events]);

  return result;
}
