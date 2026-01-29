/**
 * Domain Logger - Controlled logging for rule evaluation
 * 
 * Only logs in development mode to help debug rule evaluation.
 * All logs are prefixed with [domain/finance] for easy filtering.
 */

const isDev = import.meta.env.DEV;

const PREFIX = '[domain/finance]';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogOptions {
  level?: LogLevel;
  data?: unknown;
}

function formatMessage(category: string, message: string): string {
  return `${PREFIX} [${category}] ${message}`;
}

/**
 * Log a message to console (dev only)
 */
export function log(category: string, message: string, options?: LogOptions): void {
  if (!isDev) return;
  
  const { level = 'debug', data } = options || {};
  const formattedMessage = formatMessage(category, message);
  
  switch (level) {
    case 'debug':
      if (data) {
        console.debug(formattedMessage, data);
      } else {
        console.debug(formattedMessage);
      }
      break;
    case 'info':
      if (data) {
        console.info(formattedMessage, data);
      } else {
        console.info(formattedMessage);
      }
      break;
    case 'warn':
      if (data) {
        console.warn(formattedMessage, data);
      } else {
        console.warn(formattedMessage);
      }
      break;
    case 'error':
      if (data) {
        console.error(formattedMessage, data);
      } else {
        console.error(formattedMessage);
      }
      break;
  }
}

// Convenience functions
export const logger = {
  snapshot: (message: string, data?: unknown) => log('snapshot', message, { data }),
  forecast: (message: string, data?: unknown) => log('forecast', message, { data }),
  rules: (message: string, data?: unknown) => log('rules', message, { data }),
  filter: (message: string, data?: unknown) => log('filter', message, { data }),
  risk: (message: string, data?: unknown) => log('risk', message, { data }),
  transition: (message: string, data?: unknown) => log('transition', message, { level: 'info', data }),
};
