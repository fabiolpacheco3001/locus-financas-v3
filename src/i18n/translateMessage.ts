/**
 * Translate Message Utility
 * 
 * Provides functions to translate message keys with params at runtime.
 * Used by notification service, insights, toasts, and error handlers.
 * 
 * CRITICAL: All AI-generated messages must use message_key + params pattern.
 * Never persist final translated text - translate only at render time.
 */

import i18n from './index';
import type { LocalizedMessage } from './messageTypes';

/**
 * Translate a message key with params using current locale
 */
export function translateMessage<K extends string>(
  messageKey: K,
  params?: Record<string, unknown>
): string {
  return i18n.t(messageKey, params as Record<string, string | number>);
}

/**
 * Translate a LocalizedMessage object
 */
export function translateLocalizedMessage(
  message: LocalizedMessage | null | undefined
): string {
  if (!message) return '';
  return translateMessage(message.messageKey, message.params);
}

/**
 * Format currency using current locale settings.
 * Maps locales to their appropriate currencies.
 */
export function formatCurrencyForLocale(value: number): string {
  const locale = i18n.language || 'pt-BR';
  
  const localeConfig: Record<string, { currency: string; numberFormat: string }> = {
    'pt-BR': { currency: 'BRL', numberFormat: 'pt-BR' },
    'en': { currency: 'USD', numberFormat: 'en-US' },
    'es': { currency: 'EUR', numberFormat: 'es-ES' },
  };
  
  const config = localeConfig[locale] || localeConfig['pt-BR'];
  
  return new Intl.NumberFormat(config.numberFormat, {
    style: 'currency',
    currency: config.currency,
  }).format(Math.abs(value));
}

/**
 * Get the current locale
 */
export function getCurrentLocale(): string {
  return i18n.language || 'pt-BR';
}

/**
 * Translate a day/days text with proper pluralization
 */
export function translateDays(days: number): string {
  return i18n.t('common.days', { count: days });
}

/**
 * Translate a message with currency formatting.
 * Automatically formats any 'amount' param as currency.
 */
export function translateWithCurrency<K extends string>(
  messageKey: K,
  params?: Record<string, unknown>
): string {
  const formattedParams: Record<string, unknown> = { ...params };
  
  // Auto-format currency fields
  const currencyFields = ['amount', 'deficit', 'total', 'missing', 'improvementAmount'];
  currencyFields.forEach(field => {
    if (typeof formattedParams[field] === 'number') {
      formattedParams[field] = formatCurrencyForLocale(formattedParams[field] as number);
    }
  });

  return i18n.t(messageKey, formattedParams as Record<string, string | number>);
}
