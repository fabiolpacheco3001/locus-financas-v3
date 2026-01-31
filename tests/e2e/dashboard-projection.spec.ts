import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Dashboard Projection Widget Integrity
 * 
 * Valida que o FutureEngineWidget atualiza corretamente quando uma nova
 * transação planejada de valor alto é adicionada.
 * 
 * Cenário:
 * 1. Login no sistema
 * 2. Navegar para o Dashboard
 * 3. Verificar visibilidade do FutureEngineWidget
 * 4. Capturar valor inicial da projeção
 * 5. Adicionar transação planejada de valor alto
 * 6. Validar que o widget atualizou (valor não pode ficar estático)
 * 
 * Nota sobre limpeza de dados:
 * - Este teste cria uma transação com descrição única (timestamp)
 * - Em produção, considere usar um tenant de teste ou implementar
 *   limpeza automática após o teste
 * - A transação criada pode ser identificada pela descrição: "E2E-Test-{timestamp}"
 */

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

async function login(page: Page) {
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');

  // Fill email - supports i18n placeholders (pt/en/es)
  const emailInput = page.locator('input[type="email"], input[placeholder*="email"], input[placeholder*="Email"]');
  await emailInput.first().fill(E2E_EMAIL!);

  // Fill password - supports i18n (pt/en/es)
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.first().fill(E2E_PASSWORD!);

  // Click sign in button - supports i18n (pt/en/es)
  const signInButton = page.getByRole('button', { name: /entrar|sign in|iniciar sesión|login/i });
  await signInButton.click();

  // Wait for navigation away from auth page
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
}

/**
 * Extrai o valor numérico de uma string formatada como moeda
 * Ex: "R$ 1.234,56" -> 1234.56
 */
function parseCurrencyValue(text: string | null): number {
  if (!text) return 0;
  
  // Remove símbolos de moeda, espaços e formatação brasileira
  const cleaned = text
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '') // Remove separador de milhar
    .replace(',', '.'); // Substitui vírgula por ponto
  
  return parseFloat(cleaned) || 0;
}

test.describe('Dashboard Projection Widget', () => {
  test.beforeEach(async ({ page }) => {
    // Verifica se as credenciais estão disponíveis
    if (!E2E_EMAIL || !E2E_PASSWORD) {
      test.skip(true, 'E2E_EMAIL and E2E_PASSWORD environment variables are required');
      return;
    }

    // Fail fast on runtime errors
    page.on('pageerror', (e) => {
      throw e;
    });

    await login(page);
    
    // Navegar para o Dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Aguardar carregamento completo do Dashboard
    await page.waitForTimeout(2000);
  });

  test('FutureEngineWidget deve atualizar quando transação planejada de valor alto é adicionada', async ({ page }) => {
    // 1. Verificar se o FutureEngineWidget está visível
    const widget = page.locator('[data-testid="future-engine-widget"]');
    await expect(widget).toBeVisible({ timeout: 10000 });

    // 2. Capturar valor inicial da projeção
    const initialBalanceElement = page.locator('[data-testid="future-engine-estimated-balance"]');
    await expect(initialBalanceElement).toBeVisible();
    
    const initialBalanceText = await initialBalanceElement.textContent();
    const initialBalance = parseCurrencyValue(initialBalanceText);
    
    console.log(`Saldo inicial da projeção: ${initialBalanceText} (${initialBalance})`);

    // 3. Abrir formulário de nova transação
    // Procurar botão de adicionar transação (pode estar no Dashboard ou na navegação)
    const addTransactionButton = page.getByRole('button', { 
      name: /nova transação|add transaction|adicionar|\+/i 
    }).first();
    
    // Se não encontrar no Dashboard, tentar navegar para Transactions
    if (!(await addTransactionButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }
    
    // Tentar novamente após navegação
    const addButton = page.getByRole('button', { 
      name: /nova transação|add transaction|adicionar|\+/i 
    }).first();
    
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    // 4. Aguardar diálogo aparecer
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 5. Preencher formulário de transação planejada de valor alto
    // Selecionar tipo EXPENSE (Despesa)
    const expenseOption = dialog.getByRole('radio', { name: /despesa|expense/i });
    if (await expenseOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expenseOption.click();
    }

    // Selecionar conta (primeira disponível)
    const accountSelect = dialog.locator('[data-testid="account-select"], select').first();
    if (await accountSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await accountSelect.click();
      await page.waitForTimeout(500);
      
      // Selecionar primeira opção disponível
      const accountOption = page.locator('[role="option"]').first();
      if (await accountOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await accountOption.click();
      }
    }

    // Preencher valor alto (ex: R$ 5.000,00)
    const highAmount = '5000.00';
    const amountInput = dialog.locator('input[inputmode="decimal"], input[name="amount"]').first();
    await expect(amountInput).toBeVisible({ timeout: 3000 });
    await amountInput.fill(highAmount);

    // Preencher descrição única para identificação
    const uniqueDescription = `E2E-Test-${Date.now()}`;
    const descInput = dialog.locator('input[name="description"], input[placeholder*="descrição"], input[placeholder*="description"]').first();
    if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await descInput.fill(uniqueDescription);
    }

    // Selecionar categoria (primeira disponível de despesa)
    // Pode ser um botão ou selector
    const categorySelectors = [
      dialog.locator('button:has-text("Categoria"), button:has-text("Category")'),
      dialog.locator('[data-testid="category-select"]'),
      dialog.locator('button').filter({ hasText: /categoria|category/i }),
    ];
    
    let categorySelected = false;
    for (const selector of categorySelectors) {
      if (await selector.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await selector.first().click();
        await page.waitForTimeout(500);
        
        const categoryOption = page.locator('[role="option"]').first();
        if (await categoryOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await categoryOption.click();
          categorySelected = true;
          break;
        }
      }
    }

    // Garantir que está como PLANEJADA (pending)
    // O toggle pode ser um Switch ou botão
    const statusSelectors = [
      dialog.locator('[role="switch"]'),
      dialog.locator('button:has-text("Pendente"), button:has-text("Pending")'),
      dialog.locator('button:has-text("Planejada"), button:has-text("Planned")'),
    ];
    
    for (const selector of statusSelectors) {
      const statusToggle = selector.first();
      if (await statusToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Verificar se já está como planejada
        const isPlanned = await statusToggle.getAttribute('aria-checked');
        const toggleText = await statusToggle.textContent().catch(() => '');
        
        // Se não estiver marcado como planejada, clicar
        if (isPlanned === 'false' || (!toggleText?.toLowerCase().includes('pendente') && !toggleText?.toLowerCase().includes('pending'))) {
          await statusToggle.click();
          await page.waitForTimeout(300);
        }
        break;
      }
    }

    // 6. Submeter transação
    const submitButton = dialog.getByRole('button', { 
      name: /criar|create/i 
    }).filter({ hasNotText: /similar/i });
    
    await expect(submitButton).toBeEnabled({ timeout: 3000 });
    await submitButton.click();

    // 7. Aguardar diálogo fechar (indica sucesso)
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    
    // Aguardar toast de sucesso (opcional, mas ajuda a confirmar)
    const toast = page.locator('[data-sonner-toast]');
    try {
      await expect(toast).toBeVisible({ timeout: 3000 });
    } catch {
      // Toast pode não aparecer, não é crítico
    }

    // 8. Navegar de volta para o Dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Aguardar widget atualizar (pode levar alguns segundos para refetch dos dados)
    // Aguardar até que o widget não esteja mais em estado de loading
    await page.waitForTimeout(2000);
    
    // Tentar aguardar até que o valor mude (com timeout)
    let attempts = 0;
    const maxAttempts = 10;
    let valueChanged = false;
    
    while (attempts < maxAttempts && !valueChanged) {
      await page.waitForTimeout(500);
      const currentBalanceText = await page.locator('[data-testid="future-engine-estimated-balance"]').textContent();
      const currentBalance = parseCurrencyValue(currentBalanceText);
      
      if (currentBalance !== initialBalance) {
        valueChanged = true;
      }
      attempts++;
    }
    
    if (!valueChanged) {
      console.warn('Widget pode não ter atualizado após múltiplas tentativas');
    }

    // 9. Verificar que o widget ainda está visível
    await expect(widget).toBeVisible({ timeout: 10000 });

    // 10. Capturar novo valor da projeção
    const newBalanceElement = page.locator('[data-testid="future-engine-estimated-balance"]');
    await expect(newBalanceElement).toBeVisible();
    
    const newBalanceText = await newBalanceElement.textContent();
    const newBalance = parseCurrencyValue(newBalanceText);
    
    console.log(`Saldo após adicionar transação: ${newBalanceText} (${newBalance})`);

    // 11. Validar que o valor mudou (não pode ficar estático)
    // O novo saldo deve ser menor que o inicial (pois adicionamos uma despesa planejada)
    expect(newBalance).not.toBe(initialBalance);
    expect(newBalance).toBeLessThan(initialBalance);
    
    // Diferença deve ser próxima ao valor adicionado (com tolerância para formatação)
    const difference = initialBalance - newBalance;
    const expectedDifference = parseFloat(highAmount);
    
    // Tolerância de 1% para diferenças de arredondamento/formatação
    const tolerance = expectedDifference * 0.01;
    expect(Math.abs(difference - expectedDifference)).toBeLessThan(tolerance + 100); // +100 para margem de segurança
  });

  test('FutureEngineWidget deve estar visível no Dashboard após login', async ({ page }) => {
    // Verificar se o widget está presente e visível
    const widget = page.locator('[data-testid="future-engine-widget"]');
    await expect(widget).toBeVisible({ timeout: 10000 });

    // Verificar elementos principais do widget
    const title = widget.locator('text=/projeção|projection|forecast/i');
    await expect(title.first()).toBeVisible({ timeout: 5000 });

    const estimatedBalance = page.locator('[data-testid="future-engine-estimated-balance"]');
    await expect(estimatedBalance).toBeVisible();

    // Verificar que há um valor exibido (não vazio)
    const balanceText = await estimatedBalance.textContent();
    expect(balanceText).toBeTruthy();
    expect(balanceText?.trim().length).toBeGreaterThan(0);
  });

  test('FutureEngineWidget deve exibir indicador de risco', async ({ page }) => {
    const widget = page.locator('[data-testid="future-engine-widget"]');
    await expect(widget).toBeVisible({ timeout: 10000 });

    // Verificar indicador de risco
    const riskIndicator = page.locator('[data-testid="future-engine-risk-indicator"]');
    await expect(riskIndicator).toBeVisible({ timeout: 5000 });

    // Verificar que há texto de risco (safe, caution ou danger)
    const riskText = await riskIndicator.textContent();
    expect(riskText).toBeTruthy();
  });
});
