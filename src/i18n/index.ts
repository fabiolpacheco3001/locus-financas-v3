import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';
import es from './locales/es.json';
import pseudo from './locales/pseudo.json';

export const SUPPORTED_LOCALES = ['pt-BR', 'es', 'en'] as const;
export const DEV_LOCALES = [...SUPPORTED_LOCALES, 'pseudo'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];
export type DevLocale = typeof DEV_LOCALES[number];

export const LOCALE_CONFIG: Record<SupportedLocale, { 
  label: string; 
  dateLocale: string;
  currency: string;
  currencySymbol: string;
  numberFormat: string;
  dateFormat: string;
}> = {
  'pt-BR': { 
    label: 'Português (Brasil)', 
    dateLocale: 'pt-BR',
    currency: 'BRL',
    currencySymbol: 'R$',
    numberFormat: 'pt-BR',
    dateFormat: 'DD/MM/YYYY'
  },
  'es': { 
    label: 'Español', 
    dateLocale: 'es',
    currency: 'EUR',
    currencySymbol: '€',
    numberFormat: 'es-ES',
    dateFormat: 'DD/MM/YYYY'
  },
  'en': { 
    label: 'English', 
    dateLocale: 'en-US',
    currency: 'USD',
    currencySymbol: '$',
    numberFormat: 'en-US',
    dateFormat: 'MM/DD/YYYY'
  }
};

const STORAGE_KEY = 'user-locale';

export function getStoredLocale(): SupportedLocale | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
    return stored as SupportedLocale;
  }
  return null;
}

export function setStoredLocale(locale: SupportedLocale): void {
  localStorage.setItem(STORAGE_KEY, locale);
}

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// Track missing keys to avoid duplicate warnings
const missingKeysLogged = new Set<string>();

// Logger for missing keys - can be extended to send to monitoring service
const logMissingKey = (key: string, lngs: readonly string[]) => {
  const logMessage = `[i18n] Missing translation key: "${key}" for languages: [${lngs.join(', ')}]`;
  
  if (!missingKeysLogged.has(key)) {
    missingKeysLogged.add(key);
    
    if (isDevelopment) {
      console.warn(logMessage);
    } else {
      // In production, log to console.error for monitoring
      // This could be extended to send to an error tracking service
      console.error(logMessage);
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: ptBR },
      'en': { translation: en },
      'es': { translation: es },
      ...(isDevelopment ? { 'pseudo': { translation: pseudo } } : {})
    },
    lng: getStoredLocale() || undefined,
    fallbackLng: 'pt-BR',
    supportedLngs: SUPPORTED_LOCALES,
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: STORAGE_KEY
    },
    // Enable missing key tracking in all environments
    saveMissing: true,
    missingKeyHandler: (lngs, ns, key, fallbackValue) => {
      logMissingKey(key, lngs);
    },
    // In development, show warning indicator; in production, return fallback from pt-BR
    returnEmptyString: false,
    parseMissingKeyHandler: isDevelopment 
      ? (key) => `⚠️ ${key}`
      : (key) => {
          // In production, try to get the key from pt-BR fallback
          // If still missing, return the key itself as last resort
          return key;
        }
  });

// Export function to get all missing keys (useful for auditing)
export function getMissingKeys(): string[] {
  return Array.from(missingKeysLogged);
}

// Export function to check if a key is missing
export function isKeyMissing(key: string): boolean {
  return missingKeysLogged.has(key);
}

export default i18n;
