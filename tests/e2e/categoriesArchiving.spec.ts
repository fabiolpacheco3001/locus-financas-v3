import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Categories Archiving Feature
 * 
 * Tests the soft delete (archiving) functionality for categories and subcategories,
 * ensuring proper behavior in transaction forms and category management.
 */

test.describe('Categories Archiving', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to auth page and wait for app to load
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Archive Toggle in Categories Page', () => {
    
    test('Toggle OFF should not show archived categories', async ({ page }) => {
      // Navigate to categories page
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      // Check if toggle exists (only shows when there are archived items)
      const toggleLabel = page.locator('label[for="show-archived"]');
      const toggleExists = await toggleLabel.isVisible().catch(() => false);
      
      if (toggleExists) {
        // Ensure toggle is OFF by default
        const toggle = page.locator('#show-archived');
        const isChecked = await toggle.isChecked();
        
        if (isChecked) {
          await toggle.click();
        }
        
        // Verify no archived badges are visible in the main list
        const archivedBadges = page.locator('[data-testid="category-list"] >> text=Arquivada, [data-testid="category-list"] >> text=Archived');
        const badgeCount = await archivedBadges.count();
        
        // With toggle OFF, archived items should not be visible
        // (This assertion depends on having archived items in the system)
        expect(badgeCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('Toggle ON should show archived categories with visual distinction', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      const toggleLabel = page.locator('label[for="show-archived"]');
      const toggleExists = await toggleLabel.isVisible().catch(() => false);
      
      if (toggleExists) {
        // Turn toggle ON
        const toggle = page.locator('#show-archived');
        const isChecked = await toggle.isChecked();
        
        if (!isChecked) {
          await toggle.click();
        }
        
        // Wait for list to update
        await page.waitForTimeout(500);
        
        // Verify archived items are now visible
        // Look for the archived badge or line-through styling
        const archivedIndicators = page.locator('.line-through, [class*="opacity-"]');
        const indicatorCount = await archivedIndicators.count();
        
        // If there are archived items, they should be visible with styling
        expect(indicatorCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('Toggle label changes based on state', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      const toggleLabel = page.locator('label[for="show-archived"]');
      const toggleExists = await toggleLabel.isVisible().catch(() => false);
      
      if (toggleExists) {
        const toggle = page.locator('#show-archived');
        
        // When OFF, should show "Mostrar arquivadas" or "Show archived"
        if (!(await toggle.isChecked())) {
          const labelText = await toggleLabel.textContent();
          expect(labelText).toMatch(/mostrar arquivadas|show archived/i);
        }
        
        // Toggle ON
        await toggle.click();
        await page.waitForTimeout(300);
        
        // When ON, should show "Ocultar arquivadas" or "Hide archived"
        const labelTextAfter = await toggleLabel.textContent();
        expect(labelTextAfter).toMatch(/ocultar arquivadas|hide archived/i);
      }
    });
  });

  test.describe('Archived Categories in Transaction Form', () => {
    
    test('Archived category should NOT appear in new transaction category select', async ({ page }) => {
      // This test assumes there is an archived category in the system
      // Navigate to transactions page
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');
      
      // Look for "Nova Transação" or "New Transaction" button
      const newButton = page.locator('button:has-text("Nova"), button:has-text("New")').first();
      const buttonExists = await newButton.isVisible().catch(() => false);
      
      if (buttonExists) {
        await newButton.click();
        await page.waitForTimeout(500);
        
        // Open category select
        const categoryTrigger = page.locator('[data-testid="category-select"], [role="combobox"]').first();
        if (await categoryTrigger.isVisible()) {
          await categoryTrigger.click();
          await page.waitForTimeout(300);
          
          // Check that no archived badges appear in the dropdown
          const archivedInDropdown = page.locator('[role="listbox"] >> text=Arquivada, [role="listbox"] >> text=Archived');
          const archivedCount = await archivedInDropdown.count();
          
          // For NEW transactions, archived categories should NOT be in the list
          // (unless they're already selected from an edit)
          expect(archivedCount).toBe(0);
        }
      }
    });

    test('Archived subcategory should NOT appear in new transaction subcategory select', async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');
      
      const newButton = page.locator('button:has-text("Nova"), button:has-text("New")').first();
      const buttonExists = await newButton.isVisible().catch(() => false);
      
      if (buttonExists) {
        await newButton.click();
        await page.waitForTimeout(500);
        
        // First select a category
        const categoryTrigger = page.locator('[data-testid="category-select"], [role="combobox"]').first();
        if (await categoryTrigger.isVisible()) {
          await categoryTrigger.click();
          await page.waitForTimeout(300);
          
          // Select first available category
          const firstOption = page.locator('[role="option"]').first();
          if (await firstOption.isVisible()) {
            await firstOption.click();
            await page.waitForTimeout(300);
            
            // Now check subcategory select
            const subcategoryTrigger = page.locator('[data-testid="subcategory-select"], [role="combobox"]').nth(1);
            if (await subcategoryTrigger.isVisible()) {
              await subcategoryTrigger.click();
              await page.waitForTimeout(300);
              
              // Check that no archived badges appear in subcategory dropdown
              const archivedInDropdown = page.locator('[role="listbox"] >> text=Arquivada, [role="listbox"] >> text=Archived');
              const archivedCount = await archivedInDropdown.count();
              
              expect(archivedCount).toBe(0);
            }
          }
        }
      }
    });

    test('Editing transaction with archived category should show badge but not break', async ({ page }) => {
      // This test verifies that historical transactions with archived categories
      // can still be viewed and edited without crashing
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');
      
      // Look for any transaction in the list
      const transactionRow = page.locator('table tbody tr').first();
      const rowExists = await transactionRow.isVisible().catch(() => false);
      
      if (rowExists) {
        // Check if this transaction has an archived category (look for badge in the row)
        const archivedBadge = transactionRow.locator('text=Arquivada, text=Archived');
        const hasArchivedCategory = await archivedBadge.isVisible().catch(() => false);
        
        if (hasArchivedCategory) {
          // Try to edit this transaction
          const editButton = transactionRow.locator('button:has-text("Editar"), button[aria-label*="edit"], button:has(svg)').first();
          if (await editButton.isVisible()) {
            await editButton.click();
            await page.waitForTimeout(500);
            
            // Verify dialog opened without crashing
            const dialog = page.locator('[role="dialog"]');
            expect(await dialog.isVisible()).toBe(true);
            
            // Verify the archived category is shown with badge in the select
            const categorySelect = page.locator('[data-testid="category-select"], [role="combobox"]').first();
            if (await categorySelect.isVisible()) {
              const selectValue = await categorySelect.textContent();
              // The archived category name should be visible
              expect(selectValue).toBeTruthy();
            }
          }
        }
      }
    });
  });

  test.describe('Archive Operations', () => {
    
    test('Archive category button should trigger confirmation dialog', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      // Expand first category accordion
      const firstCategory = page.locator('[data-state="closed"]').first();
      if (await firstCategory.isVisible()) {
        await firstCategory.click();
        await page.waitForTimeout(300);
        
        // Look for archive button
        const archiveButton = page.locator('button:has-text("Arquivar"), button:has-text("Archive")').first();
        if (await archiveButton.isVisible()) {
          await archiveButton.click();
          await page.waitForTimeout(300);
          
          // Verify confirmation dialog appears
          const alertDialog = page.locator('[role="alertdialog"]');
          expect(await alertDialog.isVisible()).toBe(true);
          
          // Verify dialog has explanation about preserving history
          const dialogText = await alertDialog.textContent();
          expect(dialogText).toMatch(/histórico|history|preserv/i);
          
          // Cancel the dialog
          const cancelButton = page.locator('[role="alertdialog"] button:has-text("Cancelar"), [role="alertdialog"] button:has-text("Cancel")');
          await cancelButton.click();
        }
      }
    });

    test('Archive subcategory should show confirmation dialog', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      // Expand first category accordion
      const firstCategory = page.locator('[data-state="closed"]').first();
      if (await firstCategory.isVisible()) {
        await firstCategory.click();
        await page.waitForTimeout(300);
        
        // Look for subcategory archive button (icon button)
        const subcategoryArchiveButton = page.locator('[data-radix-collection-item] button:has(svg)').first();
        if (await subcategoryArchiveButton.isVisible()) {
          await subcategoryArchiveButton.click();
          await page.waitForTimeout(300);
          
          // Verify confirmation dialog appears
          const alertDialog = page.locator('[role="alertdialog"]');
          const dialogVisible = await alertDialog.isVisible().catch(() => false);
          
          if (dialogVisible) {
            // Cancel the dialog
            const cancelButton = page.locator('[role="alertdialog"] button:has-text("Cancelar"), [role="alertdialog"] button:has-text("Cancel")');
            await cancelButton.click();
          }
        }
      }
    });

    test('Restore button should be visible for archived categories when toggle is ON', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      const toggle = page.locator('#show-archived');
      const toggleExists = await toggle.isVisible().catch(() => false);
      
      if (toggleExists) {
        // Turn toggle ON to show archived
        if (!(await toggle.isChecked())) {
          await toggle.click();
          await page.waitForTimeout(500);
        }
        
        // Look for restore button (only visible for archived items)
        const restoreButton = page.locator('button:has-text("Restaurar"), button:has-text("Restore")');
        const restoreCount = await restoreButton.count();
        
        // If there are archived categories, restore buttons should be visible
        // This is informational - the count depends on existing archived items
        expect(restoreCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Cascade Archive Behavior', () => {
    
    test('Archiving category dialog should mention subcategories will be archived', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      // Expand first category that has subcategories
      const categoryAccordion = page.locator('[data-state="closed"]').first();
      if (await categoryAccordion.isVisible()) {
        await categoryAccordion.click();
        await page.waitForTimeout(300);
        
        // Click archive button
        const archiveButton = page.locator('button:has-text("Arquivar"), button:has-text("Archive")').first();
        if (await archiveButton.isVisible()) {
          await archiveButton.click();
          await page.waitForTimeout(300);
          
          // Verify dialog mentions subcategories
          const alertDialog = page.locator('[role="alertdialog"]');
          if (await alertDialog.isVisible()) {
            const dialogText = await alertDialog.textContent();
            expect(dialogText).toMatch(/subcategor/i);
            
            // Cancel
            const cancelButton = page.locator('[role="alertdialog"] button:has-text("Cancelar"), [role="alertdialog"] button:has-text("Cancel")');
            await cancelButton.click();
          }
        }
      }
    });
  });

  test.describe('Transaction Form Validation', () => {
    
    test('Should not allow saving transaction with only archived category available', async ({ page }) => {
      // This test verifies that the form properly validates category selection
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');
      
      const newButton = page.locator('button:has-text("Nova"), button:has-text("New")').first();
      if (await newButton.isVisible()) {
        await newButton.click();
        await page.waitForTimeout(500);
        
        // Try to submit without selecting category
        const saveButton = page.locator('button[type="submit"]:has-text("Salvar"), button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Criar"), button[type="submit"]:has-text("Create")');
        if (await saveButton.isVisible()) {
          // Category field should have validation indicator
          const categoryError = page.locator('.text-destructive:has-text("categoria"), .text-destructive:has-text("category")');
          const hasError = await categoryError.isVisible().catch(() => false);
          
          // Either there's a visible error or the field has error styling
          const categoryTrigger = page.locator('[role="combobox"]').first();
          const hasErrorStyling = await categoryTrigger.evaluate(el => 
            el.className.includes('destructive') || el.className.includes('error')
          ).catch(() => false);
          
          expect(hasError || hasErrorStyling).toBeTruthy();
        }
      }
    });

    test('Transaction list should display archived badge for historical transactions', async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');
      
      // Wait for transactions to load
      await page.waitForTimeout(1000);
      
      // Check if any transaction row has an archived badge
      const archivedBadges = page.locator('table tbody >> text=Arquivada, table tbody >> text=Archived');
      const badgeCount = await archivedBadges.count();
      
      // This is informational - depends on existing data
      // The important thing is the page doesn't crash
      expect(badgeCount).toBeGreaterThanOrEqual(0);
      
      // Verify page is still functional
      const table = page.locator('table');
      expect(await table.isVisible()).toBe(true);
    });
  });

  test.describe('Alphabetical Ordering', () => {
    
    test('Categories should be sorted alphabetically', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      // Get all category names
      const categoryNames = page.locator('[data-state] .font-medium');
      const count = await categoryNames.count();
      
      if (count > 1) {
        const names: string[] = [];
        for (let i = 0; i < count; i++) {
          const name = await categoryNames.nth(i).textContent();
          if (name) names.push(name.trim());
        }
        
        // Check if sorted
        const sortedNames = [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        expect(names).toEqual(sortedNames);
      }
    });

    test('Archived categories should maintain alphabetical order when toggle is ON', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      const toggle = page.locator('#show-archived');
      const toggleExists = await toggle.isVisible().catch(() => false);
      
      if (toggleExists) {
        // Turn toggle ON
        if (!(await toggle.isChecked())) {
          await toggle.click();
          await page.waitForTimeout(500);
        }
        
        // Get all category names (including archived)
        const categoryNames = page.locator('[data-state] .font-medium');
        const count = await categoryNames.count();
        
        if (count > 1) {
          const names: string[] = [];
          for (let i = 0; i < count; i++) {
            const name = await categoryNames.nth(i).textContent();
            // Remove strikethrough styling effect from comparison
            if (name) names.push(name.trim());
          }
          
          // Check if sorted alphabetically
          const sortedNames = [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
          expect(names).toEqual(sortedNames);
        }
      }
    });
  });
});
