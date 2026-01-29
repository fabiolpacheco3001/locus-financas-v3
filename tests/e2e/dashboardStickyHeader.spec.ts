import { test, expect } from '@playwright/test';

test.describe('Dashboard sticky header', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (may redirect to auth, accept that)
    await page.goto('/');
    // Wait for content to load
    await page.waitForLoadState('networkidle');
  });

  test('Month picker remains visible after scrolling', async ({ page }) => {
    // Check if we're on the dashboard (not redirected to auth)
    const url = page.url();
    if (url.includes('/auth')) {
      // If redirected to auth, skip test with informational message
      test.skip(true, 'User not authenticated, skipping dashboard test');
      return;
    }

    // Find the month picker or month display in the sticky header
    const monthPicker = page.locator('[data-testid="dashboard-month-picker"]');
    
    // Verify it's initially visible
    await expect(monthPicker).toBeVisible();
    
    // Get initial position
    const initialBoundingBox = await monthPicker.boundingBox();
    expect(initialBoundingBox).not.toBeNull();
    
    // Scroll down significantly
    await page.evaluate(() => {
      window.scrollTo({ top: 500, behavior: 'instant' });
    });
    
    // Wait for scroll to complete
    await page.waitForTimeout(100);
    
    // Verify month picker is still visible
    await expect(monthPicker).toBeVisible();
    
    // Get position after scroll - should still be near top (sticky)
    const afterScrollBoundingBox = await monthPicker.boundingBox();
    expect(afterScrollBoundingBox).not.toBeNull();
    
    // The element should stay near the top of the viewport (sticky behavior)
    // It should be within the first 100px of the viewport
    expect(afterScrollBoundingBox!.y).toBeLessThan(100);
  });

  test('Month picker buttons are clickable after scrolling', async ({ page }) => {
    const url = page.url();
    if (url.includes('/auth')) {
      test.skip(true, 'User not authenticated, skipping dashboard test');
      return;
    }

    const monthPicker = page.locator('[data-testid="dashboard-month-picker"]');
    await expect(monthPicker).toBeVisible();
    
    // Get the current month text
    const monthText = monthPicker.locator('div.text-center');
    const initialMonth = await monthText.textContent();
    
    // Scroll down
    await page.evaluate(() => {
      window.scrollTo({ top: 400, behavior: 'instant' });
    });
    await page.waitForTimeout(100);
    
    // Click the previous month button (left chevron)
    const prevButton = monthPicker.locator('button').first();
    await prevButton.click();
    
    // Month should have changed
    await page.waitForTimeout(200);
    const newMonth = await monthText.textContent();
    expect(newMonth).not.toBe(initialMonth);
  });
});
