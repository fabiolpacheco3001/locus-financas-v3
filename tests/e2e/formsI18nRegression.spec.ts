import { test, expect, Page } from '@playwright/test';

/**
 * Forms i18n Regression Test Suite
 * 
 * Validates that form fields and validation messages never display
 * raw translation keys in the UI.
 */

const LOCALES = ['pt-BR', 'en', 'es'] as const;

// Pattern to detect untranslated keys: word.word or word.word.word
const TRANSLATION_KEY_PATTERN = /\b[a-z]+\.[a-z]+(?:\.[a-z]+)*\b/gi;

// Known safe patterns that look like translation keys but aren't
const SAFE_PATTERNS = [
  /supabase\.co/i,
  /lovable\.app/i,
  /lovable\.dev/i,
  /example\.com/i,
  /\d+\.\d+/,  // Numbers like 1.5, 2.0
  /R\$\s*[\d.,]+/,  // Brazilian currency
  /\$[\d.,]+/,  // USD currency
  /€[\d.,]+/,  // EUR currency
  /seu@email\.com/i,  // Email placeholder
  /@[a-z]+\.[a-z]+/i,  // Email patterns
  /0,00/,  // Currency placeholder
  /\d{2}\/\d{2}\/\d{4}/,  // Date patterns
  /\d{4}-\d{2}-\d{2}/,  // ISO date patterns
];

// Valid translation namespaces that indicate missing translations
const TRANSLATION_NAMESPACES = [
  'common',
  'auth',
  'dashboard',
  'transactions',
  'budget',
  'accounts',
  'categories',
  'members',
  'notifications',
  'projection',
  'filters',
  'settings',
  'validation',
  'errors',
  'empty',
  'recurring',
  'form',
  'installments',
];

async function setLocale(page: Page, locale: string) {
  await page.addInitScript((loc) => {
    localStorage.setItem('i18nextLng', loc);
  }, locale);
}

async function login(page: Page) {
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');
  
  // Fill login form with test credentials
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'testpassword123');
  await page.click('button[type="submit"]');
  
  // Wait for navigation after login
  await page.waitForTimeout(2000);
}

function extractTextFromElement(text: string): string[] {
  // Split by common delimiters and filter empty strings
  return text.split(/[\s,;:!?\-–—]+/).filter(t => t.length > 0);
}

async function getVisibleTexts(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const getTextContent = (element: Element): string[] => {
      const texts: string[] = [];
      
      // Skip script, style, and hidden elements
      if (
        element.tagName === 'SCRIPT' || 
        element.tagName === 'STYLE' ||
        element.tagName === 'NOSCRIPT'
      ) {
        return texts;
      }
      
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return texts;
      }
      
      // Get direct text nodes
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text) {
            texts.push(text);
          }
        }
      }
      
      // Get placeholder, title, aria-label attributes
      const placeholder = element.getAttribute('placeholder');
      if (placeholder) texts.push(placeholder);
      
      const title = element.getAttribute('title');
      if (title) texts.push(title);
      
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) texts.push(ariaLabel);
      
      // Recurse into child elements
      for (const child of element.children) {
        texts.push(...getTextContent(child));
      }
      
      return texts;
    };
    
    return getTextContent(document.body);
  });
}

function checkForUntranslatedKeys(texts: string[]): string[] {
  const issues: string[] = [];

  for (const text of texts) {
    // Skip if it's a safe pattern
    if (SAFE_PATTERNS.some(pattern => pattern.test(text))) {
      continue;
    }

    // Check for translation key patterns
    const matches = text.match(TRANSLATION_KEY_PATTERN);
    if (matches) {
      for (const match of matches) {
        // Check if it starts with a known namespace
        const namespace = match.split('.')[0].toLowerCase();
        if (TRANSLATION_NAMESPACES.includes(namespace)) {
          issues.push(`Found untranslated key "${match}" in text: "${text}"`);
        }
      }
    }

    // Check for obvious missing translation indicators
    if (
      text.includes('undefined') ||
      text.includes('missingKey') ||
      text.includes('missing_key')
    ) {
      issues.push(`Found missing translation indicator in text: "${text}"`);
    }
  }

  return issues;
}

test.describe('Forms i18n Regression', () => {
  for (const locale of LOCALES) {
    test.describe(`Locale: ${locale}`, () => {
      test.beforeEach(async ({ page }) => {
        await setLocale(page, locale);
      });

      test('New Transaction modal has no untranslated keys', async ({ page }) => {
        await login(page);
        
        // Navigate to transactions page
        await page.goto('/transactions');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        // Click transaction creation button (with + icon and noun only)
        const newButton = page.locator('button:has-text("Transação"), button:has-text("Transaction"), button:has-text("Transacción")').first();
        
        if (await newButton.isVisible({ timeout: 5000 })) {
          await newButton.click();
          await page.waitForTimeout(500);
          
          // Get all visible texts from the modal
          const texts = await getVisibleTexts(page);
          const issues = checkForUntranslatedKeys(texts);
          
          if (issues.length > 0) {
            console.error(`i18n issues in New Transaction modal (${locale}):`);
            issues.forEach(issue => console.error(`  - ${issue}`));
          }
          
          expect(issues, `New Transaction modal should have no untranslated keys in ${locale}`).toHaveLength(0);
        } else {
          // If we can't find the button, we might not be logged in
          test.skip();
        }
      });

      test('Empty form submission shows translated validation errors', async ({ page }) => {
        await login(page);
        
        // Navigate to transactions page
        await page.goto('/transactions');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        // Open new transaction modal
        const newButton = page.locator('button:has-text("Transação"), button:has-text("Transaction"), button:has-text("Transacción")').first();
        
        if (await newButton.isVisible({ timeout: 5000 })) {
          await newButton.click();
          await page.waitForTimeout(500);
          
          // Try to submit empty form
          const submitButton = page.locator('button[type="submit"], button:has-text("Criar"), button:has-text("Create"), button:has-text("Crear")').last();
          
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(500);
            
            // Get all visible texts including validation messages
            const texts = await getVisibleTexts(page);
            const issues = checkForUntranslatedKeys(texts);
            
            if (issues.length > 0) {
              console.error(`i18n issues in validation messages (${locale}):`);
              issues.forEach(issue => console.error(`  - ${issue}`));
            }
            
            expect(issues, `Validation messages should be translated in ${locale}`).toHaveLength(0);
          }
        } else {
          test.skip();
        }
      });

      test('New Recurring Budget modal has no untranslated keys', async ({ page }) => {
        await login(page);
        
        // Navigate to budget page
        await page.goto('/budget');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        // Click recurring budget creation button (with + icon and noun only)
        const recurringButton = page.locator('button:has-text("Orçamento recorrente"), button:has-text("Recurring budget"), button:has-text("Presupuesto recurrente")').first();
        
        if (await recurringButton.isVisible({ timeout: 5000 })) {
          await recurringButton.click();
          await page.waitForTimeout(500);
          
          // Get all visible texts from the modal
          const texts = await getVisibleTexts(page);
          const issues = checkForUntranslatedKeys(texts);
          
          if (issues.length > 0) {
            console.error(`i18n issues in Recurring Budget modal (${locale}):`);
            issues.forEach(issue => console.error(`  - ${issue}`));
          }
          
          expect(issues, `Recurring Budget modal should have no untranslated keys in ${locale}`).toHaveLength(0);
        } else {
          test.skip();
        }
      });

      test('New Account modal has no untranslated keys', async ({ page }) => {
        await login(page);
        
        // Navigate to accounts page
        await page.goto('/accounts');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        // Click account creation button (with + icon and noun only)
        const newButton = page.locator('button:has-text("Conta"), button:has-text("Account"), button:has-text("Cuenta")').first();
        
        if (await newButton.isVisible({ timeout: 5000 })) {
          await newButton.click();
          await page.waitForTimeout(500);
          
          // Get all visible texts from the modal
          const texts = await getVisibleTexts(page);
          const issues = checkForUntranslatedKeys(texts);
          
          if (issues.length > 0) {
            console.error(`i18n issues in New Account modal (${locale}):`);
            issues.forEach(issue => console.error(`  - ${issue}`));
          }
          
          expect(issues, `New Account modal should have no untranslated keys in ${locale}`).toHaveLength(0);
        } else {
          test.skip();
        }
      });

      test('New Category modal has no untranslated keys', async ({ page }) => {
        await login(page);
        
        // Navigate to categories page
        await page.goto('/categories');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        // Click category creation button (with + icon and noun only)
        const newButton = page.locator('button:has-text("Categoria"), button:has-text("Category"), button:has-text("Categoría")').first();
        
        if (await newButton.isVisible({ timeout: 5000 })) {
          await newButton.click();
          await page.waitForTimeout(500);
          
          // Get all visible texts from the modal
          const texts = await getVisibleTexts(page);
          const issues = checkForUntranslatedKeys(texts);
          
          if (issues.length > 0) {
            console.error(`i18n issues in New Category modal (${locale}):`);
            issues.forEach(issue => console.error(`  - ${issue}`));
          }
          
          expect(issues, `New Category modal should have no untranslated keys in ${locale}`).toHaveLength(0);
        } else {
          test.skip();
        }
      });

      test('Notifications empty state has no untranslated keys', async ({ page }) => {
        await login(page);
        
        // Navigate to notifications page
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        // Get all visible texts from the page
        const texts = await getVisibleTexts(page);
        const issues = checkForUntranslatedKeys(texts);
        
        if (issues.length > 0) {
          console.error(`i18n issues in Notifications page (${locale}):`);
          issues.forEach(issue => console.error(`  - ${issue}`));
        }
        
        expect(issues, `Notifications page should have no untranslated keys in ${locale}`).toHaveLength(0);
      });
    });
  }

  test('Auth page forms have no untranslated keys in all locales', async ({ page }) => {
    for (const locale of LOCALES) {
      await setLocale(page, locale);
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      
      // Check login form
      let texts = await getVisibleTexts(page);
      let issues = checkForUntranslatedKeys(texts);
      
      if (issues.length > 0) {
        console.error(`i18n issues in Login form (${locale}):`);
        issues.forEach(issue => console.error(`  - ${issue}`));
      }
      
      expect(issues, `Login form should have no untranslated keys in ${locale}`).toHaveLength(0);
      
      // Switch to signup tab if available
      const signupTab = page.locator('button:has-text("Sign up"), button:has-text("Criar conta"), button:has-text("Registrarse")').first();
      
      if (await signupTab.isVisible()) {
        await signupTab.click();
        await page.waitForTimeout(500);
        
        texts = await getVisibleTexts(page);
        issues = checkForUntranslatedKeys(texts);
        
        if (issues.length > 0) {
          console.error(`i18n issues in Signup form (${locale}):`);
          issues.forEach(issue => console.error(`  - ${issue}`));
        }
        
        expect(issues, `Signup form should have no untranslated keys in ${locale}`).toHaveLength(0);
      }
    }
  });

  test('Auth form validation errors are translated', async ({ page }) => {
    for (const locale of LOCALES) {
      await setLocale(page, locale);
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');
      
      // Try to submit with invalid email
      await page.fill('input[type="email"]', 'invalid-email');
      await page.fill('input[type="password"]', '123');
      await page.click('button[type="submit"]');
      
      await page.waitForTimeout(500);
      
      const texts = await getVisibleTexts(page);
      const issues = checkForUntranslatedKeys(texts);
      
      if (issues.length > 0) {
        console.error(`i18n issues in Auth validation (${locale}):`);
        issues.forEach(issue => console.error(`  - ${issue}`));
      }
      
      expect(issues, `Auth validation messages should be translated in ${locale}`).toHaveLength(0);
    }
  });
});
