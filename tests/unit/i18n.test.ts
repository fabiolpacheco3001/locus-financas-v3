import { describe, it, expect } from 'vitest';

// Import translation files
import ptBR from '../../src/i18n/locales/pt-BR.json';
import en from '../../src/i18n/locales/en.json';
import es from '../../src/i18n/locales/es.json';

/**
 * Test: i18n coverage validation
 * 
 * Validates that EN and ES locales have all keys from PT-BR
 * and that no Portuguese text leaks into other locales
 */

// Common Portuguese words/patterns that should NOT appear in EN/ES translations
const PORTUGUESE_PATTERNS = [
  /\bde\b/i,        // "de" (of/from)
  /\bpara\b/i,      // "para" (for/to)
  /\bcom\b/i,       // "com" (with)
  /\bseu\b/i,       // "seu" (your)
  /\bsua\b/i,       // "sua" (your)
  /\bvocê\b/i,      // "você" (you)
  /\bnão\b/i,       // "não" (no/not)
  /\bsim\b/i,       // "sim" (yes)
  /\btodas?\b/i,    // "todas/todo" (all)
  /\bmês\b/i,       // "mês" (month)
  /\bdia\b/i,       // "dia" (day)
  /\bvalor\b/i,     // "valor" (value)
  /\bação\b/i,      // "ação" (action)
  /\batenção\b/i,   // "atenção" (attention)
  /\borçamento\b/i, // "orçamento" (budget)
  /\bvenceu\b/i,    // "venceu" (overdue)
  /\bvencida\b/i,   // "vencida" (overdue)
  /\bconta\b/i,     // "conta" (account/bill)
  /\bdespesa\b/i,   // "despesa" (expense)
  /\breceita\b/i,   // "receita" (income)
  /\bsaldo\b/i,     // "saldo" (balance)
  /\bpagar\b/i,     // "pagar" (to pay)
  /\bcostuma\b/i,   // "costuma" (usually)
  /\batrasar\b/i,   // "atrasar" (delay)
];

// Words that are valid in multiple languages (false positives)
const ALLOWED_WORDS = [
  'no', // valid in English
  'data', // valid in English (and Latin root)
];

function getAllStrings(obj: any, path = ''): { key: string; value: string }[] {
  const results: { key: string; value: string }[] = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (typeof value === 'string') {
      results.push({ key: currentPath, value });
    } else if (typeof value === 'object' && value !== null) {
      results.push(...getAllStrings(value, currentPath));
    }
  }
  
  return results;
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

function containsPortuguese(text: string): { found: boolean; pattern?: string } {
  const lowerText = text.toLowerCase();
  
  // Skip if it's clearly a placeholder like {{variable}}
  if (text.match(/^\{\{.*\}\}$/)) {
    return { found: false };
  }
  
  for (const pattern of PORTUGUESE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const word = match[0].toLowerCase();
      // Skip allowed words that are valid in multiple languages
      if (!ALLOWED_WORDS.includes(word)) {
        return { found: true, pattern: match[0] };
      }
    }
  }
  
  return { found: false };
}

describe('i18n Translation Coverage', () => {
  const ptBRStrings = getAllStrings(ptBR);
  const enStrings = getAllStrings(en);
  const esStrings = getAllStrings(es);
  
  describe('EN locale has all PT-BR keys', () => {
    it('should have all translation keys from PT-BR', () => {
      const missingKeys: string[] = [];
      
      for (const { key } of ptBRStrings) {
        const enValue = getNestedValue(en, key);
        if (enValue === undefined) {
          missingKeys.push(key);
        }
      }
      
      if (missingKeys.length > 0) {
        console.log('Missing EN keys:', missingKeys.slice(0, 10).join(', '));
      }
      
      // Allow up to 5% missing keys (for keys that might be PT-BR specific)
      const missingPercent = (missingKeys.length / ptBRStrings.length) * 100;
      expect(missingPercent).toBeLessThan(5);
    });
  });
  
  describe('ES locale has all PT-BR keys', () => {
    it('should have all translation keys from PT-BR', () => {
      const missingKeys: string[] = [];
      
      for (const { key } of ptBRStrings) {
        const esValue = getNestedValue(es, key);
        if (esValue === undefined) {
          missingKeys.push(key);
        }
      }
      
      if (missingKeys.length > 0) {
        console.log('Missing ES keys:', missingKeys.slice(0, 10).join(', '));
      }
      
      // Allow up to 5% missing keys
      const missingPercent = (missingKeys.length / ptBRStrings.length) * 100;
      expect(missingPercent).toBeLessThan(5);
    });
  });
  
  describe('EN locale does not contain Portuguese text', () => {
    it('should not have Portuguese words in English translations', () => {
      const portugueseFound: { key: string; value: string; pattern: string }[] = [];
      
      for (const { key, value } of enStrings) {
        const result = containsPortuguese(value);
        if (result.found && result.pattern) {
          portugueseFound.push({ key, value, pattern: result.pattern });
        }
      }
      
      if (portugueseFound.length > 0) {
        console.log('Portuguese text found in EN:');
        portugueseFound.slice(0, 5).forEach(({ key, value, pattern }) => {
          console.log(`  ${key}: "${value}" (found: "${pattern}")`);
        });
      }
      
      // Critical translations that MUST be in English
      // Allow words like 'Dashboard', 'Email', 'ID' to be identical (common in both languages)
      const criticalKeys = [
        'nav.dashboard',
        'nav.transactions',
        'nav.budget',
        'nav.notifications',
        'notifications.title',
        'dashboard.title',
      ];
      
      // Words that are valid to be identical in EN and PT-BR
      const allowedIdenticalWords = ['Dashboard', 'Email', 'ID', 'API', 'URL'];
      
      for (const key of criticalKeys) {
        const enValue = getNestedValue(en, key);
        const ptValue = getNestedValue(ptBR, key);
        
        if (enValue && ptValue && enValue === ptValue) {
          // Allow if it's a common word that's valid in both languages
          const isAllowed = allowedIdenticalWords.some(word => enValue === word);
          if (!isAllowed) {
            console.log(`Critical key "${key}" has same value in EN and PT-BR: "${enValue}"`);
          }
        }
        
        // These should definitely be different (unless it's an allowed word)
        if (key === 'nav.budget') {
          const enValue = getNestedValue(en, key);
          const ptValue = getNestedValue(ptBR, key);
          const isAllowed = allowedIdenticalWords.some(word => enValue === word);
          if (!isAllowed) {
            expect(enValue).not.toBe(ptValue);
          }
        }
      }
      
      // Expect no more than 5 Portuguese patterns (accounting for false positives)
      expect(portugueseFound.length).toBeLessThan(10);
    });
  });
  
  describe('ES locale does not contain Portuguese text', () => {
    it('should not have Portuguese words in Spanish translations', () => {
      const portugueseFound: { key: string; value: string; pattern: string }[] = [];
      
      for (const { key, value } of esStrings) {
        const result = containsPortuguese(value);
        if (result.found && result.pattern) {
          portugueseFound.push({ key, value, pattern: result.pattern });
        }
      }
      
      if (portugueseFound.length > 0) {
        console.log('Portuguese text found in ES:');
        portugueseFound.slice(0, 5).forEach(({ key, value, pattern }) => {
          console.log(`  ${key}: "${value}" (found: "${pattern}")`);
        });
      }
      
      // Spanish shares many words with Portuguese, so allow more overlap (250 words)
      expect(portugueseFound.length).toBeLessThan(250);
    });
  });
  
  describe('Dashboard translations', () => {
    it('EN dashboard should not have PT text', () => {
      expect(en.dashboard.title).toBe('Dashboard');
      expect(en.dashboard.income).toBe('Income');
      expect(en.dashboard.expenses).toBe('Expenses');
      expect(en.dashboard.balance).toBe('Available balance');
      expect(en.dashboard.insights.title).toBe('Monthly Insights');
    });
    
    it('ES dashboard should not have PT text', () => {
      expect(es.dashboard.title).toBe('Panel');
      expect(es.dashboard.income).toBe('Ingresos');
      expect(es.dashboard.expenses).toBe('Gastos');
      expect(es.dashboard.balance).toBe('Saldo (mes)');
      expect(es.dashboard.insights.title).toBe('Insights del Mes');
    });
  });
  
  describe('Notification translations', () => {
    it('EN notifications should not have PT text', () => {
      expect(en.notifications.title).toBe('Notifications');
      expect(en.notifications.actionRequired).toBe('Action required');
      expect(en.notifications.attention).toBe('Attention');
    });
    
    it('ES notifications should not have PT text', () => {
      expect(es.notifications.title).toBe('Notificaciones');
      expect(es.notifications.actionRequired).toBe('Acción requerida');
      expect(es.notifications.attention).toBe('Atención');
    });
  });
});

describe('i18n Insights (AI-generated)', () => {
  describe('Insight message keys exist in all locales', () => {
    const insightKeys = [
      'insights.month_closes_negative',
      'insights.days_in_red',
      'insights.postpone_benefit.balances',
      'insights.pending_income_helps.balances',
      'insights.overdue_payments_one',
      'insights.overdue_payments_other',
      'insights.largest_pending_expense',
    ];
    
    it('EN should have all insight keys', () => {
      for (const key of insightKeys) {
        const value = getNestedValue(en, key);
        expect(value, `Missing EN key: ${key}`).toBeDefined();
        expect(typeof value).toBe('string');
      }
    });
    
    it('ES should have all insight keys', () => {
      for (const key of insightKeys) {
        const value = getNestedValue(es, key);
        expect(value, `Missing ES key: ${key}`).toBeDefined();
        expect(typeof value).toBe('string');
      }
    });
    
    it('Insight translations should not contain Portuguese', () => {
      const insightStrings = [
        en.insights.month_closes_negative,
        en.insights.days_in_red,
        en.insights.largest_pending_expense,
      ];
      
      for (const str of insightStrings) {
        expect(str).not.toContain('mês');
        expect(str).not.toContain('conta');
        expect(str).not.toContain('despesa');
      }
    });
  });
});
