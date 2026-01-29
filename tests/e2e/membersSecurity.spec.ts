import { test, expect } from '@playwright/test';

test.describe('Members page security', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/members');
    await page.waitForLoadState('networkidle');
  });

  test('Members page loads and uses RPC for data', async ({ page }) => {
    const url = page.url();
    if (url.includes('/auth')) {
      test.skip(true, 'User not authenticated, skipping members security test');
      return;
    }

    // Page should load without errors
    const membersPage = page.locator('[data-testid="members-page"], main');
    await expect(membersPage).toBeVisible();
    
    // Check that member cards or empty state are rendered
    const memberCards = page.locator('[class*="Card"], [data-testid="empty-state"]');
    await expect(memberCards.first()).toBeVisible({ timeout: 5000 });
  });

  test('User can only see their own email (from JWT via RPC)', async ({ page }) => {
    const url = page.url();
    if (url.includes('/auth')) {
      test.skip(true, 'User not authenticated, skipping members security test');
      return;
    }

    // Wait for members to load
    await page.waitForTimeout(1000);
    
    // Get all visible text that looks like an email
    const pageContent = await page.textContent('body');
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const visibleEmails = pageContent?.match(emailPattern) || [];
    
    // RPC only returns email for the caller's own row
    // So at most 1 email should be visible
    expect(visibleEmails.length).toBeLessThanOrEqual(1);
  });

  test('Member list renders member names without exposing user_id', async ({ page }) => {
    const url = page.url();
    if (url.includes('/auth')) {
      test.skip(true, 'User not authenticated, skipping members security test');
      return;
    }

    // Wait for members to load
    await page.waitForTimeout(1000);
    
    // Check that member names are visible
    const memberCards = page.locator('[class*="card"]');
    const count = await memberCards.count();
    
    if (count > 0) {
      // At least one card should contain text (member name)
      const firstCard = memberCards.first();
      const cardText = await firstCard.textContent();
      expect(cardText).toBeTruthy();
      expect(cardText!.length).toBeGreaterThan(0);
    }

    // Verify no UUIDs are exposed in visible text
    const pageContent = await page.textContent('body');
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const visibleUuids = pageContent?.match(uuidPattern) || [];
    
    // No UUIDs should be visible in the page content
    expect(visibleUuids.length).toBe(0);
  });
});
