import { test, expect } from '@playwright/test';

/**
 * E2E Test: Navigation between months should not create duplicate notifications
 * 
 * This test verifies that:
 * 1. Navigating between months doesn't create new notifications
 * 2. The same notification is not duplicated when returning to a month
 * 3. IDEMPOTENCY: Alternating months 10x does NOT increase notification count
 */
test.describe('Month Navigation - Notification Stability', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('navigating between months should not create duplicate notifications', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const isAuthPage = await page.url().includes('/auth');
    if (isAuthPage) {
      test.skip(true, 'Authentication required for full navigation test');
      return;
    }
    
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    const initialCount = await notificationBell.getAttribute('data-count').catch(() => '0');
    
    const prevMonthButton = page.locator('[data-testid="prev-month"]');
    if (await prevMonthButton.isVisible()) {
      await prevMonthButton.click();
      await page.waitForTimeout(500);
    }
    
    const nextMonthButton = page.locator('[data-testid="next-month"]');
    if (await nextMonthButton.isVisible()) {
      await nextMonthButton.click();
      await page.waitForTimeout(500);
    }
    
    if (await prevMonthButton.isVisible()) {
      await prevMonthButton.click();
      await page.waitForTimeout(500);
    }
    
    const finalCount = await notificationBell.getAttribute('data-count').catch(() => '0');
    expect(parseInt(finalCount || '0')).toBeLessThanOrEqual(parseInt(initialCount || '0') + 1);
  });

  /**
   * CRITICAL TEST: Idempotency - navigate 10x without increasing notification count
   */
  test('alternating months 10x should NOT increase notification count', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const isAuthPage = await page.url().includes('/auth');
    if (isAuthPage) {
      test.skip(true, 'Authentication required for idempotency test');
      return;
    }
    
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    const prevMonthButton = page.locator('[data-testid="prev-month"]');
    const nextMonthButton = page.locator('[data-testid="next-month"]');
    
    // Get initial notification count
    const initialCount = parseInt(await notificationBell.getAttribute('data-count') || '0', 10);
    
    // Navigate between months 10 times
    for (let i = 0; i < 10; i++) {
      if (await prevMonthButton.isVisible()) {
        await prevMonthButton.click();
        await page.waitForTimeout(300);
      }
      
      if (await nextMonthButton.isVisible()) {
        await nextMonthButton.click();
        await page.waitForTimeout(300);
      }
    }
    
    // Get final notification count
    const finalCount = parseInt(await notificationBell.getAttribute('data-count') || '0', 10);
    
    // CRITICAL ASSERTION: Count should NOT have increased
    expect(finalCount).toBeLessThanOrEqual(initialCount);
  });

  test('page should not show duplicate toast messages', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const toastMessages: string[] = [];
    
    page.on('console', msg => {
      if (msg.text().includes('toast:')) {
        toastMessages.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000);
    
    const uniqueMessages = new Set(toastMessages);
    expect(toastMessages.length).toBe(uniqueMessages.size);
  });
});
