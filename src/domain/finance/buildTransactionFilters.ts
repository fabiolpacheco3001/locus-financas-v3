/**
 * buildTransactionFiltersFromNotification - Pure function to parse notification CTAs
 * 
 * PURE FUNCTION - Converts notification data to transaction filter params
 */

import { TransactionFilter } from './types';
import { logger } from './logger';

export interface NotificationContext {
  eventType: string;
  referenceId?: string | null;
  ctaTarget?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Parse a CTA target URL into transaction filters
 * 
 * @param ctaTarget - The CTA target URL (e.g., "/transactions?view=overdue")
 * @returns Parsed filter parameters
 */
export function parseCtaTarget(ctaTarget: string): TransactionFilter {
  try {
    const url = new URL(ctaTarget, 'http://localhost');
    const params = url.searchParams;
    
    const filter: TransactionFilter = {};
    
    // View parameter
    const view = params.get('view');
    if (view === 'overdue' || view === 'month_pending' || view === 'late_pattern') {
      filter.view = view;
    }
    
    // Status parameter
    const status = params.get('status');
    if (status === 'confirmed' || status === 'planned' || status === 'cancelled' || status === 'all') {
      filter.status = status;
    }
    
    // Category filters
    const categoryId = params.get('category') || params.get('filter_category');
    if (categoryId) {
      filter.categoryId = categoryId;
    }
    
    const subcategoryId = params.get('subcategory') || params.get('filter_subcategory');
    if (subcategoryId) {
      filter.subcategoryId = subcategoryId;
    }
    
    // Month parameter
    const month = params.get('month');
    if (month) {
      filter.month = month;
    }
    
    logger.filter('Parsed CTA target', { ctaTarget, filter });
    
    return filter;
  } catch (error) {
    logger.filter('Failed to parse CTA target', { ctaTarget, error });
    return {};
  }
}

/**
 * Build transaction filters from notification context
 * 
 * @param notification - The notification context
 * @returns TransactionFilter for the transactions page
 */
export function buildTransactionFiltersFromNotification(
  notification: NotificationContext
): TransactionFilter {
  const { eventType, referenceId, ctaTarget, metadata } = notification;
  
  logger.filter('Building filters from notification', { eventType, referenceId });
  
  // If CTA target is provided, parse it first
  if (ctaTarget) {
    return parseCtaTarget(ctaTarget);
  }
  
  // Otherwise, build filters based on event type
  switch (eventType) {
    case 'PAYMENT_DELAYED':
      return {
        view: 'overdue',
        status: 'planned',
      };
    
    case 'MONTH_AT_RISK':
    case 'MONTH_AT_RISK_PREVIEW':
      return {
        view: 'month_pending',
        status: 'planned',
        month: referenceId || undefined,
      };
    
    case 'UPCOMING_EXPENSE_COVERAGE_RISK':
      return {
        status: 'planned',
        // The referenceId is the transaction ID - UI should highlight it
      };
    
    case 'RECURRING_LATE_PAYMENT':
      return {
        view: 'late_pattern',
        categoryId: (metadata?.categoryId as string) || undefined,
        subcategoryId: (metadata?.subcategoryId as string) || undefined,
      };
    
    case 'MISSING_RECURRING_EXPENSE':
      return {
        status: 'planned',
        categoryId: (metadata?.categoryId as string) || undefined,
      };
    
    default:
      return {};
  }
}

/**
 * Build URL with transaction filters
 */
export function buildTransactionUrl(filter: TransactionFilter): string {
  const params = new URLSearchParams();
  
  if (filter.view) params.set('view', filter.view);
  if (filter.status) params.set('status', filter.status);
  if (filter.categoryId) params.set('category', filter.categoryId);
  if (filter.subcategoryId) params.set('subcategory', filter.subcategoryId);
  if (filter.month) params.set('month', filter.month);
  
  const queryString = params.toString();
  return queryString ? `/transactions?${queryString}` : '/transactions';
}
