/**
 * Services - Centralized service layer
 * 
 * This module exports all services for:
 * - Notification mutations
 * - Balance state persistence
 * 
 * Services are the ONLY layer that performs side effects (database, localStorage).
 * UI and hooks should use these services instead of making direct calls.
 */

export * from './notificationsService';
export * from './balanceStateService';
