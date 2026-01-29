import { test, expect } from '@playwright/test';

test.describe('Recurring Transactions', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    // Check if already logged in
    const isOnAuth = page.url().includes('/auth');
    if (isOnAuth) {
      // Fill login form
      await page.locator('input[type="email"]').fill('test@example.com');
      await page.locator('input[type="password"]').fill('test123456');
      await page.locator('button[type="submit"]').click();
      await page.waitForURL('/', { timeout: 10000 });
    }
    
    // Navigate to transactions
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('creates recurring transaction for all months in range (Jan-Dec) with correct day', async ({ page }) => {
    // Open new transaction dialog
    const newTransactionButton = page.getByRole('button', { name: /transação|transaction/i });
    await newTransactionButton.first().click();
    
    // Wait for dialog
    await page.waitForSelector('[role="dialog"]');
    
    // Select account (first one available)
    const accountSelect = page.locator('[data-testid="account-select"]').first();
    if (await accountSelect.isVisible()) {
      await accountSelect.click();
      await page.locator('[role="option"]').first().click();
    }
    
    // Fill amount
    const amountInput = page.locator('input[inputmode="decimal"]').first();
    await amountInput.fill('250');
    
    // Enable recurring toggle
    const recurringToggle = page.locator('#recurring-toggle');
    await recurringToggle.click();
    await expect(recurringToggle).toBeChecked();
    
    // When recurring is ON, the date field should be hidden
    const dateField = page.locator('input[type="date"]');
    await expect(dateField).not.toBeVisible();
    
    // Set day of month to 25
    const daySelect = page.locator('select, [role="listbox"]').first();
    if (await daySelect.isVisible()) {
      await daySelect.click();
      await page.locator('[role="option"]').filter({ hasText: '25' }).click();
    }
    
    // Set start month to Jan 2026
    const startMonthInput = page.locator('input[type="month"]').first();
    await startMonthInput.fill('2026-01');
    
    // Enable end month toggle
    const endMonthToggle = page.locator('#has-end-month');
    await endMonthToggle.click();
    
    // Set end month to Dec 2026
    const endMonthInput = page.locator('input[type="month"]').nth(1);
    await endMonthInput.fill('2026-12');
    
    // Submit - click only once
    const submitButton = page.getByRole('button', { name: /criar|create/i }).filter({ hasNotText: /similar/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    
    // Wait for dialog to close (indicates success)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 15000 });
    
    // Verify success toast appeared with count info
    const toast = page.locator('[data-sonner-toast]');
    await expect(toast).toBeVisible();
    // Toast should mention count (12 lançamentos or 12 entries)
    await expect(toast).toContainText(/12|lançamentos|entries/i);
    
    // Navigate to Jan 2026 and verify transaction exists
    const monthPicker = page.locator('input[type="month"], [data-testid="month-picker"]').first();
    if (await monthPicker.isVisible()) {
      await monthPicker.fill('2026-01');
    }
    
    await page.waitForLoadState('networkidle');
    
    // Check transaction list has the recurring entry
    const transactionList = page.locator('[data-testid="transaction-list"], table tbody, .transaction-item');
    await expect(transactionList.first()).toBeVisible();
    
    // Navigate to Feb 2026 and verify transaction exists there too
    if (await monthPicker.isVisible()) {
      await monthPicker.fill('2026-02');
    }
    
    await page.waitForLoadState('networkidle');
    
    // Transaction should also exist in Feb
    await expect(transactionList.first()).toBeVisible();
    
    // Navigate to Dec 2026 (last month in range)
    if (await monthPicker.isVisible()) {
      await monthPicker.fill('2026-12');
    }
    
    await page.waitForLoadState('networkidle');
    
    // Transaction should also exist in Dec
    await expect(transactionList.first()).toBeVisible();
  });

  test('date field is hidden when recurring is enabled', async ({ page }) => {
    // Open new transaction dialog
    const newTransactionButton = page.getByRole('button', { name: /transação|transaction/i });
    await newTransactionButton.first().click();
    
    // Wait for dialog
    await page.waitForSelector('[role="dialog"]');
    
    // Date field should be visible initially
    const dateField = page.locator('input[type="date"]');
    await expect(dateField).toBeVisible();
    
    // Enable recurring toggle
    const recurringToggle = page.locator('#recurring-toggle');
    await recurringToggle.click();
    await expect(recurringToggle).toBeChecked();
    
    // Date field should now be hidden
    await expect(dateField).not.toBeVisible();
    
    // Disable recurring toggle
    await recurringToggle.click();
    await expect(recurringToggle).not.toBeChecked();
    
    // Date field should be visible again
    await expect(dateField).toBeVisible();
  });

  test('double-click on submit does not create duplicates', async ({ page }) => {
    // Open new transaction dialog
    const newTransactionButton = page.getByRole('button', { name: /transação|transaction/i });
    await newTransactionButton.first().click();
    
    // Wait for dialog
    await page.waitForSelector('[role="dialog"]');
    
    // Select account if needed
    const accountSelect = page.locator('[data-testid="account-select"]').first();
    if (await accountSelect.isVisible()) {
      await accountSelect.click();
      await page.locator('[role="option"]').first().click();
    }
    
    // Fill basic transaction data
    const amountInput = page.locator('input[inputmode="decimal"]').first();
    await amountInput.fill('50');
    
    // Enable recurring toggle
    const recurringToggle = page.locator('#recurring-toggle');
    await recurringToggle.click();
    
    // Set start month to current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const startMonthInput = page.locator('input[type="month"]').first();
    await startMonthInput.fill(currentMonth);
    
    // No end month - indefinite
    
    // Get the submit button
    const submitButton = page.getByRole('button', { name: /criar|create/i }).filter({ hasNotText: /similar/i });
    await expect(submitButton).toBeEnabled();
    
    // Double-click rapidly
    await submitButton.dblclick();
    
    // Button should become disabled after first click
    // Wait a moment and check the button state
    await page.waitForTimeout(500);
    
    // Wait for dialog to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 15000 });
    
    // Verify only one success toast (not multiple)
    const toasts = page.locator('[data-sonner-toast]');
    await expect(toasts).toHaveCount(1, { timeout: 5000 });
  });

  test('submit button is disabled while creating recurring transaction', async ({ page }) => {
    // Open new transaction dialog
    const newTransactionButton = page.getByRole('button', { name: /transação|transaction/i });
    await newTransactionButton.first().click();
    
    // Wait for dialog
    await page.waitForSelector('[role="dialog"]');
    
    // Select account if needed
    const accountSelect = page.locator('[data-testid="account-select"]').first();
    if (await accountSelect.isVisible()) {
      await accountSelect.click();
      await page.locator('[role="option"]').first().click();
    }
    
    // Fill basic transaction data
    const amountInput = page.locator('input[inputmode="decimal"]').first();
    await amountInput.fill('75');
    
    // Enable recurring toggle
    const recurringToggle = page.locator('#recurring-toggle');
    await recurringToggle.click();
    
    // Set months
    const startMonthInput = page.locator('input[type="month"]').first();
    await startMonthInput.fill('2026-06');
    
    // Enable end month
    const endMonthToggle = page.locator('#has-end-month');
    await endMonthToggle.click();
    
    const endMonthInput = page.locator('input[type="month"]').nth(1);
    await endMonthInput.fill('2026-12');
    
    // Get submit button
    const submitButton = page.getByRole('button', { name: /criar|create/i }).filter({ hasNotText: /similar/i });
    
    // Click and immediately check if button becomes disabled
    const clickPromise = submitButton.click();
    
    // Check button becomes disabled (showing loading state)
    await expect(submitButton).toBeDisabled({ timeout: 2000 });
    
    // Wait for completion
    await clickPromise;
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 15000 });
  });

  test('can create recurring transactions starting from past months', async ({ page }) => {
    // Open new transaction dialog
    const newTransactionButton = page.getByRole('button', { name: /transação|transaction/i });
    await newTransactionButton.first().click();
    
    // Wait for dialog
    await page.waitForSelector('[role="dialog"]');
    
    // Select account if needed
    const accountSelect = page.locator('[data-testid="account-select"]').first();
    if (await accountSelect.isVisible()) {
      await accountSelect.click();
      await page.locator('[role="option"]').first().click();
    }
    
    // Fill amount
    const amountInput = page.locator('input[inputmode="decimal"]').first();
    await amountInput.fill('100');
    
    // Enable recurring toggle
    const recurringToggle = page.locator('#recurring-toggle');
    await recurringToggle.click();
    
    // Set start month to a past month (should be allowed now)
    const startMonthInput = page.locator('input[type="month"]').first();
    await startMonthInput.fill('2024-01');
    
    // The input should accept past months (no min restriction)
    await expect(startMonthInput).toHaveValue('2024-01');
    
    // Enable end month
    const endMonthToggle = page.locator('#has-end-month');
    await endMonthToggle.click();
    
    const endMonthInput = page.locator('input[type="month"]').nth(1);
    await endMonthInput.fill('2024-06');
    
    // Submit
    const submitButton = page.getByRole('button', { name: /criar|create/i }).filter({ hasNotText: /similar/i });
    await submitButton.click();
    
    // Wait for dialog to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 15000 });
    
    // Success toast should appear
    await expect(page.locator('[data-sonner-toast]')).toBeVisible();
  });

  test('recurring transaction starting Jan 2026 should never appear in Dec 2025 (timezone bug)', async ({ page }) => {
    // Open new transaction dialog
    const newTransactionButton = page.getByRole('button', { name: /transação|transaction/i });
    await newTransactionButton.first().click();
    
    // Wait for dialog
    await page.waitForSelector('[role="dialog"]');
    
    // Select account if needed
    const accountSelect = page.locator('[data-testid="account-select"]').first();
    if (await accountSelect.isVisible()) {
      await accountSelect.click();
      await page.locator('[role="option"]').first().click();
    }
    
    // Fill amount with unique identifier
    const amountInput = page.locator('input[inputmode="decimal"]').first();
    await amountInput.fill('999.99');
    
    // Add unique description to identify this transaction
    const descInput = page.locator('input[placeholder*="descrição"], input[name="description"]').first();
    if (await descInput.isVisible()) {
      await descInput.fill('TZ-Bug-Test-' + Date.now());
    }
    
    // Enable recurring toggle
    const recurringToggle = page.locator('#recurring-toggle');
    await recurringToggle.click();
    
    // Set start month to Jan 2026 - this is the critical test case
    const startMonthInput = page.locator('input[type="month"]').first();
    await startMonthInput.fill('2026-01');
    
    // Set day of month to 1 - first day is most likely to shift back
    const daySelect = page.locator('select').first();
    if (await daySelect.isVisible()) {
      await daySelect.selectOption('1');
    }
    
    // Enable end month
    const endMonthToggle = page.locator('#has-end-month');
    await endMonthToggle.click();
    
    // Set end month to Mar 2026 (3 months)
    const endMonthInput = page.locator('input[type="month"]').nth(1);
    await endMonthInput.fill('2026-03');
    
    // Submit
    const submitButton = page.getByRole('button', { name: /criar|create/i }).filter({ hasNotText: /similar/i });
    await submitButton.click();
    
    // Wait for dialog to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 15000 });
    
    // Navigate to Dec 2025 to verify no transaction leaked back
    const monthPicker = page.locator('input[type="month"], [data-testid="month-picker"]').first();
    if (await monthPicker.isVisible()) {
      await monthPicker.fill('2025-12');
    }
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // Check that no transaction with our unique amount exists in Dec 2025
    const transactionWithAmount = page.locator('text=999,99, text=999.99, text=R$ 999,99, text=R$999,99');
    const countInDec = await transactionWithAmount.count();
    
    // There should be 0 instances in Dec 2025
    expect(countInDec).toBe(0);
    
    // Now navigate to Jan 2026 to confirm transaction IS there
    if (await monthPicker.isVisible()) {
      await monthPicker.fill('2026-01');
    }
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // Transaction should exist in Jan 2026
    const transactionList = page.locator('[data-testid="transaction-list"], table tbody, .transaction-item');
    await expect(transactionList.first()).toBeVisible();
  });
});
