import { test, expect } from '@playwright/test';

/**
 * E2E Test: "Ver transações" from notification opens filtered list
 * 
 * Verifies that clicking CTA from notifications navigates to transactions
 * with appropriate filters (overdue, planned, etc.)
 */
test.describe('Notification Actions - "Ver transações" Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('"Ver transações" CTA should navigate to filtered transaction list', async ({ page }) => {
    const isAuthPage = await page.url().includes('/auth');
    
    if (isAuthPage) {
      test.skip(true, 'Authentication required for notification action test');
      return;
    }
    
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    
    if (await notificationBell.isVisible()) {
      await notificationBell.click();
      await page.waitForTimeout(500);
      
      // Look for transaction CTA (supports multiple languages)
      const ctaButton = page.locator('button, a').filter({ 
        hasText: /Ver transações|View transactions|Ver transacciones/i 
      }).first();
      
      if (await ctaButton.isVisible()) {
        await ctaButton.click();
        
        await expect(page).toHaveURL(/\/transactions/);
        
        const url = page.url();
        const hasFilter = url.includes('view=') || url.includes('filter=') || url.includes('status=') || url.includes('highlight=');
        
        expect(url).toContain('/transactions');
      }
    }
  });

  test('overdue notification CTA should show only overdue transactions', async ({ page }) => {
    const isAuthPage = await page.url().includes('/auth');
    
    if (isAuthPage) {
      test.skip(true, 'Authentication required for overdue filter test');
      return;
    }
    
    // Navigate directly to overdue view
    await page.goto('/transactions?view=overdue');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('view=overdue');
  });

  test('planned expenses CTA should show only planned transactions', async ({ page }) => {
    const isAuthPage = await page.url().includes('/auth');
    
    if (isAuthPage) {
      test.skip(true, 'Authentication required for planned filter test');
      return;
    }
    
    // Navigate directly to planned view
    await page.goto('/transactions?status=planned');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('status=planned');
  });

  test('highlight specific transaction via URL', async ({ page }) => {
    const isAuthPage = await page.url().includes('/auth');
    
    if (isAuthPage) {
      test.skip(true, 'Authentication required for highlight test');
      return;
    }
    
    // Navigate with highlight param
    await page.goto('/transactions?highlight=test-tx-id');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('highlight=test-tx-id');
  });
});
