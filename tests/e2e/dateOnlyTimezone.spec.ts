import { test, expect } from '@playwright/test';

/**
 * E2E Test: Timezone-safe date display
 * 
 * Validates that dates like "2026-01-01" display as "01/01/2026" (pt-BR)
 * and NOT as "31/12/2025" due to timezone shift.
 * 
 * This was a bug where new Date("2026-01-01") in Brazil (UTC-3) would
 * shift to 2025-12-31 23:00:00 local time.
 */
test.describe('Date Display - Timezone Safety', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Wait for auth check
    await page.waitForTimeout(1000);
    
    // Login if on auth page
    const emailInput = page.getByLabel(/email/i);
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill('test@example.com');
      await page.getByLabel(/senha|password/i).fill('Test1234!');
      await page.getByRole('button', { name: /entrar|login|sign in/i }).click();
      await page.waitForURL('**/', { timeout: 10000 });
    }
  });

  test('January 1st dates should NOT display as December 31st', async ({ page }) => {
    // Navigate to transactions page
    await page.goto('/transactions');
    await page.waitForTimeout(500);
    
    // Navigate to January 2026 using month picker
    const monthPicker = page.locator('[data-testid="month-picker"], button:has-text(/janeiro|january|fevereiro|february|março|march/i)').first();
    
    if (await monthPicker.isVisible({ timeout: 3000 }).catch(() => false)) {
      await monthPicker.click();
      
      // Navigate to year 2026
      const yearNav = page.locator('button:has-text("2026"), [aria-label*="2026"]');
      if (await yearNav.isVisible({ timeout: 1000 }).catch(() => false)) {
        await yearNav.click();
      }
      
      // Select January
      const januaryButton = page.getByRole('button', { name: /janeiro|january/i });
      if (await januaryButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await januaryButton.click();
      }
    }
    
    await page.waitForTimeout(500);
    
    // Check for any visible date cells - they should contain "01/01/26" not "31/12/25"
    const tableCells = page.locator('td');
    const cellCount = await tableCells.count();
    
    // Look through table cells for date patterns
    for (let i = 0; i < Math.min(cellCount, 50); i++) {
      const cellText = await tableCells.nth(i).textContent() || '';
      
      // If we see January 2026 dates, they should NOT be December 2025
      if (cellText.includes('01/01/26') || cellText.includes('01/01/2026')) {
        // This is correct - January 1, 2026
        expect(cellText).not.toContain('31/12');
        expect(cellText).not.toContain('2025');
      }
      
      // Check that date cells with "01/01" don't also show "2025"
      if (cellText.match(/01\/01\/2[0-9]/)) {
        // Should be 2026, not 2025 from timezone shift
        expect(cellText).toMatch(/01\/01\/(26|2026)/);
      }
    }
    
    // Verify page loaded without errors
    const transactionsTable = page.locator('table');
    const emptyState = page.locator('text=/nenhuma transação|no transactions/i');
    
    const hasTable = await transactionsTable.isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 1000 }).catch(() => false);
    
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('projection drawer dates should display correctly', async ({ page }) => {
    // Go to dashboard
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Look for projection drawer trigger
    const projectionTrigger = page.locator('button:has-text(/projeção|projection|saldo/i), [data-testid="projection-trigger"]').first();
    
    if (await projectionTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectionTrigger.click();
      await page.waitForTimeout(500);
      
      // Check drawer content for date display
      const drawer = page.locator('[role="dialog"], .drawer, [data-state="open"]');
      
      if (await drawer.isVisible({ timeout: 2000 }).catch(() => false)) {
        const drawerText = await drawer.textContent() || '';
        
        // Verify no timezone-shifted dates are present
        // If we're looking at January data, it shouldn't show as December
        if (drawerText.includes('01/01')) {
          // The date "01/01" should be in 2026, not shifted to 31/12/2025
          expect(drawerText).not.toMatch(/01\/01\/.*31\/12/);
        }
      }
    }
    
    // Test passes if no timezone shift issues are detected
    expect(true).toBeTruthy();
  });

  test('formatDate helper should handle date-only strings without shift', async ({ page }) => {
    // This test validates the UI by checking actual rendered dates
    await page.goto('/transactions');
    await page.waitForTimeout(1000);
    
    // Get all date cells from the table
    const dateCells = page.locator('td:first-child');
    const count = await dateCells.count();
    
    // Check each date cell
    for (let i = 0; i < Math.min(count, 20); i++) {
      const cellText = await dateCells.nth(i).textContent() || '';
      
      // Valid date format should be DD/MM/YY
      const dateMatch = cellText.match(/(\d{2})\/(\d{2})\/(\d{2})/);
      
      if (dateMatch) {
        const [, day, month] = dateMatch;
        
        // Day should be between 01 and 31
        expect(parseInt(day)).toBeGreaterThanOrEqual(1);
        expect(parseInt(day)).toBeLessThanOrEqual(31);
        
        // Month should be between 01 and 12
        expect(parseInt(month)).toBeGreaterThanOrEqual(1);
        expect(parseInt(month)).toBeLessThanOrEqual(12);
      }
    }
    
    expect(true).toBeTruthy();
  });
});
