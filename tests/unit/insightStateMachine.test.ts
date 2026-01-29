import { describe, it, expect, vi, beforeEach } from 'vitest';

// Types
type BalanceState = 'NEGATIVE' | 'NON_NEGATIVE';

// Simulated localStorage storage
let mockStorage: Record<string, string> = {};

// Mock localStorage functions (mirrors useRiskNotifications.ts)
function getPersistedStates(): Record<string, BalanceState> {
  try {
    const stored = mockStorage['risk_forecast_states'];
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function persistState(householdId: string, monthKey: string, state: BalanceState): void {
  try {
    const states = getPersistedStates();
    states[`${householdId}|${monthKey}`] = state;
    mockStorage['risk_forecast_states'] = JSON.stringify(states);
  } catch {
    // Ignore storage errors
  }
}

function getPersistedState(householdId: string, monthKey: string): BalanceState | null {
  const states = getPersistedStates();
  return states[`${householdId}|${monthKey}`] || null;
}

interface ToastCall {
  type: 'risk' | 'recovered';
  amount?: number;
}

/**
 * Simulates the insight state machine logic from useRiskNotifications.ts
 * Returns the toasts that would be triggered
 */
function processBalanceStateChange(
  householdId: string,
  monthKey: string,
  projectedBalance: number
): ToastCall | null {
  const currentState: BalanceState = projectedBalance < 0 ? 'NEGATIVE' : 'NON_NEGATIVE';
  const previousState = getPersistedState(householdId, monthKey);
  
  let toastCall: ToastCall | null = null;
  
  // Check for state transitions
  if (previousState !== null && previousState !== currentState) {
    // Transition: NON_NEGATIVE -> NEGATIVE
    if (previousState === 'NON_NEGATIVE' && currentState === 'NEGATIVE') {
      toastCall = { type: 'risk', amount: Math.abs(projectedBalance) };
    }
    
    // Transition: NEGATIVE -> NON_NEGATIVE
    if (previousState === 'NEGATIVE' && currentState === 'NON_NEGATIVE') {
      toastCall = { type: 'recovered' };
    }
  }
  
  // Always persist the current state
  persistState(householdId, monthKey, currentState);
  
  return toastCall;
}

describe('Insight State Machine', () => {
  const householdId = 'household-1';
  const monthKey = '2025-01';

  beforeEach(() => {
    mockStorage = {};
  });

  describe('State transitions', () => {
    it('should trigger "Mês recuperado" toast when NEGATIVE -> NON_NEGATIVE', () => {
      // Set initial state as NEGATIVE
      persistState(householdId, monthKey, 'NEGATIVE');
      
      // Now balance becomes positive
      const result = processBalanceStateChange(householdId, monthKey, 500);
      
      expect(result).toEqual({ type: 'recovered' });
    });

    it('should trigger "Risco" toast when NON_NEGATIVE -> NEGATIVE', () => {
      // Set initial state as NON_NEGATIVE
      persistState(householdId, monthKey, 'NON_NEGATIVE');
      
      // Now balance becomes negative
      const result = processBalanceStateChange(householdId, monthKey, -300);
      
      expect(result).toEqual({ type: 'risk', amount: 300 });
    });

    it('should NOT trigger toast when state remains NEGATIVE', () => {
      // Set initial state as NEGATIVE
      persistState(householdId, monthKey, 'NEGATIVE');
      
      // Balance remains negative
      const result = processBalanceStateChange(householdId, monthKey, -500);
      
      expect(result).toBeNull();
    });

    it('should NOT trigger toast when state remains NON_NEGATIVE', () => {
      // Set initial state as NON_NEGATIVE
      persistState(householdId, monthKey, 'NON_NEGATIVE');
      
      // Balance remains positive
      const result = processBalanceStateChange(householdId, monthKey, 1000);
      
      expect(result).toBeNull();
    });

    it('should NOT trigger toast on first render (no previous state)', () => {
      // No previous state set
      const result = processBalanceStateChange(householdId, monthKey, -100);
      
      expect(result).toBeNull();
      
      // But state should be persisted
      expect(getPersistedState(householdId, monthKey)).toBe('NEGATIVE');
    });
  });

  describe('One toast per transition', () => {
    it('should trigger toast only once for each transition', () => {
      // Initial state: positive
      persistState(householdId, monthKey, 'NON_NEGATIVE');
      
      // First transition to negative - should trigger
      const result1 = processBalanceStateChange(householdId, monthKey, -100);
      expect(result1).toEqual({ type: 'risk', amount: 100 });
      
      // Second call with same negative balance - should NOT trigger
      const result2 = processBalanceStateChange(householdId, monthKey, -150);
      expect(result2).toBeNull();
      
      // Third call with different negative balance - should NOT trigger
      const result3 = processBalanceStateChange(householdId, monthKey, -200);
      expect(result3).toBeNull();
    });

    it('should trigger toast again when transitioning back', () => {
      // Start negative
      persistState(householdId, monthKey, 'NEGATIVE');
      
      // Recover - should trigger
      const result1 = processBalanceStateChange(householdId, monthKey, 500);
      expect(result1).toEqual({ type: 'recovered' });
      
      // Fall negative again - should trigger
      const result2 = processBalanceStateChange(householdId, monthKey, -100);
      expect(result2).toEqual({ type: 'risk', amount: 100 });
      
      // Recover again - should trigger
      const result3 = processBalanceStateChange(householdId, monthKey, 200);
      expect(result3).toEqual({ type: 'recovered' });
    });
  });

  describe('Per-month isolation', () => {
    it('should track states independently per month', () => {
      // January is negative
      persistState(householdId, '2025-01', 'NEGATIVE');
      // February is positive
      persistState(householdId, '2025-02', 'NON_NEGATIVE');
      
      // Recovery in January - should trigger
      const result1 = processBalanceStateChange(householdId, '2025-01', 500);
      expect(result1).toEqual({ type: 'recovered' });
      
      // No change in February - should NOT trigger
      const result2 = processBalanceStateChange(householdId, '2025-02', 500);
      expect(result2).toBeNull();
    });
  });

  describe('Per-household isolation', () => {
    it('should track states independently per household', () => {
      // Household 1 is negative
      persistState('household-1', monthKey, 'NEGATIVE');
      // Household 2 is positive
      persistState('household-2', monthKey, 'NON_NEGATIVE');
      
      // Recovery in household 1 - should trigger
      const result1 = processBalanceStateChange('household-1', monthKey, 500);
      expect(result1).toEqual({ type: 'recovered' });
      
      // No change in household 2 - should NOT trigger
      const result2 = processBalanceStateChange('household-2', monthKey, 500);
      expect(result2).toBeNull();
    });
  });

  describe('State persistence', () => {
    it('should persist state after each change', () => {
      processBalanceStateChange(householdId, monthKey, -100);
      expect(getPersistedState(householdId, monthKey)).toBe('NEGATIVE');
      
      processBalanceStateChange(householdId, monthKey, 100);
      expect(getPersistedState(householdId, monthKey)).toBe('NON_NEGATIVE');
    });

    it('should handle zero balance as NON_NEGATIVE', () => {
      persistState(householdId, monthKey, 'NEGATIVE');
      
      const result = processBalanceStateChange(householdId, monthKey, 0);
      
      expect(result).toEqual({ type: 'recovered' });
      expect(getPersistedState(householdId, monthKey)).toBe('NON_NEGATIVE');
    });
  });
});
