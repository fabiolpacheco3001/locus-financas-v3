import { test, expect } from '@playwright/test';

test.describe('Delete Recurring Budget', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to auth page and login if needed
    await page.goto('/auth');
    
    // Check if already logged in by looking for auth-related elements
    const loginButton = page.getByRole('button', { name: /entrar|sign in|iniciar sesión/i });
    if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Fill login form
      await page.getByPlaceholder(/email/i).fill('test@example.com');
      await page.getByPlaceholder(/senha|password|contraseña/i).fill('testpassword123');
      await loginButton.click();
      await page.waitForURL('/', { timeout: 10000 });
    }
  });

  test('should show confirmation dialog with bullets when clicking delete', async ({ page }) => {
    // Navigate to budget page
    await page.goto('/budget');
    await page.waitForLoadState('networkidle');

    // Click on Recurrences tab
    const recurrencesTab = page.getByTestId('budget-tab-recurrences');
    await recurrencesTab.click();

    // Check if there are any recurring budgets
    const deleteButton = page.getByTestId('delete-recurring-budget-btn').first();
    
    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click the delete button
      await deleteButton.click();

      // Verify the dialog is visible (AlertDialog)
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();

      // Verify dialog title (new i18n key: budget.recurring.delete.title)
      await expect(dialog.getByText(/excluir orçamento recorrente|delete recurring budget|eliminar presupuesto recurrente/i)).toBeVisible();

      // Verify bullet points are visible (new keys: b1, b2, b3)
      await expect(dialog.getByText(/orçamentos gerados automaticamente|automatically generated budgets|presupuestos generados automáticamente/i)).toBeVisible();
      await expect(dialog.getByText(/meses ajustados manualmente|manually adjusted months|meses ajustados manualmente/i)).toBeVisible();
      await expect(dialog.getByText(/irreversível|irreversible|irreversible/i)).toBeVisible();

      // Verify cutoff options are visible
      await expect(dialog.getByText(/excluir a partir de|delete from|eliminar desde/i)).toBeVisible();
      await expect(dialog.getByText(/mês atual|current month|mes actual/i)).toBeVisible();
      await expect(dialog.getByText(/todos os meses|all generated|todos los meses/i)).toBeVisible();

      // Verify Cancel and Delete buttons are present
      await expect(dialog.getByRole('button', { name: /cancelar|cancel/i })).toBeVisible();
      await expect(dialog.getByTestId('confirm-delete-recurring-budget')).toBeVisible();

      // Close dialog by clicking cancel
      await dialog.getByRole('button', { name: /cancelar|cancel/i }).click();
      await expect(dialog).not.toBeVisible();
    } else {
      // If no recurring budgets exist, we should see the empty state
      await expect(page.getByText(/nenhuma recorrência|no recurrences|no hay recurrencias/i)).toBeVisible();
    }
  });

  test('clicking cancel should not delete the recurring budget', async ({ page }) => {
    // Navigate to budget page
    await page.goto('/budget');
    await page.waitForLoadState('networkidle');

    // Click on Recurrences tab
    const recurrencesTab = page.getByTestId('budget-tab-recurrences');
    await recurrencesTab.click();

    // Count recurring budgets before
    const deleteButtons = page.getByTestId('delete-recurring-budget-btn');
    const initialCount = await deleteButtons.count();
    
    if (initialCount > 0) {
      // Click the delete button
      await deleteButtons.first().click();

      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();

      // Click Cancel button
      await dialog.getByRole('button', { name: /cancelar|cancel/i }).click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();

      // Count should remain the same
      const countAfterCancel = await deleteButtons.count();
      expect(countAfterCancel).toBe(initialCount);
    }
  });

  test('should allow selecting cutoff month option', async ({ page }) => {
    // Navigate to budget page
    await page.goto('/budget');
    await page.waitForLoadState('networkidle');

    // Click on Recurrences tab
    const recurrencesTab = page.getByTestId('budget-tab-recurrences');
    await recurrencesTab.click();

    // Check if there are any recurring budgets
    const deleteButton = page.getByTestId('delete-recurring-budget-btn').first();
    
    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click the delete button
      await deleteButton.click();

      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();

      // Check the "All months" radio option
      const allMonthsOption = dialog.getByLabel(/todos os meses|all generated|todos los meses/i);
      await allMonthsOption.click();
      await expect(allMonthsOption).toBeChecked();

      // Check the "Current month" radio option
      const currentMonthOption = dialog.getByLabel(/mês atual|current month|mes actual/i);
      await currentMonthOption.click();
      await expect(currentMonthOption).toBeChecked();

      // Close dialog
      await dialog.getByRole('button', { name: /cancelar|cancel/i }).click();
    }
  });

  test('confirming delete should remove recurring budget from list', async ({ page }) => {
    // Navigate to budget page
    await page.goto('/budget');
    await page.waitForLoadState('networkidle');

    // Click on Recurrences tab
    const recurrencesTab = page.getByTestId('budget-tab-recurrences');
    await recurrencesTab.click();

    // Count recurring budgets before deletion
    const deleteButtons = page.getByTestId('delete-recurring-budget-btn');
    const initialCount = await deleteButtons.count();

    if (initialCount > 0) {
      // Click the first delete button
      await deleteButtons.first().click();

      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();

      // Select "All months" to fully delete
      const allMonthsOption = dialog.getByLabel(/todos os meses|all generated|todos los meses/i);
      await allMonthsOption.click();

      // Click confirm delete
      await dialog.getByTestId('confirm-delete-recurring-budget').click();

      // Wait for dialog to close
      await expect(dialog).not.toBeVisible({ timeout: 5000 });

      // Verify success toast
      await expect(page.getByText(/excluído com sucesso|deleted successfully|eliminado con éxito/i)).toBeVisible({ timeout: 5000 });

      // Verify the count decreased or empty state is shown
      const newCount = await deleteButtons.count();
      expect(newCount).toBeLessThan(initialCount);
    }
  });
});
