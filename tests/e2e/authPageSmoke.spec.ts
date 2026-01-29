import { test, expect } from '@playwright/test';

test.describe('Auth page smoke tests', () => {
  test('Auth page loads without blank screen', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    // Page should not be blank - look for the main container
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check for the auth form container
    const authContainer = page.locator('[class*="Card"], [class*="card"], form');
    await expect(authContainer.first()).toBeVisible({ timeout: 5000 });
  });

  test('Auth page shows login form elements', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    // Check for email input
    const emailInput = page.locator('input[type="email"], input[placeholder*="email"]');
    await expect(emailInput.first()).toBeVisible({ timeout: 5000 });

    // Check for password input
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput.first()).toBeVisible({ timeout: 5000 });

    // Check for submit button
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Entrar")');
    await expect(submitButton.first()).toBeVisible({ timeout: 5000 });
  });

  test('No useAuth error in console', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for any async errors
    await page.waitForTimeout(1000);

    // Check no useAuth errors
    const authProviderErrors = consoleErrors.filter(
      (err) => err.includes('useAuth') || err.includes('AuthProvider')
    );
    
    expect(authProviderErrors).toHaveLength(0);
  });

  test('Auth page has Sign in / Sign up tabs', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    // Check for tab elements (Sign in / Sign up)
    const signInTab = page.locator('button:has-text("Sign in"), button:has-text("Entrar"), [role="tab"]:has-text("Sign in")');
    const signUpTab = page.locator('button:has-text("Sign up"), button:has-text("Cadastrar"), [role="tab"]:has-text("Sign up")');

    // At least one should be visible
    const signInVisible = await signInTab.first().isVisible().catch(() => false);
    const signUpVisible = await signUpTab.first().isVisible().catch(() => false);

    expect(signInVisible || signUpVisible).toBe(true);
  });
});
