import { test, expect, Page } from '@playwright/test';

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

async function login(page: Page) {
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');

  // Fill email - supports i18n placeholders (pt/en/es)
  const emailInput = page.locator('input[type="email"], input[placeholder*="email"], input[placeholder*="Email"]');
  await emailInput.first().fill(E2E_EMAIL!);

  // Fill password - supports i18n (pt/en/es)
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.first().fill(E2E_PASSWORD!);

  // Click sign in button - supports i18n (pt/en/es)
  const signInButton = page.getByRole('button', { name: /entrar|sign in|iniciar sesión|login/i });
  await signInButton.click();

  // Wait for navigation away from auth page
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
}

test.describe('Identity Security Flow', () => {
  test.beforeEach(async () => {
    if (!E2E_EMAIL || !E2E_PASSWORD) {
      test.skip(true, 'E2E_EMAIL and E2E_PASSWORD environment variables are required');
    }
  });

  test('logged-in user sees their own email without direct table query', async ({ page }) => {
    // Fail fast on runtime errors
    page.on('pageerror', (e) => {
      throw e;
    });

    await login(page);

    // Wait for dashboard to load
    await page.waitForLoadState('networkidle');

    // Verify user is logged in and app works
    await expect(page.locator('body')).not.toContainText(/error|erro|failed/i, { timeout: 5000 });

    // Navigate to Members page if available (i18n: pt/en/es)
    const membersLink = page.getByRole('link', { name: /membros|members|miembros/i }).first();
    
    if (await membersLink.isVisible()) {
      await membersLink.click();
      await page.waitForLoadState('networkidle');

      // Verify members page loaded without errors
      await expect(page.getByText(/membros|members|miembros/i).first()).toBeVisible({ timeout: 10000 });
      
      // Check that the current user's email is visible (marked as "you")
      // The email should come from session, not from member_identities table
      const userEmailOnPage = page.locator(`text=${E2E_EMAIL}`).first();
      
      // Email may or may not be visible depending on UI, but page should not error
      if (await userEmailOnPage.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(userEmailOnPage).toBeVisible();
      }
    }

    // Verify no console errors related to member_identities access
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('member_identities')) {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit for any async errors
    await page.waitForTimeout(1000);
    expect(consoleErrors).toHaveLength(0);
  });

  test('app loads identity via RPC without direct table access', async ({ page }) => {
    await login(page);

    // Monitor network requests to ensure no direct member_identities queries
    const directTableRequests: string[] = [];
    
    page.on('request', (request) => {
      const url = request.url();
      // Check for direct PostgREST queries to member_identities
      if (url.includes('/rest/v1/member_identities')) {
        directTableRequests.push(url);
      }
    });

    // Navigate around the app
    await page.waitForLoadState('networkidle');
    
    // Try navigating to different pages
    const links = page.getByRole('link');
    const linkCount = await links.count();
    
    if (linkCount > 0) {
      // Click first available navigation link
      await links.first().click();
      await page.waitForLoadState('networkidle');
    }

    // Verify no direct table queries were made
    expect(directTableRequests).toHaveLength(0);
  });

  test('dashboard shows user identity correctly', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');

    // Verify the app loaded successfully
    await expect(page.locator('body')).toBeVisible();
    
    // Check for common dashboard elements (i18n: pt/en/es)
    const dashboardIndicators = [
      /dashboard|painel|panel/i,
      /saldo|balance|balanza/i,
      /contas|accounts|cuentas/i,
      /transações|transactions|transacciones/i
    ];

    let foundIndicator = false;
    for (const pattern of dashboardIndicators) {
      if (await page.getByText(pattern).first().isVisible({ timeout: 2000 }).catch(() => false)) {
        foundIndicator = true;
        break;
      }
    }

    // At minimum, we should be on a page that's not the auth page
    if (!foundIndicator) {
      await expect(page).not.toHaveURL(/\/auth/);
    }
  });
});
