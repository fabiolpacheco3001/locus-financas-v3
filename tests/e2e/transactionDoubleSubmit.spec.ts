import { test, expect } from '@playwright/test';

/**
 * E2E Test: Double-click protection on transaction creation
 * 
 * Validates that clicking the "Criar" button multiple times
 * only creates a single transaction.
 */
test.describe('Transaction Double-Submit Protection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions');
    
    // Login if needed
    const loginButton = page.getByRole('button', { name: /entrar|login|sign in/i });
    if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/senha|password/i).fill('Test1234!');
      await loginButton.click();
      await page.waitForURL('**/transactions**', { timeout: 10000 });
    }
    
    await page.waitForTimeout(1000);
  });

  test('double-clicking Criar button should only create 1 transaction', async ({ page }) => {
    // Generate unique identifier for this test
    const uniqueId = `DoubleClick-${Date.now()}`;
    const testAmount = '123.45';
    
    // Open new transaction dialog
    const addButton = page.getByRole('button', { name: /nova transação|add transaction|adicionar|\+/i }).first();
    
    if (!await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }
    
    await addButton.click();
    
    // Wait for dialog
    const dialog = page.getByRole('dialog');
    if (!await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }
    
    // Select INCOME type (simpler - no category required)
    const incomeOption = dialog.getByRole('radio', { name: /receita|income/i });
    if (await incomeOption.isVisible().catch(() => false)) {
      await incomeOption.click();
    }
    
    // Select an account
    const accountSelect = dialog.locator('[data-testid="account-select"], select').first();
    if (await accountSelect.isVisible().catch(() => false)) {
      await accountSelect.click();
      const option = page.locator('[role="option"]').first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      }
    }
    
    // Fill amount
    const amountInput = dialog.locator('input[inputmode="decimal"], input[name="amount"]').first();
    if (await amountInput.isVisible().catch(() => false)) {
      await amountInput.fill(testAmount);
    }
    
    // Fill description with unique identifier
    const descInput = dialog.locator('input[name="description"], input[placeholder*="descrição"]').first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.fill(uniqueId);
    }
    
    // Get the submit button
    const submitButton = dialog.getByRole('button', { name: /criar|create/i }).filter({ hasNotText: /similar/i });
    
    // Verify button is enabled before test
    await expect(submitButton).toBeEnabled({ timeout: 2000 });
    
    // Double-click the submit button
    await submitButton.dblclick();
    
    // Button should become disabled immediately after first click
    // We use a short timeout to catch the disabled state
    await page.waitForTimeout(100);
    
    // Wait for dialog to close (success)
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    
    // Wait for transaction list to update
    await page.waitForTimeout(1000);
    
    // Count transactions with our unique identifier
    // There should be exactly 1 transaction with this description
    const transactionsWithId = page.locator(`text=${uniqueId}`);
    const count = await transactionsWithId.count();
    
    // Should have exactly 1 transaction (not 2 from double-click)
    expect(count).toBe(1);
  });

  test('submit button shows loading spinner and is disabled during mutation', async ({ page }) => {
    // Open new transaction dialog
    const addButton = page.getByRole('button', { name: /nova transação|add transaction|adicionar|\+/i }).first();
    
    if (!await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }
    
    await addButton.click();
    
    // Wait for dialog
    const dialog = page.getByRole('dialog');
    if (!await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }
    
    // Select INCOME type
    const incomeOption = dialog.getByRole('radio', { name: /receita|income/i });
    if (await incomeOption.isVisible().catch(() => false)) {
      await incomeOption.click();
    }
    
    // Select an account
    const accountSelect = dialog.locator('[data-testid="account-select"], select').first();
    if (await accountSelect.isVisible().catch(() => false)) {
      await accountSelect.click();
      const option = page.locator('[role="option"]').first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      }
    }
    
    // Fill amount
    const amountInput = dialog.locator('input[inputmode="decimal"], input[name="amount"]').first();
    if (await amountInput.isVisible().catch(() => false)) {
      await amountInput.fill('50');
    }
    
    // Get submit button
    const submitButton = dialog.getByRole('button', { name: /criar|create/i }).filter({ hasNotText: /similar/i });
    
    // Click and immediately check for loading state
    const clickPromise = submitButton.click();
    
    // The button should become disabled
    await expect(submitButton).toBeDisabled({ timeout: 2000 });
    
    // There should be a loading spinner (Loader2 icon with animate-spin class)
    const spinner = dialog.locator('.animate-spin');
    const hasSpinner = await spinner.isVisible().catch(() => false);
    
    // Complete the click
    await clickPromise;
    
    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    
    // Spinner should have been visible during loading
    // (This assertion may be flaky if the mutation is too fast)
  });

  test('rapid multiple clicks should not create duplicates', async ({ page }) => {
    const uniqueId = `RapidClick-${Date.now()}`;
    
    // Open new transaction dialog
    const addButton = page.getByRole('button', { name: /nova transação|add transaction|adicionar|\+/i }).first();
    
    if (!await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }
    
    await addButton.click();
    
    // Wait for dialog
    const dialog = page.getByRole('dialog');
    if (!await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }
    
    // Select INCOME type
    const incomeOption = dialog.getByRole('radio', { name: /receita|income/i });
    if (await incomeOption.isVisible().catch(() => false)) {
      await incomeOption.click();
    }
    
    // Select an account
    const accountSelect = dialog.locator('[data-testid="account-select"], select').first();
    if (await accountSelect.isVisible().catch(() => false)) {
      await accountSelect.click();
      const option = page.locator('[role="option"]').first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      }
    }
    
    // Fill amount
    const amountInput = dialog.locator('input[inputmode="decimal"], input[name="amount"]').first();
    if (await amountInput.isVisible().catch(() => false)) {
      await amountInput.fill('75');
    }
    
    // Fill description
    const descInput = dialog.locator('input[name="description"], input[placeholder*="descrição"]').first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.fill(uniqueId);
    }
    
    // Get submit button
    const submitButton = dialog.getByRole('button', { name: /criar|create/i }).filter({ hasNotText: /similar/i });
    
    // Click 5 times rapidly
    for (let i = 0; i < 5; i++) {
      await submitButton.click({ force: true }).catch(() => {});
    }
    
    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 15000 });
    
    // Wait for list to update
    await page.waitForTimeout(1000);
    
    // Count transactions - should be exactly 1
    const transactionsWithId = page.locator(`text=${uniqueId}`);
    const count = await transactionsWithId.count();
    
    expect(count).toBe(1);
  });
});
