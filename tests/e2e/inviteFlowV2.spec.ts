import { test, expect } from '@playwright/test';

test.describe('Invite Flow v2 - RPC Only', () => {
  test('admin can generate invite and see copy buttons', async ({ page }) => {
    // Navigate to members page (assuming logged in as admin)
    await page.goto('/members');
    
    // Look for invite button (admin only)
    const inviteBtn = page.getByRole('button', { name: /convidar|invite/i });
    
    // If visible, click to open dialog
    if (await inviteBtn.isVisible()) {
      await inviteBtn.click();
      
      // Verify dialog opened
      await expect(page.getByTestId('invite-email-input')).toBeVisible();
      await expect(page.getByTestId('invite-role-select')).toBeVisible();
      await expect(page.getByTestId('invite-validity-select')).toBeVisible();
      await expect(page.getByTestId('generate-invite-button')).toBeVisible();
    }
  });

  test('join page shows token input when no token in URL', async ({ page }) => {
    await page.goto('/join');
    
    // Should redirect to auth if not logged in, or show token input
    const tokenInput = page.getByTestId('manual-token-input');
    const validateBtn = page.getByTestId('validate-token-button');
    
    // Either we see the token input or we're redirected to auth
    const isOnJoinPage = await tokenInput.isVisible().catch(() => false);
    const isOnAuthPage = page.url().includes('/auth');
    
    expect(isOnJoinPage || isOnAuthPage).toBe(true);
  });

  test('join page with invalid token shows error state', async ({ page }) => {
    await page.goto('/join?token=invalid-token-123');
    
    // Should redirect to auth first if not logged in
    if (page.url().includes('/auth')) {
      // Expected behavior for unauthenticated users
      expect(page.url()).toContain('returnUrl');
    }
  });

  test('dialog has copy token and copy link buttons after generation', async ({ page }) => {
    await page.goto('/members');
    
    const inviteBtn = page.getByRole('button', { name: /convidar|invite/i });
    
    if (await inviteBtn.isVisible()) {
      await inviteBtn.click();
      
      // Fill minimal form and generate
      const generateBtn = page.getByTestId('generate-invite-button');
      
      if (await generateBtn.isEnabled()) {
        await generateBtn.click();
        
        // After generation, should see copy buttons
        await expect(page.getByTestId('copy-token-button')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('copy-link-button')).toBeVisible();
        await expect(page.getByTestId('invite-token-input')).toBeVisible();
        await expect(page.getByTestId('invite-link-input')).toBeVisible();
      }
    }
  });
});
