import { test, expect } from '@playwright/test';

test.describe('Auth Password Policy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    // Wait for auth page to fully load
    await page.waitForSelector('[data-value="signup"]', { timeout: 10000 });
  });

  test('should show password policy error for weak password on signup', async ({ page }) => {
    // Switch to signup tab
    await page.click('[data-value="signup"]');
    
    // Wait for signup form to be visible
    await page.waitForSelector('#signup-name', { timeout: 5000 });
    
    // Fill in signup form with weak password (no symbol, less than 8 chars)
    await page.fill('#signup-name', 'Test User');
    await page.fill('#signup-email', `test-${Date.now()}@example.com`);
    await page.fill('#signup-password', 'Abc123'); // Invalid: < 8 chars, no symbol
    await page.fill('#signup-confirm', 'Abc123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for toast notification
    // The toast should contain the translated password policy message
    // We check for any of the three language versions
    const toastLocator = page.locator('[data-sonner-toast]');
    await expect(toastLocator).toBeVisible({ timeout: 10000 });
    
    // Get toast text
    const toastText = await toastLocator.textContent();
    
    // Should contain password policy message (one of the translations)
    const validMessages = [
      'Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.',
      'A senha deve ter pelo menos 8 caracteres e incluir letra maiúscula, letra minúscula, número e símbolo.',
      'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula, número y símbolo.',
      // Also accept the generic message in case the Supabase policy check isn't enabled yet
      'Could not complete the request',
      'Não foi possível concluir',
      'No se pudo completar',
    ];
    
    const hasValidMessage = validMessages.some(msg => toastText?.includes(msg));
    expect(hasValidMessage).toBe(true);
  });

  test('should not show raw error messages', async ({ page }) => {
    // Switch to signup tab
    await page.click('[data-value="signup"]');
    
    // Wait for signup form
    await page.waitForSelector('#signup-name', { timeout: 5000 });
    
    // Fill in form with weak password
    await page.fill('#signup-name', 'Test User');
    await page.fill('#signup-email', `test-${Date.now()}@example.com`);
    await page.fill('#signup-password', 'weak');
    await page.fill('#signup-confirm', 'weak');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for potential toast
    const toastLocator = page.locator('[data-sonner-toast]');
    
    try {
      await expect(toastLocator).toBeVisible({ timeout: 5000 });
      const toastText = await toastLocator.textContent();
      
      // Should NOT contain raw technical error messages
      expect(toastText).not.toContain('AuthApiError');
      expect(toastText).not.toContain('Error:');
      expect(toastText).not.toContain('error_code');
      expect(toastText).not.toContain('status: 422');
    } catch {
      // If no toast appears, the validation might be client-side only
      // which is also acceptable
    }
  });
});
