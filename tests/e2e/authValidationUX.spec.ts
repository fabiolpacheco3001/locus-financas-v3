import { test, expect } from '@playwright/test';

test.describe('Auth Form Validation UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
  });

  test('Auth E2E 1: no error icons shown on initial load', async ({ page }) => {
    // Check login tab is active by default
    const loginForm = page.locator('[data-testid="login-form"]');
    await expect(loginForm).toBeVisible();

    // Verify no error messages are visible initially
    const loginEmailError = page.locator('[data-testid="login-email-error"]');
    const loginPasswordError = page.locator('[data-testid="login-password-error"]');
    
    await expect(loginEmailError).not.toBeVisible();
    await expect(loginPasswordError).not.toBeVisible();

    // Switch to signup tab
    await page.locator('[data-testid="signup-tab"]').click();
    await expect(page.locator('[data-testid="signup-form"]')).toBeVisible();

    // Verify no error messages on signup form initially
    const signupNameError = page.locator('[data-testid="signup-name-error"]');
    const signupEmailError = page.locator('[data-testid="signup-email-error"]');
    const signupPasswordError = page.locator('[data-testid="signup-password-error"]');
    const signupConfirmError = page.locator('[data-testid="signup-confirm-error"]');

    await expect(signupNameError).not.toBeVisible();
    await expect(signupEmailError).not.toBeVisible();
    await expect(signupPasswordError).not.toBeVisible();
    await expect(signupConfirmError).not.toBeVisible();
  });

  test('Auth E2E 2: invalid email shows auth.errors.emailInvalid on blur', async ({ page }) => {
    // Type invalid email in login form
    const emailInput = page.locator('[data-testid="login-email-input"]');
    await emailInput.fill('not-an-email');
    
    // Blur the field (click elsewhere)
    await page.locator('[data-testid="login-password-input"]').click();

    // Error should now be visible with i18n text
    const emailError = page.locator('[data-testid="login-email-error"]');
    await expect(emailError).toBeVisible();
    // Matches pt-BR: "E-mail inválido", en: "Invalid email", es: "Correo inválido"
    await expect(emailError).toContainText(/invalid|inválido/i);

    // Fix the email - error should disappear
    await emailInput.fill('valid@email.com');
    await page.locator('[data-testid="login-password-input"]').click();
    await expect(emailError).not.toBeVisible();
  });

  test('Auth E2E 3: weak password shows auth.errors.passwordWeak and blocks submit on signup', async ({ page }) => {
    // Switch to signup tab
    await page.locator('[data-testid="signup-tab"]').click();
    await expect(page.locator('[data-testid="signup-form"]')).toBeVisible();

    // Fill all fields with valid data except weak password
    await page.locator('[data-testid="signup-name-input"]').fill('Test User');
    await page.locator('[data-testid="signup-email-input"]').fill('test@example.com');
    await page.locator('[data-testid="signup-password-input"]').fill('weak');
    await page.locator('[data-testid="signup-confirm-input"]').fill('weak');

    // Blur password field to trigger validation
    await page.locator('[data-testid="signup-confirm-input"]').click();

    // Password error should be visible with short i18n message
    const passwordError = page.locator('[data-testid="signup-password-error"]');
    await expect(passwordError).toBeVisible();
    // Matches pt-BR: "Mín. 8 caracteres", en: "Min. 8 characters", es: "Mín. 8 caracteres"
    // Or "Senha fraca...", "Weak password...", "Contraseña débil..."
    await expect(passwordError).toContainText(/mín|min|8|weak|fraca|débil/i);

    // Try to submit - should be blocked
    await page.locator('[data-testid="signup-submit"]').click();

    // Should still be on auth page (not navigated away)
    await expect(page).toHaveURL(/\/auth/);
    
    // Error should still be visible
    await expect(passwordError).toBeVisible();
  });

  test('valid strong password passes validation on signup', async ({ page }) => {
    // Switch to signup tab
    await page.locator('[data-testid="signup-tab"]').click();

    // Fill password with strong password
    const passwordInput = page.locator('[data-testid="signup-password-input"]');
    await passwordInput.fill('StrongPass123!');
    
    // Blur the field
    await page.locator('[data-testid="signup-confirm-input"]').click();

    // No password error should be visible
    const passwordError = page.locator('[data-testid="signup-password-error"]');
    await expect(passwordError).not.toBeVisible();
  });

  test('login form validates empty fields with emailInvalid and generic keys', async ({ page }) => {
    const emailInput = page.locator('[data-testid="login-email-input"]');
    const passwordInput = page.locator('[data-testid="login-password-input"]');

    // Test empty fields on submit
    await page.locator('[data-testid="login-submit"]').click();

    // Email error should show "emailInvalid" message
    const emailError = page.locator('[data-testid="login-email-error"]');
    await expect(emailError).toBeVisible();
    // Matches pt-BR: "E-mail inválido", en: "Invalid email", es: "Correo inválido"
    await expect(emailError).toContainText(/invalid|inválido/i);

    // Password error should show "generic" message  
    const passwordError = page.locator('[data-testid="login-password-error"]');
    await expect(passwordError).toBeVisible();

    // Fill valid email, password can be any length for login
    await emailInput.fill('user@example.com');
    await passwordInput.fill('123'); // Short password OK for login

    // Blur to update validation
    await emailInput.click();
    
    // No email error
    await expect(emailError).not.toBeVisible();
    
    // No password error
    await expect(passwordError).not.toBeVisible();
  });

  test('confirm password mismatch shows error on signup', async ({ page }) => {
    // Switch to signup tab
    await page.locator('[data-testid="signup-tab"]').click();

    // Fill different passwords
    await page.locator('[data-testid="signup-password-input"]').fill('StrongPass123!');
    await page.locator('[data-testid="signup-confirm-input"]').fill('DifferentPass456!');

    // Blur confirm field
    await page.locator('[data-testid="signup-name-input"]').click();

    // Confirm password error should be visible
    const confirmError = page.locator('[data-testid="signup-confirm-error"]');
    await expect(confirmError).toBeVisible();
    await expect(confirmError).toContainText(/match|conferem|coinciden/i);
  });

  test('invalid credentials shows auth.errors.invalidCredentials i18n toast', async ({ page }) => {
    // Fill with non-existent credentials
    await page.locator('[data-testid="login-email-input"]').fill('nonexistent@test.com');
    await page.locator('[data-testid="login-password-input"]').fill('WrongPassword123!');

    // Submit login
    await page.locator('[data-testid="login-submit"]').click();

    // Wait for the error toast - uses i18n key auth.errors.invalidCredentials
    // pt-BR: "Email ou senha inválidos."
    // en: "Invalid email or password."
    // es: "Correo o contraseña inválidos."
    const toast = page.locator('[data-sonner-toast]');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText(/invalid|inválid/i);
  });

  test('auth error toast uses i18n translated message', async ({ page }) => {
    // This test validates that errors from Supabase are mapped to i18n keys
    // and displayed as translated messages (not raw error codes)
    
    await page.locator('[data-testid="login-email-input"]').fill('test@nonexistent.com');
    await page.locator('[data-testid="login-password-input"]').fill('WrongPassword123!');
    await page.locator('[data-testid="login-submit"]').click();

    const toast = page.locator('[data-sonner-toast]');
    await expect(toast).toBeVisible({ timeout: 10000 });
    
    // Should NOT contain raw error codes like "invalid_credentials"
    const toastText = await toast.textContent();
    expect(toastText).not.toMatch(/^[a-z_]+$/); // Not a raw snake_case code
    
    // Should contain user-friendly translated text
    await expect(toast).toContainText(/\./); // Ends with period (our i18n messages do)
  });
});
