/**
 * Balance State Service - Manages localStorage state for toasts
 * 
 * This service handles the persistence of balance state for the
 * state machine that controls insight toasts.
 */

import type { BalanceState } from '@/domain/finance/types';
import { logger } from '@/domain/finance/logger';

const BALANCE_STATE_STORAGE_KEY = 'risk_forecast_states';

/**
 * Get all persisted balance states from localStorage
 */
export function getPersistedStates(): Record<string, BalanceState> {
  try {
    const stored = localStorage.getItem(BALANCE_STATE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Get the persisted state for a specific household+month
 */
export function getBalanceState(householdId: string, monthKey: string): BalanceState | null {
  const states = getPersistedStates();
  const key = `${householdId}|${monthKey}`;
  const state = states[key] || null;
  
  logger.transition(`Get balance state: ${key} = ${state}`);
  
  return state;
}

/**
 * Persist the balance state for a specific household+month
 */
export function setBalanceState(
  householdId: string, 
  monthKey: string, 
  state: BalanceState
): void {
  try {
    const states = getPersistedStates();
    const key = `${householdId}|${monthKey}`;
    states[key] = state;
    localStorage.setItem(BALANCE_STATE_STORAGE_KEY, JSON.stringify(states));
    
    logger.transition(`Set balance state: ${key} = ${state}`);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear all balance states (useful for testing)
 */
export function clearBalanceStates(): void {
  try {
    localStorage.removeItem(BALANCE_STATE_STORAGE_KEY);
    logger.transition('Cleared all balance states');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear balance state for a specific month
 */
export function clearBalanceStateForMonth(householdId: string, monthKey: string): void {
  try {
    const states = getPersistedStates();
    const key = `${householdId}|${monthKey}`;
    delete states[key];
    localStorage.setItem(BALANCE_STATE_STORAGE_KEY, JSON.stringify(states));
    
    logger.transition(`Cleared balance state: ${key}`);
  } catch {
    // Ignore storage errors
  }
}
