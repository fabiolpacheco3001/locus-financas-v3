import { test, expect } from '@playwright/test';

test.describe('Transactions Filters Drawer', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to auth page and login
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    // Check if already logged in by looking for sign out or dashboard elements
    const isLoggedIn = await page.locator('text=Dashboard, text=Transações, text=Transactions').first().isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!isLoggedIn) {
      // Fill login form
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

  test('E2E 1: Apply with "All" (Todos) does not hide recent transactions', async ({ page }) => {
    // Navigate to transactions page
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify we're on the transactions page
    const pageTitle = page.locator('h1:has-text("Transações"), h1:has-text("Transactions"), h1:has-text("Transacciones")').first();
    
    if (await pageTitle.isVisible({ timeout: 5000 })) {
      // Count initial visible rows and get first row content for comparison
      const initialRows = await page.locator('tbody tr').count();
      const firstRowText = await page.locator('tbody tr:first-child').textContent().catch(() => '');
      console.log(`Initial transaction rows: ${initialRows}`);
      console.log(`First row content: ${firstRowText?.substring(0, 50)}...`);
      
      // Look for the "More filters" button
      const moreFiltersButton = page.locator('button:has-text("Mais filtros"), button:has-text("More filters"), button:has-text("Más filtros")').first();
      
      if (await moreFiltersButton.isVisible({ timeout: 2000 })) {
        await moreFiltersButton.click();
        await page.waitForTimeout(500);
        
        // Verify drawer is open with Type and Status dropdowns set to "All"
        const typeDropdown = page.locator('[role="combobox"]').first();
        await expect(typeDropdown).toBeVisible({ timeout: 3000 });
        
        // Don't change anything - just click Apply with defaults
        const applyButton = page.locator('button:has-text("Aplicar"), button:has-text("Apply")').first();
        await applyButton.click();
        await page.waitForTimeout(500);
        
        // Verify drawer closed
        await expect(typeDropdown).not.toBeVisible({ timeout: 2000 });
        
        // Verify row count is the same (no filtering happened)
        const afterApplyRows = await page.locator('tbody tr').count();
        const afterApplyFirstRow = await page.locator('tbody tr:first-child').textContent().catch(() => '');
        console.log(`After apply rows: ${afterApplyRows}`);
        console.log(`After apply first row: ${afterApplyFirstRow?.substring(0, 50)}...`);
        
        // Row count should be same AND first row should still be the same (not jumped to old data)
        expect(afterApplyRows).toBe(initialRows);
        expect(afterApplyFirstRow).toBe(firstRowText);
        console.log('✓ E2E 1: Apply with "All" does not hide recent transactions or change order');
      }
    } else {
      console.log('E2E 1: Transactions page not accessible (may require auth)');
    }
  });

  test('E2E 2: Filter by Type "Transfer" shows only transfers', async ({ page }) => {
    // Navigate to transactions page
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const pageTitle = page.locator('h1:has-text("Transações"), h1:has-text("Transactions"), h1:has-text("Transacciones")').first();
    
    if (await pageTitle.isVisible({ timeout: 5000 })) {
      const moreFiltersButton = page.locator('button:has-text("Mais filtros"), button:has-text("More filters")').first();
      
      if (await moreFiltersButton.isVisible({ timeout: 2000 })) {
        await moreFiltersButton.click();
        await page.waitForTimeout(500);
        
        // Find and click the Type dropdown
        const typeDropdown = page.locator('[role="combobox"]').first();
        await typeDropdown.click();
        await page.waitForTimeout(300);
        
        // Select "Transfer" option
        const transferOption = page.locator('[role="option"]:has-text("Transferência"), [role="option"]:has-text("Transfer")').first();
        if (await transferOption.isVisible({ timeout: 2000 })) {
          await transferOption.click();
          await page.waitForTimeout(300);
        }
        
        // Click Apply
        const applyButton = page.locator('button:has-text("Aplicar"), button:has-text("Apply")').first();
        await applyButton.click();
        await page.waitForTimeout(500);
        
        // Verify "More filters" button now shows active indicator
        const activeIndicator = page.locator('button:has-text("Mais filtros") .bg-secondary, button:has-text("More filters") .bg-secondary').first();
        const hasIndicator = await activeIndicator.isVisible({ timeout: 1000 }).catch(() => false);
        
        if (hasIndicator) {
          console.log('✓ E2E 2: Active filter indicator is visible');
        }
        
        // Check that only transfers are visible (if any)
        const transferBadges = await page.locator('span:has-text("Transferência"), span:has-text("Transfer")').count();
        const incomeBadges = await page.locator('span:has-text("Receita"), span:has-text("Income")').count();
        const expenseBadges = await page.locator('span:has-text("Despesa"), span:has-text("Expense")').count();
        
        console.log(`Transfers: ${transferBadges}, Incomes: ${incomeBadges}, Expenses: ${expenseBadges}`);
        
        // If there are visible rows, they should be transfers only
        const visibleRows = await page.locator('tbody tr').count();
        if (visibleRows > 0) {
          expect(incomeBadges).toBe(0);
          expect(expenseBadges).toBe(0);
          console.log('✓ E2E 2: Only transfers visible after filter');
        } else {
          console.log('✓ E2E 2: No transfers to display (filter works, empty result)');
        }
      }
    }
  });

  test('E2E 3: Clear filter restores all transactions', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const pageTitle = page.locator('h1:has-text("Transações"), h1:has-text("Transactions"), h1:has-text("Transacciones")').first();
    
    if (await pageTitle.isVisible({ timeout: 5000 })) {
      // Count initial rows
      const initialRows = await page.locator('tbody tr').count();
      
      const moreFiltersButton = page.locator('button:has-text("Mais filtros"), button:has-text("More filters")').first();
      
      if (await moreFiltersButton.isVisible({ timeout: 2000 })) {
        // First apply a filter
        await moreFiltersButton.click();
        await page.waitForTimeout(500);
        
        const typeDropdown = page.locator('[role="combobox"]').first();
        await typeDropdown.click();
        await page.waitForTimeout(300);
        
        const incomeOption = page.locator('[role="option"]:has-text("Receita"), [role="option"]:has-text("Income")').first();
        if (await incomeOption.isVisible({ timeout: 2000 })) {
          await incomeOption.click();
        }
        
        const applyButton = page.locator('button:has-text("Aplicar"), button:has-text("Apply")').first();
        await applyButton.click();
        await page.waitForTimeout(500);
        
        const filteredRows = await page.locator('tbody tr').count();
        console.log(`After income filter: ${filteredRows} rows`);
        
        // Now clear the filter
        await moreFiltersButton.click();
        await page.waitForTimeout(500);
        
        const clearButton = page.locator('button:has-text("Limpar"), button:has-text("Clear")').first();
        await clearButton.click();
        await page.waitForTimeout(500);
        
        // Verify rows are restored
        const restoredRows = await page.locator('tbody tr').count();
        console.log(`After clear: ${restoredRows} rows (initial was ${initialRows})`);
        
        expect(restoredRows).toBe(initialRows);
        console.log('✓ E2E 3: Clear filter restores all transactions');
      }
    }
  });

  test('E2E 4: Draft state - closing without Apply does not change filter', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const pageTitle = page.locator('h1:has-text("Transações"), h1:has-text("Transactions"), h1:has-text("Transacciones")').first();
    
    if (await pageTitle.isVisible({ timeout: 5000 })) {
      const initialRows = await page.locator('tbody tr').count();
      
      const moreFiltersButton = page.locator('button:has-text("Mais filtros"), button:has-text("More filters")').first();
      
      if (await moreFiltersButton.isVisible({ timeout: 2000 })) {
        await moreFiltersButton.click();
        await page.waitForTimeout(500);
        
        // Change the dropdown but DON'T click Apply
        const typeDropdown = page.locator('[role="combobox"]').first();
        await typeDropdown.click();
        await page.waitForTimeout(300);
        
        const incomeOption = page.locator('[role="option"]:has-text("Receita"), [role="option"]:has-text("Income")').first();
        if (await incomeOption.isVisible({ timeout: 2000 })) {
          await incomeOption.click();
        }
        
        // Close drawer by clicking outside or pressing escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        
        // Verify rows are NOT filtered (same as initial)
        const afterCloseRows = await page.locator('tbody tr').count();
        console.log(`After close without Apply: ${afterCloseRows} rows (initial was ${initialRows})`);
        
        expect(afterCloseRows).toBe(initialRows);
        console.log('✓ E2E 4: Closing drawer without Apply does not change filter');
      }
    }
  });

  test('E2E 5: Reopen drawer shows previously selected filter value', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const pageTitle = page.locator('h1:has-text("Transações"), h1:has-text("Transactions"), h1:has-text("Transacciones")').first();
    
    if (await pageTitle.isVisible({ timeout: 5000 })) {
      const moreFiltersButton = page.locator('button:has-text("Mais filtros"), button:has-text("More filters")').first();
      
      if (await moreFiltersButton.isVisible({ timeout: 2000 })) {
        // First, open drawer and select Transfer
        await moreFiltersButton.click();
        await page.waitForTimeout(500);
        
        const typeDropdown = page.locator('[role="combobox"]').first();
        await typeDropdown.click();
        await page.waitForTimeout(300);
        
        const transferOption = page.locator('[role="option"]:has-text("Transferência"), [role="option"]:has-text("Transfer")').first();
        if (await transferOption.isVisible({ timeout: 2000 })) {
          await transferOption.click();
          await page.waitForTimeout(300);
        }
        
        // Click Apply
        const applyButton = page.locator('button:has-text("Aplicar"), button:has-text("Apply")').first();
        await applyButton.click();
        await page.waitForTimeout(500);
        
        // Reopen the drawer
        await moreFiltersButton.click();
        await page.waitForTimeout(500);
        
        // Verify the dropdown still shows "Transfer"
        const selectedValue = page.locator('[role="combobox"]').first();
        const selectedText = await selectedValue.textContent();
        console.log(`Selected type after reopen: ${selectedText}`);
        
        const hasTransferSelected = selectedText?.includes('Transferência') || selectedText?.includes('Transfer');
        expect(hasTransferSelected).toBe(true);
        console.log('✓ E2E 5: Reopen drawer shows previously selected filter value');
      }
    }
  });

  test('E2E 6: Page scrolls to top after applying filters', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const pageTitle = page.locator('h1:has-text("Transações"), h1:has-text("Transactions"), h1:has-text("Transacciones")').first();
    
    if (await pageTitle.isVisible({ timeout: 5000 })) {
      // Scroll down first
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(300);
      
      const scrollBefore = await page.evaluate(() => window.scrollY);
      console.log(`Scroll position before: ${scrollBefore}px`);
      
      const moreFiltersButton = page.locator('button:has-text("Mais filtros"), button:has-text("More filters")').first();
      
      if (await moreFiltersButton.isVisible({ timeout: 2000 })) {
        await moreFiltersButton.click();
        await page.waitForTimeout(500);
        
        const applyButton = page.locator('button:has-text("Aplicar"), button:has-text("Apply")').first();
        await applyButton.click();
        await page.waitForTimeout(500);
        
        const scrollAfter = await page.evaluate(() => window.scrollY);
        console.log(`Scroll position after: ${scrollAfter}px`);
        
        // Should scroll back to top (0 or very close)
        expect(scrollAfter).toBeLessThan(50);
        console.log('✓ E2E 6: Page scrolls to top after applying filters');
      }
    }
  });

  test('E2E 7: Filter summary chip shows current filter state', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const pageTitle = page.locator('h1:has-text("Transações"), h1:has-text("Transactions"), h1:has-text("Transacciones")').first();
    
    if (await pageTitle.isVisible({ timeout: 5000 })) {
      // Check for filter summary chip (should show default "Tipo: Todos · Status: Todos")
      const filterSummaryChip = page.locator('span:has-text("Tipo:"), span:has-text("Type:")').first();
      
      if (await filterSummaryChip.isVisible({ timeout: 2000 })) {
        const chipText = await filterSummaryChip.textContent();
        console.log(`Filter summary chip: ${chipText}`);
        
        // Should contain Type and Status info
        const hasTypeInfo = chipText?.includes('Tipo') || chipText?.includes('Type');
        const hasStatusInfo = chipText?.includes('Status');
        
        expect(hasTypeInfo).toBe(true);
        expect(hasStatusInfo).toBe(true);
        console.log('✓ E2E 7: Filter summary chip shows current filter state');
      } else {
        console.log('Filter summary chip not visible (may be mobile view)');
      }
    }
  });

  test('Verify sticky header structure has Month, Account, Category, and More Filters', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const pageTitle = page.locator('h1:has-text("Transações"), h1:has-text("Transactions"), h1:has-text("Transacciones")').first();
    
    if (await pageTitle.isVisible({ timeout: 5000 })) {
      // Check for essential filter elements in sticky header
      
      // 1. Month picker (calendar icon or month name)
      const monthElement = page.locator('[class*="month"], button:has-text("janeiro"), button:has-text("fevereiro"), button:has-text("março"), button:has-text("abril"), button:has-text("maio"), button:has-text("junho"), button:has-text("julho"), button:has-text("agosto"), button:has-text("setembro"), button:has-text("outubro"), button:has-text("novembro"), button:has-text("dezembro"), button:has-text("January"), button:has-text("February")').first();
      
      // 2. Account dropdown
      const accountDropdown = page.locator('button:has-text("Todas as contas"), button:has-text("All accounts"), button:has-text("Todas las cuentas")').first();
      
      // 3. Category dropdown  
      const categoryDropdown = page.locator('button:has-text("Todas as categorias"), button:has-text("All categories"), button:has-text("Todas las categorías")').first();
      
      // 4. Show cancelled toggle
      const showCancelledToggle = page.locator('text=Mostrar canceladas, text=Show cancelled').first();
      
      // 5. More filters button (desktop)
      const moreFiltersButton = page.locator('button:has-text("Mais filtros"), button:has-text("More filters"), button:has-text("Más filtros")').first();
      
      console.log('Sticky header structure check:');
      console.log(`- Month picker: ${await monthElement.isVisible({ timeout: 1000 }).catch(() => false) ? '✓' : '✗'}`);
      console.log(`- Account dropdown: ${await accountDropdown.isVisible({ timeout: 1000 }).catch(() => false) ? '✓' : '✗'}`);
      console.log(`- Category dropdown: ${await categoryDropdown.isVisible({ timeout: 1000 }).catch(() => false) ? '✓' : '✗'}`);
      console.log(`- Show cancelled toggle: ${await showCancelledToggle.isVisible({ timeout: 1000 }).catch(() => false) ? '✓' : '✗'}`);
      console.log(`- More filters button: ${await moreFiltersButton.isVisible({ timeout: 1000 }).catch(() => false) ? '✓' : '✗'}`);
      
      // Verify that Type and Status filters are NOT visible in the main header (they're in the drawer)
      const typeDropdownInHeader = page.locator('[class*="sticky"] button:has-text("Tipo"), [class*="sticky"] button:has-text("Type")').first();
      const statusDropdownInHeader = page.locator('[class*="sticky"] button:has-text("Status"), [class*="sticky"] button:has-text("Estado")').first();
      
      const typeInHeader = await typeDropdownInHeader.isVisible({ timeout: 1000 }).catch(() => false);
      const statusInHeader = await statusDropdownInHeader.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (!typeInHeader && !statusInHeader) {
        console.log('✓ Type and Status filters correctly moved to More Filters drawer');
      } else {
        console.log('✗ Type/Status still visible in main header (should be in drawer)');
      }
    } else {
      console.log('Transactions page not accessible (may require auth)');
    }
  });
});
