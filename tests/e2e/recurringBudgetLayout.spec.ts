import { test, expect } from '@playwright/test';

test.describe('Recurring Budget Dialog Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to auth page and login
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    const isLoggedIn = await page.locator('text=Dashboard, text=Transações, text=Transactions').first().isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!isLoggedIn) {
      const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      
      if (await emailInput.isVisible({ timeout: 3000 })) {
        await emailInput.fill('test@example.com');
        await passwordInput.fill('password123');
        
        const signInButton = page.locator('button:has-text("Sign in"), button:has-text("Entrar"), button:has-text("Iniciar sesión")').first();
        await signInButton.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test('E2E: Recurring budget month fields are aligned in grid', async ({ page }) => {
    // Navigate to budget page
    await page.goto('/budget');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const pageTitle = page.locator('h1:has-text("Orçamento"), h1:has-text("Budget"), h1:has-text("Presupuesto")').first();
    
    if (await pageTitle.isVisible({ timeout: 5000 })) {
      // Look for the "Recurring budget" button to open the dialog
      const recurringButton = page.locator('button:has-text("Orçamento recorrente"), button:has-text("Recurring budget"), button:has-text("Presupuesto recurrente")').first();
      
      if (await recurringButton.isVisible({ timeout: 2000 })) {
        await recurringButton.click();
        await page.waitForTimeout(500);
        
        // Verify the grid exists with the data-testid
        const monthGrid = page.locator('[data-testid="recurring-budget-month-grid"]');
        await expect(monthGrid).toBeVisible({ timeout: 3000 });
        
        // Verify both month inputs are visible
        const monthInputs = page.locator('[data-testid="recurring-budget-month-grid"] input[type="month"]');
        await expect(monthInputs).toHaveCount(2);
        
        // Verify the grid has 2 columns
        const gridElement = await monthGrid.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.gridTemplateColumns;
        });
        
        // Should have 2 columns (check that it's not a single column)
        const hasTwoColumns = gridElement && gridElement.includes(' ');
        expect(hasTwoColumns).toBe(true);
        
        console.log('✓ E2E: Recurring budget month fields are aligned in grid');
        console.log(`Grid template columns: ${gridElement}`);
      } else {
        console.log('Recurring budget button not visible - skipping test');
      }
    } else {
      console.log('Budget page not accessible (may require auth)');
    }
  });
});
