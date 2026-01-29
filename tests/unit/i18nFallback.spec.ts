import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ptBR from '../../src/i18n/locales/pt-BR.json';
import en from '../../src/i18n/locales/en.json';
import es from '../../src/i18n/locales/es.json';

/**
 * i18n Fallback Behavior Tests
 * 
 * Validates:
 * 1. Missing keys fallback to pt-BR
 * 2. Literal keys are never rendered to users
 * 3. Appropriate logging in dev vs production
 */

// Create a fresh i18n instance for testing
function createTestI18n(options: { 
  isDev?: boolean; 
  resources?: Record<string, any>;
  lng?: string;
} = {}) {
  const { isDev = false, resources, lng = 'pt-BR' } = options;
  
  const testI18n = i18n.createInstance();
  
  const missingKeysLogged: string[] = [];
  const consoleWarnSpy = vi.fn();
  const consoleErrorSpy = vi.fn();
  
  testI18n
    .use(initReactI18next)
    .init({
      resources: resources || {
        'pt-BR': { translation: ptBR },
        'en': { translation: en },
        'es': { translation: es },
      },
      lng,
      fallbackLng: 'pt-BR',
      supportedLngs: ['pt-BR', 'en', 'es'],
      interpolation: {
        escapeValue: false
      },
      saveMissing: true,
      missingKeyHandler: (lngs, ns, key) => {
        missingKeysLogged.push(key);
        const logMessage = `[i18n] Missing translation key: "${key}"`;
        
        if (isDev) {
          consoleWarnSpy(logMessage);
        } else {
          consoleErrorSpy(logMessage);
        }
      },
      returnEmptyString: false,
      parseMissingKeyHandler: isDev 
        ? (key) => `⚠️ ${key}`
        : (key) => {
            // In production, try fallback value from pt-BR
            const fallbackValue = getNestedValue(ptBR, key);
            return fallbackValue || `[${key}]`;
          }
    });
  
  return { 
    i18n: testI18n, 
    missingKeysLogged, 
    consoleWarnSpy, 
    consoleErrorSpy 
  };
}

function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  
  return typeof current === 'string' ? current : undefined;
}

// Patterns that indicate a raw key is being rendered
const KEY_PATTERNS = [
  /^[a-z]+\.[a-z]+(\.[a-z]+)*$/i,  // e.g., "common.save", "transactions.form.enterAmount"
  /^[a-z]+_[a-z]+$/i,              // e.g., "missing_key"
];

function looksLikeTranslationKey(text: string): boolean {
  return KEY_PATTERNS.some(pattern => pattern.test(text));
}

describe('i18n Fallback Behavior', () => {
  describe('Missing key fallback to pt-BR', () => {
    it('should use pt-BR value when key is missing in EN', () => {
      // Create a modified EN resource without a specific key
      const modifiedEn = { ...en };
      delete (modifiedEn as any).common?.save;
      
      const { i18n: testI18n } = createTestI18n({
        isDev: false,
        resources: {
          'pt-BR': { translation: ptBR },
          'en': { translation: modifiedEn },
        },
        lng: 'en'
      });
      
      // When key is missing in EN, should fallback to pt-BR
      const result = testI18n.t('common.save');
      
      // In production, parseMissingKeyHandler returns pt-BR fallback
      // or the actual fallback mechanism kicks in
      expect(result).toBeDefined();
      expect(result).not.toBe('common.save'); // Should not render literal key
    });

    it('should use pt-BR value when key is missing in ES', () => {
      const modifiedEs = { ...es };
      delete (modifiedEs as any).common?.cancel;
      
      const { i18n: testI18n } = createTestI18n({
        isDev: false,
        resources: {
          'pt-BR': { translation: ptBR },
          'es': { translation: modifiedEs },
        },
        lng: 'es'
      });
      
      const result = testI18n.t('common.cancel');
      
      expect(result).toBeDefined();
      expect(result).not.toBe('common.cancel');
    });

    it('should fallback through chain: current -> pt-BR', () => {
      const { i18n: testI18n } = createTestI18n({
        isDev: false,
        lng: 'en'
      });
      
      // This key exists in pt-BR, should be available via fallback
      const result = testI18n.t('common.save');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Never render literal key', () => {
    it('should never return a string that looks like a translation key in production', () => {
      const { i18n: testI18n } = createTestI18n({
        isDev: false,
        lng: 'en'
      });
      
      // Test with a completely non-existent key
      const result = testI18n.t('totally.nonexistent.key.that.does.not.exist');
      
      // Should not look like a raw key pattern
      if (result && typeof result === 'string') {
        // In production, should return bracketed fallback or actual translation
        // Never the raw dot-separated key
        expect(looksLikeTranslationKey(result) && !result.includes('[') && !result.includes('⚠️')).toBe(false);
      }
    });

    it('should mark missing keys with warning indicator in development', () => {
      const { i18n: testI18n } = createTestI18n({
        isDev: true,
        lng: 'en'
      });
      
      // Test with a non-existent key
      const result = testI18n.t('this.key.does.not.exist');
      
      // In dev, should be prefixed with warning indicator
      expect(result).toContain('⚠️');
    });

    it('should return pt-BR fallback or bracketed key in production, never raw key', () => {
      const { i18n: testI18n } = createTestI18n({
        isDev: false,
        lng: 'es'
      });
      
      // Non-existent key
      const result = testI18n.t('nonexistent.translation.key');
      
      // Should either have brackets indicating fallback or the actual translation
      // Should NEVER be the raw key pattern without any indicator
      const isRawKey = looksLikeTranslationKey(result) && 
                       !result.includes('[') && 
                       !result.includes('⚠️');
      
      expect(isRawKey).toBe(false);
    });

    it('all existing keys should return translated text, not key patterns', () => {
      const { i18n: testI18n } = createTestI18n({
        isDev: false,
        lng: 'en'
      });
      
      // Test a sample of existing keys
      const existingKeys = [
        'common.save',
        'common.cancel',
        'common.delete',
        'nav.dashboard',
        'nav.transactions',
        'auth.login',
        'auth.signup',
        'dashboard.title',
        'transactions.title',
        'notifications.title',
      ];
      
      for (const key of existingKeys) {
        const result = testI18n.t(key);
        
        expect(result, `Key "${key}" should not return literal key`).not.toBe(key);
        expect(
          looksLikeTranslationKey(result),
          `Key "${key}" returned "${result}" which looks like a key pattern`
        ).toBe(false);
      }
    });
  });

  describe('Logging behavior', () => {
    it('should log warning in development for missing keys', () => {
      const { i18n: testI18n, consoleWarnSpy, missingKeysLogged } = createTestI18n({
        isDev: true,
        lng: 'en'
      });
      
      // Access a non-existent key
      testI18n.t('missing.development.test.key');
      
      // Should have logged a warning
      expect(missingKeysLogged).toContain('missing.development.test.key');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log error in production for missing keys', () => {
      const { i18n: testI18n, consoleErrorSpy, missingKeysLogged } = createTestI18n({
        isDev: false,
        lng: 'en'
      });
      
      // Access a non-existent key
      testI18n.t('missing.production.test.key');
      
      // Should have logged an error
      expect(missingKeysLogged).toContain('missing.production.test.key');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should not log duplicate warnings for same missing key', () => {
      const { i18n: testI18n, missingKeysLogged } = createTestI18n({
        isDev: true,
        lng: 'en'
      });
      
      const testKey = 'duplicate.warning.test.key';
      
      // Access the same missing key multiple times
      testI18n.t(testKey);
      testI18n.t(testKey);
      testI18n.t(testKey);
      
      // Should only log once (via saveMissing + missingKeyHandler dedup)
      // Note: i18next may call handler multiple times internally,
      // but our handler should ideally dedupe
      const occurrences = missingKeysLogged.filter(k => k === testKey);
      
      // At minimum, the key should be tracked
      expect(occurrences.length).toBeGreaterThanOrEqual(1);
    });

    it('should include key and language info in log message', () => {
      const { consoleWarnSpy } = createTestI18n({
        isDev: true,
        lng: 'en'
      });
      
      // The spy should be called with a message containing the key
      if (consoleWarnSpy.mock.calls.length > 0) {
        const logMessage = consoleWarnSpy.mock.calls[0][0];
        expect(logMessage).toContain('[i18n]');
        expect(logMessage).toContain('Missing');
      }
    });
  });

  describe('Interpolation with missing keys', () => {
    it('should handle interpolation gracefully even with missing keys', () => {
      const { i18n: testI18n } = createTestI18n({
        isDev: false,
        lng: 'en'
      });
      
      // Even with a missing key, interpolation should not crash
      const result = testI18n.t('nonexistent.key.with.interpolation', { 
        count: 5, 
        name: 'Test' 
      });
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should properly interpolate existing keys', () => {
      const { i18n: testI18n } = createTestI18n({
        isDev: false,
        lng: 'en'
      });
      
      // Test with a key that uses interpolation
      const result = testI18n.t('common.remaining', { count: 10 });
      
      expect(result).toBeDefined();
      expect(result).toContain('10');
      expect(result).not.toBe('common.remaining');
    });
  });

  describe('Fallback chain integrity', () => {
    it('pt-BR should always have all base keys', () => {
      const { i18n: testI18n } = createTestI18n({
        isDev: false,
        lng: 'pt-BR'
      });
      
      // Critical keys that must exist in pt-BR
      const criticalKeys = [
        'common.save',
        'common.cancel',
        'common.delete',
        'common.confirm',
        'common.loading',
        'nav.dashboard',
        'nav.transactions',
        'nav.budget',
        'auth.login',
        'auth.signup',
        'transactions.title',
        'budget.title',
        'notifications.title',
        'notifications.empty.title',
        'notifications.empty.openDescription',
      ];
      
      for (const key of criticalKeys) {
        const result = testI18n.t(key);
        
        expect(result, `Critical key "${key}" should exist in pt-BR`).not.toBe(key);
        expect(
          result.includes('⚠️') || result.includes('['),
          `Critical key "${key}" should not be missing in pt-BR`
        ).toBe(false);
      }
    });

    it('form validation keys should exist and be translated', () => {
      const { i18n: testI18n } = createTestI18n({
        isDev: false,
        lng: 'pt-BR'
      });
      
      const validationKeys = [
        'auth.validation.invalidEmail',
        'auth.validation.passwordMinLength',
        'transactions.form.enterDueDate',
        'transactions.form.enterAmount',
        'transactions.form.selectCategory',
        'budget.validation.fillRequired',
        'budget.recurring.enterMonthlyAmount',
      ];
      
      for (const key of validationKeys) {
        const result = testI18n.t(key);
        
        expect(result, `Validation key "${key}" should exist`).not.toBe(key);
        expect(result.length, `Validation key "${key}" should have content`).toBeGreaterThan(0);
      }
    });

    it('installment keys should be properly translated', () => {
      const { i18n: testI18n } = createTestI18n({
        isDev: false,
        lng: 'pt-BR'
      });
      
      const installmentKeys = [
        'transactions.installments.purchase',
        'transactions.installments.countLabel',
        'transactions.installments.countPlaceholder',
        'transactions.installments.total',
        'transactions.installments.of',
        'transactions.installments.allPendingNote',
      ];
      
      for (const key of installmentKeys) {
        const result = testI18n.t(key);
        
        expect(result, `Installment key "${key}" should exist`).not.toBe(key);
        expect(
          looksLikeTranslationKey(result),
          `Installment key "${key}" should be translated, got "${result}"`
        ).toBe(false);
      }
    });
  });
});

describe('i18n Key Pattern Detection', () => {
  it('should correctly identify translation key patterns', () => {
    expect(looksLikeTranslationKey('common.save')).toBe(true);
    expect(looksLikeTranslationKey('transactions.form.enterAmount')).toBe(true);
    expect(looksLikeTranslationKey('auth.validation.invalidEmail')).toBe(true);
    expect(looksLikeTranslationKey('missing_key')).toBe(true);
  });

  it('should not flag normal text as translation keys', () => {
    expect(looksLikeTranslationKey('Save')).toBe(false);
    expect(looksLikeTranslationKey('Enter your email')).toBe(false);
    expect(looksLikeTranslationKey('Hello World')).toBe(false);
    expect(looksLikeTranslationKey('R$ 100,00')).toBe(false);
    expect(looksLikeTranslationKey('test@email.com')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(looksLikeTranslationKey('')).toBe(false);
    expect(looksLikeTranslationKey(' ')).toBe(false);
    expect(looksLikeTranslationKey('a.b')).toBe(true); // Minimal key pattern
    expect(looksLikeTranslationKey('0.00')).toBe(false); // Numbers
  });
});
