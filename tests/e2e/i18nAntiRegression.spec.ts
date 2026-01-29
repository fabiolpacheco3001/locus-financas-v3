import { test, expect, Page } from '@playwright/test';

/**
 * i18n Anti-Regression Test Suite
 * 
 * Validates that no translation keys are rendered as raw text in the UI.
 * Checks all main pages, modals, drawers, tooltips, and empty states 
 * for patterns like "namespace.key" which indicate missing translations.
 * 
 * Runs in both desktop and mobile viewports for pt-BR, en, es.
 */

const LOCALES = ['pt-BR', 'en', 'es'] as const;

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const PAGES = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/transactions', name: 'Transactions' },
  { path: '/budget', name: 'Budget' },
  { path: '/accounts', name: 'Accounts' },
  { path: '/categories', name: 'Categories' },
  { path: '/members', name: 'Members' },
  { path: '/notifications', name: 'Notifications' },
];

// Pattern to detect untranslated keys: word.word or word.word.word etc
// Uses word boundaries and requires at least one dot
const I18N_KEY_PATTERN = /\b[a-zA-Z]+(\.[a-zA-Z0-9_-]+)+\b/g;

// Known safe patterns that look like translation keys but aren't
const SAFE_PATTERNS = [
  /supabase\.co/i,
  /lovable\.app/i,
  /lovable\.dev/i,
  /example\.com/i,
  /gmail\.com/i,
  /\d+\.\d+/,  // Numbers like 1.5, 2.0
  /R\$\s*[\d.,]+/,  // Brazilian currency
  /\$[\d.,]+/,  // USD currency
  /€[\d.,]+/,  // EUR currency
  /^\d{2}\.\d{2}$/,  // Date patterns like 01.01
  /^\d{1,2}\.\d{1,2}\.\d{2,4}$/,  // Date patterns like 1.1.2024
  /\d+\.\d+\s*(MB|KB|GB)/i,  // File sizes
  /v\d+\.\d+/i,  // Version numbers
  /min\.js/i,  // JS files
  /\.tsx?$/i,  // TypeScript files
  /\.jsx?$/i,  // JavaScript files
  /\.css$/i,  // CSS files
];

// Valid translation namespaces in our app
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
  'messages',
  'toasts',
  'insights',
  'status',
  'simulation',
  'installments',
  'nav',
];

// Forbidden strings that indicate missing translations
const FORBIDDEN_STRINGS = ['missingkey', 'missing_key', 'undefined', 'null'];

async function setLocale(page: Page, locale: string) {
  await page.addInitScript((loc) => {
    localStorage.setItem('i18nextLng', loc);
  }, locale);
}

async function getAllVisibleText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const getTextContent = (element: Element): string[] => {
      const texts: string[] = [];
      
      // Skip script and style elements
      if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
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
      
      // Get placeholder, aria-label, title, data-tooltip attributes
      const attrTexts = ['placeholder', 'aria-label', 'title', 'data-tooltip'];
      for (const attr of attrTexts) {
        const value = element.getAttribute(attr);
        if (value?.trim()) {
          texts.push(value.trim());
        }
      }
      
      // Recurse into child elements
      for (const child of element.children) {
        texts.push(...getTextContent(child));
      }
      
      return texts;
    };
    
    return getTextContent(document.body);
  });
}

function detectI18nIssues(texts: string[]): string[] {
  const issues: string[] = [];

  for (const text of texts) {
    // Skip empty
    if (!text || text.length < 3) continue;

    // Skip if it's a safe pattern
    if (SAFE_PATTERNS.some(pattern => pattern.test(text))) {
      continue;
    }

    // Check for translation key patterns
    const matches = text.match(I18N_KEY_PATTERN);
    if (matches) {
      for (const match of matches) {
        // Check if it starts with a known namespace
        const namespace = match.split('.')[0].toLowerCase();
        if (TRANSLATION_NAMESPACES.includes(namespace)) {
          issues.push(`Untranslated key "${match}" in: "${text.substring(0, 100)}"`);
        }
      }
    }

    // Check for forbidden strings
    const lowerText = text.toLowerCase();
    for (const forbidden of FORBIDDEN_STRINGS) {
      if (lowerText === forbidden || lowerText.includes(forbidden)) {
        issues.push(`Forbidden string "${forbidden}" found in: "${text.substring(0, 100)}"`);
        break;
      }
    }
  }

  return [...new Set(issues)]; // Dedupe
}

/**
 * Central helper that asserts no i18n keys are visible on the current page.
 * Takes a screenshot on failure for debugging.
 */
async function assertNoI18nKeysVisible(
  page: Page, 
  context: string, 
  locale: string,
  viewportName: string
): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);

  const allText = await getAllVisibleText(page);
  const issues = detectI18nIssues(allText);

  if (issues.length > 0) {
    // Take screenshot for debugging
    const screenshotName = `i18n-fail-${context.replace(/\s+/g, '-')}-${locale}-${viewportName}.png`;
    await page.screenshot({ path: `test-results/${screenshotName}`, fullPage: true });
    
    console.error(`\n❌ i18n issues in [${context}] (${locale}, ${viewportName}):`);
    issues.forEach(issue => console.error(`   • ${issue}`));
    console.error(`   📸 Screenshot saved: test-results/${screenshotName}\n`);
  }

  expect(issues, `[${context}] should have no untranslated keys (${locale}, ${viewportName})`).toHaveLength(0);
}

async function isOnAuthPage(page: Page): Promise<boolean> {
  return page.url().includes('/auth');
}

test.describe('i18n Anti-Regression Suite', () => {
  
  // ==========================================
  // Auth Page Tests
  // ==========================================
  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      test.describe(`[${viewport.name}] Auth - ${locale}`, () => {
        test.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await setLocale(page, locale);
        });

        test('Auth page has no untranslated keys', async ({ page }) => {
          await page.goto('/auth');
          await assertNoI18nKeysVisible(page, 'Auth Page', locale, viewport.name);
        });

        test('Auth validation errors have no untranslated keys', async ({ page }) => {
          await page.goto('/auth');
          await page.waitForLoadState('networkidle');
          
          // Try to submit empty form to trigger validation
          const submitButton = page.locator('button[type="submit"]').first();
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(500);
          }
          
          await assertNoI18nKeysVisible(page, 'Auth Validation', locale, viewport.name);
        });
      });
    }
  }

  // ==========================================
  // Notifications Tests (Empty State + Bell)
  // ==========================================
  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      test.describe(`[${viewport.name}] Notifications - ${locale}`, () => {
        test.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await setLocale(page, locale);
        });

        test('Notifications page empty state has no untranslated keys', async ({ page }) => {
          await page.goto('/notifications');
          await page.waitForLoadState('networkidle');
          
          if (await isOnAuthPage(page)) {
            await assertNoI18nKeysVisible(page, 'Auth (redirect)', locale, viewport.name);
          } else {
            // Wait for empty state to render
            await page.waitForTimeout(500);
            await assertNoI18nKeysVisible(page, 'Notifications Empty State', locale, viewport.name);
          }
        });

        test('Notification bell dropdown has no untranslated keys', async ({ page }) => {
          await page.goto('/dashboard');
          await page.waitForLoadState('networkidle');
          
          if (!(await isOnAuthPage(page))) {
            const bellButton = page.locator('button:has(svg.lucide-bell)').first();
            
            if (await bellButton.isVisible()) {
              await bellButton.click();
              await page.waitForTimeout(500);
              await assertNoI18nKeysVisible(page, 'Notification Bell Dropdown', locale, viewport.name);
            }
          }
        });
      });
    }
  }

  // ==========================================
  // Transaction Modal Tests
  // ==========================================
  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      test.describe(`[${viewport.name}] Transaction Modal - ${locale}`, () => {
        test.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await setLocale(page, locale);
        });

        test('New Transaction modal content has no untranslated keys', async ({ page }) => {
          await page.goto('/transactions');
          await page.waitForLoadState('networkidle');
          
          if (!(await isOnAuthPage(page))) {
            // Open new transaction modal
            const newButton = page.locator('button:has-text("Nova"), button:has-text("New"), button:has-text("Nueva")').first();
            
            if (await newButton.isVisible()) {
              await newButton.click();
              await page.waitForTimeout(500);
              
              // Scroll modal content to see all fields
              const modalContent = page.locator('[role="dialog"]');
              if (await modalContent.isVisible()) {
                await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);
                await page.waitForTimeout(200);
              }
              
              await assertNoI18nKeysVisible(page, 'New Transaction Modal', locale, viewport.name);
            }
          }
        });

        test('New Transaction validation errors have no untranslated keys', async ({ page }) => {
          await page.goto('/transactions');
          await page.waitForLoadState('networkidle');
          
          if (!(await isOnAuthPage(page))) {
            const newButton = page.locator('button:has-text("Nova"), button:has-text("New"), button:has-text("Nueva")').first();
            
            if (await newButton.isVisible()) {
              await newButton.click();
              await page.waitForTimeout(500);
              
              // Try to save without filling required fields
              const saveButton = page.locator('button:has-text("Salvar"), button:has-text("Save"), button:has-text("Guardar")').first();
              
              if (await saveButton.isVisible()) {
                await saveButton.click();
                await page.waitForTimeout(500);
              }
              
              await assertNoI18nKeysVisible(page, 'Transaction Validation Errors', locale, viewport.name);
            }
          }
        });
      });
    }
  }

  // ==========================================
  // Budget Page + Recurring Modal + Subcategories + Tooltips
  // ==========================================
  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      test.describe(`[${viewport.name}] Budget - ${locale}`, () => {
        test.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await setLocale(page, locale);
        });

        test('Budget page has no untranslated keys', async ({ page }) => {
          await page.goto('/budget');
          await page.waitForLoadState('networkidle');
          
          if (!(await isOnAuthPage(page))) {
            await assertNoI18nKeysVisible(page, 'Budget Page', locale, viewport.name);
          }
        });

        test('Budget subcategory expand/collapse has no untranslated keys', async ({ page }) => {
          await page.goto('/budget');
          await page.waitForLoadState('networkidle');
          
          if (!(await isOnAuthPage(page))) {
            // Find and click accordion/collapsible triggers for subcategories
            const accordionTriggers = page.locator('[data-state="closed"][role="button"], button:has(svg.lucide-chevron-down), button:has(svg.lucide-chevron-right)');
            const count = await accordionTriggers.count();
            
            // Expand first few subcategories if available
            for (let i = 0; i < Math.min(3, count); i++) {
              const trigger = accordionTriggers.nth(i);
              if (await trigger.isVisible()) {
                await trigger.click();
                await page.waitForTimeout(300);
              }
            }
            
            await assertNoI18nKeysVisible(page, 'Budget Subcategories Expanded', locale, viewport.name);
            
            // Collapse them back
            for (let i = 0; i < Math.min(3, count); i++) {
              const trigger = accordionTriggers.nth(i);
              if (await trigger.isVisible()) {
                await trigger.click();
                await page.waitForTimeout(200);
              }
            }
            
            await assertNoI18nKeysVisible(page, 'Budget Subcategories Collapsed', locale, viewport.name);
          }
        });

        test('Budget tooltip/icon actions have no untranslated keys', async ({ page }) => {
          await page.goto('/budget');
          await page.waitForLoadState('networkidle');
          
          if (!(await isOnAuthPage(page))) {
            // Hover over icons that may show tooltips (repeat, plus, etc.)
            const iconButtons = page.locator('button:has(svg.lucide-repeat), button:has(svg.lucide-plus), button:has(svg.lucide-calendar)');
            const count = await iconButtons.count();
            
            for (let i = 0; i < Math.min(5, count); i++) {
              const icon = iconButtons.nth(i);
              if (await icon.isVisible()) {
                await icon.hover();
                await page.waitForTimeout(400); // Wait for tooltip
              }
            }
            
            await assertNoI18nKeysVisible(page, 'Budget Tooltips', locale, viewport.name);
          }
        });

        test('Recurring Budget modal has no untranslated keys', async ({ page }) => {
          await page.goto('/budget');
          await page.waitForLoadState('networkidle');
          
          if (!(await isOnAuthPage(page))) {
            // Try to open recurring budget modal
            const recurringButton = page.locator('button:has-text("Recorrente"), button:has-text("Recurring"), button:has-text("Recurrente")').first();
            
            if (await recurringButton.isVisible()) {
              await recurringButton.click();
              await page.waitForTimeout(500);
              await assertNoI18nKeysVisible(page, 'Recurring Budget Modal', locale, viewport.name);
            }
          }
        });

        test('Recurring Budget validation errors have no untranslated keys', async ({ page }) => {
          await page.goto('/budget');
          await page.waitForLoadState('networkidle');
          
          if (!(await isOnAuthPage(page))) {
            const recurringButton = page.locator('button:has-text("Recorrente"), button:has-text("Recurring"), button:has-text("Recurrente")').first();
            
            if (await recurringButton.isVisible()) {
              await recurringButton.click();
              await page.waitForTimeout(500);
              
              // Try to create without filling required fields
              const createButton = page.locator('button:has-text("Criar"), button:has-text("Create"), button:has-text("Crear")').first();
              
              if (await createButton.isVisible()) {
                await createButton.click();
                await page.waitForTimeout(500);
              }
              
              await assertNoI18nKeysVisible(page, 'Recurring Budget Validation', locale, viewport.name);
            }
          }
        });

        test('Create recurring for subcategory icon has no untranslated keys', async ({ page }) => {
          await page.goto('/budget');
          await page.waitForLoadState('networkidle');
          
          if (!(await isOnAuthPage(page))) {
            // Look for subcategory recurring icon (usually a repeat icon in rows)
            const subcategoryRecurringIcon = page.locator('button:has(svg.lucide-repeat)').first();
            
            if (await subcategoryRecurringIcon.isVisible()) {
              // Hover to show tooltip
              await subcategoryRecurringIcon.hover();
              await page.waitForTimeout(400);
              
              await assertNoI18nKeysVisible(page, 'Subcategory Recurring Tooltip', locale, viewport.name);
              
              // Click to potentially open modal
              await subcategoryRecurringIcon.click();
              await page.waitForTimeout(500);
              
              await assertNoI18nKeysVisible(page, 'Subcategory Recurring Action', locale, viewport.name);
            }
          }
        });
      });
    }
  }

  // ==========================================
  // Other Modals (Account, Category, Member)
  // ==========================================
  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      test.describe(`[${viewport.name}] Other Modals - ${locale}`, () => {
        test.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await setLocale(page, locale);
        });

        test('New Account modal has no untranslated keys', async ({ page }) => {
          await page.goto('/accounts');
          await page.waitForLoadState('networkidle');
          
          if (!(await isOnAuthPage(page))) {
            const newButton = page.locator('button:has-text("Nova"), button:has-text("New"), button:has-text("Nueva")').first();
            
            if (await newButton.isVisible()) {
              await newButton.click();
              await page.waitForTimeout(500);
              await assertNoI18nKeysVisible(page, 'New Account Modal', locale, viewport.name);
            }
          }
        });

        test('New Category modal has no untranslated keys', async ({ page }) => {
          await page.goto('/categories');
          await page.waitForLoadState('networkidle');
          
          if (!(await isOnAuthPage(page))) {
            const newButton = page.locator('button:has-text("Nova"), button:has-text("New"), button:has-text("Nueva")').first();
            
            if (await newButton.isVisible()) {
              await newButton.click();
              await page.waitForTimeout(500);
              await assertNoI18nKeysVisible(page, 'New Category Modal', locale, viewport.name);
            }
          }
        });

        test('New Member modal has no untranslated keys', async ({ page }) => {
          await page.goto('/members');
          await page.waitForLoadState('networkidle');
          
          if (!(await isOnAuthPage(page))) {
            const newButton = page.locator('button:has-text("Novo"), button:has-text("New"), button:has-text("Nuevo")').first();
            
            if (await newButton.isVisible()) {
              await newButton.click();
              await page.waitForTimeout(500);
              await assertNoI18nKeysVisible(page, 'New Member Modal', locale, viewport.name);
            }
          }
        });
      });
    }
  }

  // ==========================================
  // Language Selector Test
  // ==========================================
  test('Language selector changes content correctly', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    const initialLoginText = await page.locator('button[type="submit"]').first().textContent();
    
    const languageButton = page.locator('[data-testid="language-selector"], button:has-text("PT-BR"), button:has-text("EN"), button:has-text("ES")').first();
    
    if (await languageButton.isVisible()) {
      await languageButton.click();
      
      const enOption = page.locator('text=English, text=EN').first();
      if (await enOption.isVisible()) {
        await enOption.click();
        await page.waitForTimeout(500);
        
        const newLoginText = await page.locator('button[type="submit"]').first().textContent();
        
        if (initialLoginText?.includes('Entrar')) {
          expect(newLoginText).not.toContain('Entrar');
        }
      }
    }
  });

  // ==========================================
  // Mobile Navigation Menu
  // ==========================================
  for (const locale of LOCALES) {
    test.describe(`[mobile] Navigation Menu - ${locale}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await setLocale(page, locale);
      });

      test('Mobile menu has no untranslated keys', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');
        
        if (!(await isOnAuthPage(page))) {
          const menuButton = page.locator('button:has(svg.lucide-menu), button:has(svg.lucide-panel-left)').first();
          
          if (await menuButton.isVisible()) {
            await menuButton.click();
            await page.waitForTimeout(500);
            await assertNoI18nKeysVisible(page, 'Mobile Menu', locale, 'mobile');
          }
        }
      });
    });
  }
});
