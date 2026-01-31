# AUDITORIA TÉCNICA DE REGRAS DE NEGÓCIO: DASHBOARD

**Data:** 31 de Janeiro de 2026  
**Escopo:** Análise completa das fórmulas e lógicas de cálculo das métricas do Dashboard Financeiro

---

## RESUMO EXECUTIVO

O Dashboard utiliza uma arquitetura **híbrida** de cálculo:
- **Client-side (Javascript)**: Cálculos de métricas mensais, projeções e agregações
- **Backend (RPCs Supabase)**: Cálculo de saldos de contas e radar de vencimentos
- **Fonte única de verdade**: `src/domain/finance/computeUnifiedMetrics.ts` para métricas unificadas

**Principais descobertas:**
1. ✅ **Patrimônio Acumulado**: Usa `accounts.current_balance` (calculado pelo banco via RPC)
2. ✅ **Vencidas/Vence Hoje/Próximos 7 dias**: Calculado via RPC `get_financial_radar`
3. ⚠️ **Projeção Inteligente**: Calculada client-side usando média histórica de 3 meses
4. ✅ **Saldo Disponível**: Exclui contas reserva (`is_reserve=true`) corretamente
5. ✅ **Previsão de Fechamento**: Soma saldo disponível + receitas pendentes - despesas pendentes

---

## A. PATRIMÔNIO ACUMULADO (Net Worth/Total Balance)

### Arquivo/Função
- **Componente**: `src/pages/Index.tsx` (linha 242)
- **Hook**: `src/hooks/useAccountProjections.ts` (linha 50)
- **Cálculo**: `src/domain/finance/computeUnifiedMetrics.ts` (linha 292-298)

### Lógica Atual
```typescript
// Em useAccountProjections.ts
const realizedBalance = account.is_active 
  ? (account.current_balance ?? account.initial_balance ?? 0)
  : 0;

// Em computeUnifiedAccountMetrics.ts (linha 292-298)
const realizedBalance = account.is_active 
  ? (account.current_balance ?? account.initial_balance ?? 0)
  : 0;
```

**Fórmula:**
```
Patrimônio Acumulado = Σ(accounts.current_balance) para todas as contas ativas
```

**Fonte de dados:**
- `accounts.current_balance` é calculado pelo banco via função RPC `get_account_balance()`
- A RPC soma todas as transações confirmadas (`status='confirmed'`) até a data atual
- Transações canceladas (`cancelled_at IS NOT NULL`) são excluídas

### Exibição no Dashboard
- **Componente**: `HeroBalance` (linha 242 do Index.tsx)
- **Valor exibido**: `totals.realizedBalance` (soma de todas as contas)

### Possível Falha
✅ **Nenhuma falha identificada**
- O saldo vem diretamente do banco (RPC `get_accounts_with_balances()`)
- Considera apenas transações confirmadas
- Exclui transações canceladas corretamente

---

## B. VENCIDAS (Overdue Expenses)

### Arquivo/Função
- **Componente**: `src/components/dashboard/MaturityRadar.tsx` (linha 180-188)
- **Hook**: `src/hooks/useFinancialRadar.ts` (linha 25-82)
- **RPC Backend**: `supabase/migrations/20260123022606_*.sql` - função `get_financial_radar`

### Lógica Atual
```sql
-- RPC get_financial_radar (backend)
SELECT jsonb_build_object(
  'overdue', jsonb_build_object(
    'count', COALESCE(SUM(CASE WHEN due_date < v_today THEN 1 ELSE 0 END), 0)::int,
    'amount', COALESCE(SUM(CASE WHEN due_date < v_today THEN amount ELSE 0 END), 0)::numeric
  ),
  ...
)
FROM transactions
WHERE household_id = p_household_id
  AND kind = 'EXPENSE'
  AND status = 'planned'
  AND cancelled_at IS NULL
  AND due_date IS NOT NULL
  AND due_date < CURRENT_DATE;
```

**Fórmula:**
```
Vencidas = Σ(amount) de transações onde:
  - kind = 'EXPENSE'
  - status = 'planned'
  - due_date < hoje
  - cancelled_at IS NULL
```

### Exibição no Dashboard
- **Componente**: `MaturityRadar` → Card "Vencidas"
- **Valor**: `radar.overdue.amount` e `radar.overdue.count`

### Possível Falha
✅ **Nenhuma falha identificada**
- Calculado no backend (RPC) garantindo consistência
- Filtra corretamente por status 'planned' e data de vencimento
- Exclui transações canceladas

---

## C. VENCE HOJE (Due Today)

### Arquivo/Função
- **Componente**: `src/components/dashboard/MaturityRadar.tsx` (linha 190-200)
- **Hook**: `src/hooks/useFinancialRadar.ts` (linha 25-82)
- **RPC Backend**: `supabase/migrations/20260123022606_*.sql` - função `get_financial_radar`

### Lógica Atual
```sql
-- RPC get_financial_radar (backend)
'today', jsonb_build_object(
  'count', COALESCE(SUM(CASE WHEN due_date = v_today THEN 1 ELSE 0 END), 0)::int,
  'amount', COALESCE(SUM(CASE WHEN due_date = v_today THEN amount ELSE 0 END), 0)::numeric
)
```

**Fórmula:**
```
Vence Hoje = Σ(amount) de transações onde:
  - kind = 'EXPENSE'
  - status = 'planned'
  - due_date = hoje
  - cancelled_at IS NULL
```

### Exibição no Dashboard
- **Componente**: `MaturityRadar` → Card "Vence Hoje"
- **Valor**: `radar.today.amount` e `radar.today.count`

### Possível Falha
✅ **Nenhuma falha identificada**
- Usa comparação de data exata (`due_date = CURRENT_DATE`)
- Calculado no backend garantindo precisão

---

## D. PRÓXIMOS 7 DIAS (Next 7 days expenses)

### Arquivo/Função
- **Componente**: `src/components/dashboard/MaturityRadar.tsx` (linha 202-216)
- **Hook**: `src/hooks/useFinancialRadar.ts` (linha 25-82)
- **RPC Backend**: `supabase/migrations/20260123022606_*.sql` - função `get_financial_radar`

### Lógica Atual
```sql
-- RPC get_financial_radar (backend)
'upcoming', jsonb_build_object(
  'count', COALESCE(SUM(CASE WHEN due_date > v_today AND due_date <= v_today + INTERVAL '7 days' THEN 1 ELSE 0 END), 0)::int,
  'amount', COALESCE(SUM(CASE WHEN due_date > v_today AND due_date <= v_today + INTERVAL '7 days' THEN amount ELSE 0 END), 0)::numeric
)
```

**Fórmula:**
```
Próximos 7 dias = Σ(amount) de transações onde:
  - kind = 'EXPENSE'
  - status = 'planned'
  - due_date > hoje AND due_date <= hoje + 7 dias
  - cancelled_at IS NULL
```

### Exibição no Dashboard
- **Componente**: `MaturityRadar` → Card "Próximos 7 dias"
- **Valor**: `radar.upcoming.amount` e `radar.upcoming.count`

### Possível Falha
✅ **Nenhuma falha identificada**
- Intervalo correto: exclui hoje, inclui até 7 dias à frente
- Calculado no backend

---

## E. PROJEÇÃO INTELIGENTE (Smart Projection/Forecast)

### Arquivo/Função
- **Componente**: `src/components/dashboard/FutureEngineWidget.tsx` (linha 161-310)
- **Hook**: `src/hooks/useFutureEngine.ts` (linha 59-177)
- **Cálculo**: `src/domain/finance/computeFutureEngine.ts` (linha 109-186)

### Lógica Atual
```typescript
// computeFutureEngine.ts (linha 109-186)
const dailyVariableRate = daysInMonth > 0 ? historicalVariableAvg / daysInMonth : 0;
const projectedVariableRemaining = dailyVariableRate * daysRemaining;

const totalProjectedExpenses = pendingFixedExpenses + projectedVariableRemaining;
const estimatedEndOfMonth = currentBalance - totalProjectedExpenses;
```

**Fórmula:**
```
1. Média histórica de despesas variáveis (últimos 3 meses):
   historicalVariableAvg = Σ(variable_expenses_confirmed) / número_de_meses

2. Taxa diária de gastos variáveis:
   dailyVariableRate = historicalVariableAvg / dias_no_mês

3. Projeção de gastos variáveis restantes:
   projectedVariableRemaining = dailyVariableRate * dias_restantes

4. Total de despesas projetadas:
   totalProjectedExpenses = pendingFixedExpenses + projectedVariableRemaining

5. Saldo estimado no fim do mês:
   estimatedEndOfMonth = currentBalance - totalProjectedExpenses
```

**Fonte de dados:**
- `currentBalance`: `totals.availableRealizedBalance` (exclui reservas)
- `pendingFixedExpenses`: Soma de transações com `status='planned'` e `expense_type='fixed'`
- `confirmedVariableThisMonth`: Soma de transações com `status='confirmed'` e `expense_type='variable'` no mês atual
- `historicalVariableAvg`: Média dos últimos 3 meses (excluindo mês atual)

### Exibição no Dashboard
- **Componente**: `FutureEngineWidget`
- **Valor principal**: `estimatedEndOfMonth`
- **Zona de segurança**: `safeSpendingZone` (com buffer de 10%)

### Possível Falha
⚠️ **POSSÍVEL FALHA IDENTIFICADA:**
1. **Dependência de histórico**: Se não houver 3 meses de histórico, a projeção pode ser imprecisa
2. **Assumindo padrão constante**: A fórmula assume que os gastos variáveis seguem um padrão linear diário, o que pode não refletir realidade (ex: gastos concentrados em fins de semana)
3. **Não considera sazonalidade**: Não diferencia meses com mais gastos (ex: dezembro)

**Recomendação:**
- Adicionar validação de confiança baseada em quantidade de dados históricos
- Considerar usar mediana ao invés de média para reduzir impacto de outliers

---

## F. SALDO DISPONÍVEL (Available Balance)

### Arquivo/Função
- **Componente**: `src/pages/Index.tsx` (linha 259-273)
- **Hook**: `src/hooks/useAccountProjections.ts` (linha 50)
- **Cálculo**: `src/domain/finance/computeUnifiedMetrics.ts` (linha 368-410)

### Lógica Atual
```typescript
// computeUnifiedAccountMetrics.ts (linha 368-410)
const totals = projections.reduce<UnifiedTotals>(
  (acc, p) => {
    const isReserve = p.account.is_reserve ?? false;
    
    // Global totals
    acc.realizedBalance += p.realizedBalance;
    
    if (isReserve) {
      // Reserve accounts (Caixinhas) - NÃO incluídas em available
      acc.reserveRealizedBalance += p.realizedBalance;
    } else {
      // Operational accounts (available for spending)
      acc.availableRealizedBalance += p.realizedBalance; // ← SALDO DISPONÍVEL
    }
    
    return acc;
  },
  { ... }
);
```

**Fórmula:**
```
Saldo Disponível = Σ(accounts.current_balance) para contas onde is_reserve = false
```

**Considera fluxo futuro?**
❌ **NÃO** - O saldo disponível mostra apenas o saldo atual (realizado), não considera transações pendentes.

**Para considerar fluxo futuro, usar:**
- `totals.availableProjectedBalance` = Saldo disponível + receitas pendentes - despesas pendentes

### Exibição no Dashboard
- **Componente**: `GlassStatCard` (linha 262 do Index.tsx)
- **Valor**: `totals.availableRealizedBalance`
- **Tooltip**: Mostra saldo em reservas se houver

### Possível Falha
✅ **Nenhuma falha identificada**
- Exclui corretamente contas reserva (`is_reserve=true`)
- Usa saldo calculado pelo banco (RPC)

---

## G. PREVISÃO DE FECHAMENTO (Closing Forecast)

### Arquivo/Função
- **Componente**: `src/pages/Index.tsx` (linha 287-303)
- **Hook**: `src/hooks/useAccountProjections.ts` (linha 50)
- **Cálculo**: `src/domain/finance/computeUnifiedMetrics.ts` (linha 353)

### Lógica Atual
```typescript
// computeUnifiedAccountMetrics.ts (linha 353)
const projectedBalance = realizedBalance + pendingIncome - pendingExpenses;

// Em totals (linha 375)
acc.availableProjectedBalance += p.projectedBalance;
```

**Fórmula:**
```
Previsão de Fechamento = Saldo Disponível + Receitas Pendentes - Despesas Pendentes

Onde:
- Saldo Disponível = Σ(current_balance) de contas não-reserva
- Receitas Pendentes = Σ(amount) de transações com status='planned' e kind='INCOME'
- Despesas Pendentes = Σ(amount) de transações com status='planned' e kind='EXPENSE'
```

**Considera fluxo futuro?**
✅ **SIM** - Inclui transações pendentes (`status='planned'`)

### Exibição no Dashboard
- **Componente**: `GlassStatCard` (linha 289 do Index.tsx)
- **Valor**: `totals.availableProjectedBalance`
- **Trend Label**: Mostra diferença em relação ao saldo disponível atual

### Possível Falha
✅ **Nenhuma falha identificada**
- Considera corretamente transações pendentes
- Exclui contas reserva
- Mostra variação em relação ao saldo atual

---

## H. PRÓXIMOS VENCIMENTOS (Listagem de 7d, 15d, 30d)

### Arquivo/Função
- **Componente**: `src/pages/Index.tsx` (linha 125-142, 465-544)
- **Hook**: `src/hooks/useTransactions.ts` (linha 724-739)

### Lógica Atual
```typescript
// Index.tsx (linha 125-142)
const upcomingDueExpenses = useMemo(() => {
  const today = startOfDay(new Date());
  const endDate = addDays(today, upcomingDays); // 7, 15 ou 30 dias
  
  return transactions.filter(t => {
    if (t.kind !== 'EXPENSE') return false;
    if (t.expense_type !== 'fixed') return false; // ⚠️ Só mostra despesas fixas
    if (t.status !== 'planned') return false;
    if (!t.due_date) return false;
    
    const dueDate = parseISO(t.due_date);
    return isWithinInterval(dueDate, { start: today, end: endDate });
  }).sort((a, b) => {
    const dateA = parseISO(a.due_date!);
    const dateB = parseISO(b.due_date!);
    return dateA.getTime() - dateB.getTime();
  });
}, [transactions, upcomingDays]);
```

**Fórmula:**
```
Próximos Vencimentos = Lista de transações onde:
  - kind = 'EXPENSE'
  - expense_type = 'fixed'  ⚠️ ATENÇÃO: Só despesas fixas
  - status = 'planned'
  - due_date IS NOT NULL
  - due_date >= hoje AND due_date <= hoje + N dias (7, 15 ou 30)
```

### Exibição no Dashboard
- **Componente**: Card "Próximos Vencimentos" (linha 465-544 do Index.tsx)
- **Filtros**: Botões para 7d, 15d, 30d
- **Listagem**: Mostra até 5 itens, com total no rodapé

### Possível Falha
⚠️ **FALHA IDENTIFICADA:**
1. **Filtro restritivo**: Apenas mostra despesas `expense_type='fixed'`, ignorando despesas variáveis com `due_date`
2. **Inconsistência**: O Radar de Maturidade (MaturityRadar) mostra TODAS as despesas planejadas, mas esta listagem só mostra fixas

**Recomendação:**
- Remover filtro `expense_type === 'fixed'` para incluir todas as despesas com data de vencimento
- OU adicionar filtro opcional para escolher entre "fixas" e "todas"

---

## MAPEAMENTO DE FONTES DE DADOS

### 1. Saldos de Contas
- **Fonte**: `accounts.current_balance` (calculado via RPC `get_account_balance()`)
- **RPC**: `supabase/migrations/20260125161231_*.sql`
- **Lógica**: Soma todas as transações confirmadas até hoje

### 2. Transações Mensais
- **Fonte**: Query direta em `transactions` table
- **Hook**: `useTransactions({ month: selectedMonth })`
- **Filtros**: 
  - `status IN ('planned', 'confirmed')`
  - `cancelled_at IS NULL`
  - Filtro por mês usando `effective_date` (due_date ou date)

### 3. Radar de Vencimentos
- **Fonte**: RPC `get_financial_radar()`
- **Arquivo**: `supabase/migrations/20260123022606_*.sql`
- **Retorna**: JSON com `overdue`, `today`, `upcoming`

### 4. Projeções por Conta
- **Fonte**: `useAccountProjections()` hook
- **Cálculo**: `computeUnifiedAccountMetrics()` (client-side)
- **Lógica**: 
  - Saldo realizado = `current_balance` da conta
  - Pendentes = transações com `status='planned'` até fim do mês
  - Projetado = realizado + receitas pendentes - despesas pendentes

---

## REGRAS DE NEGÓCIO CRÍTICAS IDENTIFICADAS

### 1. Status-Based Logic (Cards)
- **REALIZADO** = `status === 'confirmed'` (independente da data)
- **PENDENTE** = `status === 'planned'` (independente da data)
- **Objetivo**: Evitar duplicidade quando usuário marca transação como confirmada

### 2. Date-Based Logic (Saldos de Conta)
- **Saldo da Conta** = Soma de transações confirmadas com `effective_date <= hoje`
- **Objetivo**: Reconciliação bancária precisa

### 3. Effective Date
- **EXPENSE**: Usa `due_date` se disponível, senão `date`
- **INCOME/TRANSFER**: Usa `date`
- **Objetivo**: Agrupar despesas por data de vencimento, não data de registro

### 4. Exclusão de Reservas
- Contas com `is_reserve=true` são excluídas do "Saldo Disponível"
- Incluídas no "Patrimônio Acumulado" total
- **Objetivo**: Separar dinheiro operacional de reservas

### 5. Transações Canceladas
- Sempre excluídas: `cancelled_at IS NULL` em todas as queries
- **Objetivo**: Não contar transações deletadas nos cálculos

---

## CONCLUSÕES E RECOMENDAÇÕES

### ✅ Pontos Fortes
1. **Fonte única de verdade**: `computeUnifiedMetrics.ts` centraliza cálculos
2. **Backend para saldos**: RPCs garantem consistência de saldos
3. **Separação clara**: Status-based para cards, date-based para saldos
4. **Exclusão correta**: Reservas e canceladas são tratadas adequadamente

### ⚠️ Pontos de Atenção
1. **Projeção Inteligente**: Depende de histórico, pode ser imprecisa sem dados suficientes
2. **Próximos Vencimentos**: Filtro muito restritivo (só fixas), pode ocultar informações importantes
3. **Client-side calculations**: Alguns cálculos complexos no frontend podem ter problemas de performance com muitos dados

### 🔧 Recomendações
1. **Adicionar validação de confiança** na Projeção Inteligente baseada em quantidade de dados históricos
2. **Remover ou tornar opcional** o filtro `expense_type='fixed'` na listagem de próximos vencimentos
3. **Considerar mover cálculos pesados** para RPCs no backend para melhor performance
4. **Adicionar testes unitários** para as funções de cálculo em `computeUnifiedMetrics.ts`

---

**Fim do Relatório**
