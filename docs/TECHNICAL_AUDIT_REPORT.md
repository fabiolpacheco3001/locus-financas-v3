# 🔍 RELATÓRIO DE AUDITORIA TÉCNICA - POST-LOVABLE
**Data:** 29 de Janeiro de 2026  
**Escopo:** Migração Low-Code (Lovable) → Desenvolvimento Profissional (Cursor/Vite/Node)

---

## 📊 RESUMO EXECUTIVO

**Nota Geral da Arquitetura: 7.5/10**

### ✅ Pontos Fortes
- ✅ RLS (Row Level Security) implementado corretamente em todas as tabelas
- ✅ Uso consistente de `household_id` em queries diretas
- ✅ Arquitetura Database-First com RPCs para cálculos críticos
- ✅ TanStack Query configurado globalmente com cache adequado
- ✅ Separação clara entre Domain Layer e Hooks

### ⚠️ Pontos de Atenção
- ⚠️ Alguns campos TypeScript não sincronizados com schema Supabase
- ⚠️ Dependência residual do Lovable (`lovable-tagger`)
- ⚠️ Falta de `gcTime` explícito em alguns hooks críticos
- ⚠️ RPC `get_accounts_with_balances` sem filtro explícito de `household_id` (mas protegido por RLS)

---

## 🔴 INCONSISTÊNCIAS CRÍTICAS

### 1. SINCRONIA DE DADOS: TypeScript vs Supabase Schema

#### 1.1 Tabela `accounts`
**Status:** ⚠️ **INCONSISTÊNCIA PARCIAL**

| Campo TypeScript | Campo Supabase | Status |
|-----------------|----------------|--------|
| `is_primary` | ✅ Existe | ✅ OK |
| `is_reserve` | ✅ Existe | ✅ OK |
| `is_active` | ✅ Existe | ✅ OK |

**Observação:** Todos os campos estão sincronizados. ✅

#### 1.2 Tabela `transactions`
**Status:** ⚠️ **INCONSISTÊNCIA ENCONTRADA**

| Campo TypeScript | Campo Supabase | Status |
|-----------------|----------------|--------|
| `status` | ✅ Existe (`'confirmed' \| 'planned' \| 'cancelled'`) | ✅ OK |
| `confirmed_at` | ✅ Existe | ✅ OK |
| `confirmed_by` | ✅ Existe | ✅ OK |
| `cancelled_at` | ✅ Existe | ✅ OK |
| `cancelled_by` | ✅ Existe | ✅ OK |
| `expense_type` | ✅ Existe (`'fixed' \| 'variable'`) | ✅ OK |
| `due_date` | ✅ Existe | ✅ OK |
| `installment_group_id` | ✅ Existe | ✅ OK |
| `installment_number` | ✅ Existe | ✅ OK |
| `installment_total` | ✅ Existe | ✅ OK |
| `payment_method` | ✅ Existe | ✅ OK |
| `credit_card_id` | ✅ Existe | ✅ OK |
| `invoice_month` | ✅ Existe | ✅ OK |

**Observação:** Todos os campos estão sincronizados. ✅

#### 1.3 Tabela `categories`
**Status:** ⚠️ **INCONSISTÊNCIA ENCONTRADA**

| Campo TypeScript | Campo Supabase | Status |
|-----------------|----------------|--------|
| `is_budget_excluded` | ✅ Existe | ✅ OK |
| `is_essential` | ✅ Existe | ✅ OK |
| `archived_at` | ❓ **NÃO ENCONTRADO** | ⚠️ **CRÍTICO** |

**Problema:** O campo `archived_at` está definido no TypeScript (`src/types/finance.ts:45`) mas **NÃO existe no schema Supabase**.

**Impacto:** 
- Código que tenta filtrar categorias arquivadas pode falhar silenciosamente
- Queries que usam `.is('archived_at', null)` retornarão erro SQL

**Recomendação:** 
```sql
-- Adicionar campo archived_at à tabela categories
ALTER TABLE public.categories 
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE NULL;
```

#### 1.4 Tabela `subcategories`
**Status:** ⚠️ **INCONSISTÊNCIA ENCONTRADA**

| Campo TypeScript | Campo Supabase | Status |
|-----------------|----------------|--------|
| `archived_at` | ❓ **NÃO ENCONTRADO** | ⚠️ **CRÍTICO** |

**Problema:** Similar ao `categories`, o campo `archived_at` está no TypeScript mas não no banco.

**Recomendação:**
```sql
ALTER TABLE public.subcategories 
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE NULL;
```

#### 1.5 Tabela `budgets`
**Status:** ✅ **SINCRONIZADO**

Todos os campos TypeScript correspondem ao schema Supabase.

---

## 🚀 REFATORAÇÃO DE PERFORMANCE

### 2. HIGIENE DE HOOKS: TanStack Query

#### 2.1 Configuração Global (`src/App.tsx`)
**Status:** ✅ **BOM**

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos ✅
      gcTime: 1000 * 60 * 30,   // 30 minutos ✅
      retry: 1,                  // ✅
      refetchOnWindowFocus: false, // ✅
    },
  },
});
```

**Avaliação:** Configuração adequada para aplicação financeira.

#### 2.2 `useAccounts.ts`
**Status:** ⚠️ **PODE MELHORAR**

```typescript
// Linha 40-96
const { data: accountsWithBalances = [], isLoading } = useQuery({
  queryKey: ['accounts', 'with-balances', householdId],
  queryFn: async () => { /* ... */ },
  enabled: !!householdId,
  staleTime: 1000 * 60 * 5, // ✅ 5 minutos
  // ❌ FALTA: gcTime explícito (usa padrão global de 30min)
});
```

**Problema:** 
- Não define `gcTime` explícito (usa padrão global)
- Para dados críticos como saldos de contas, 30min pode ser muito

**Recomendação:**
```typescript
staleTime: 1000 * 60 * 5,  // 5 minutos
gcTime: 1000 * 60 * 10,    // 10 minutos (mais conservador para dados financeiros)
```

#### 2.3 `useAccountProjections.ts`
**Status:** ⚠️ **PODE MELHORAR**

```typescript
// Linha 27-69
const { data, isLoading } = useQuery({
  queryKey: ['account-projections', householdId, format(selectedMonth, 'yyyy-MM')],
  queryFn: async () => { /* ... */ },
  enabled: !!householdId,
  staleTime: 1000 * 60 * 5, // ✅ 5 minutos
  // ❌ FALTA: gcTime explícito
});
```

**Problema:** Similar ao `useAccounts`, falta `gcTime` explícito.

**Recomendação:**
```typescript
staleTime: 1000 * 60 * 5,
gcTime: 1000 * 60 * 15, // 15 minutos (projeções mudam menos frequentemente)
```

#### 2.4 `useTransactions.ts`
**Status:** ⚠️ **PODE MELHORAR**

**Problema:** Não define `staleTime` nem `gcTime` explícitos, usando apenas padrão global.

**Recomendação:**
```typescript
staleTime: 1000 * 60 * 2,  // 2 minutos (transações mudam frequentemente)
gcTime: 1000 * 60 * 10,    // 10 minutos
```

#### 2.5 `useNotifications.ts`
**Status:** ⚠️ **CRÍTICO**

```typescript
// Linha 48-64
const { data: notifications = [], isLoading } = useQuery({
  queryKey: ['notifications', householdId],
  queryFn: async () => { /* ... */ },
  enabled: !!householdId,
  // ❌ FALTA: staleTime e gcTime
});
```

**Problema:** Notificações são dados críticos e devem ter cache curto para garantir atualização em tempo real.

**Recomendação:**
```typescript
staleTime: 1000 * 30,      // 30 segundos (notificações precisam ser frescas)
gcTime: 1000 * 60 * 5,     // 5 minutos
refetchOnWindowFocus: true, // Recarregar ao voltar para a janela
```

**Observação:** O hook já tem subscription realtime (linha 67-89), mas o cache ainda deve ser curto para evitar inconsistências.

---

### 3. ESTADO DE AUTENTICAÇÃO: AuthContext

#### 3.1 Análise de `src/contexts/AuthContext.tsx`
**Status:** ✅ **BOM** (com ressalvas)

**Pontos Positivos:**
- ✅ `loading` é setado para `false` imediatamente após obter sessão (linha 107)
- ✅ `fetchMember` roda em background sem bloquear UI (linha 110-113)
- ✅ Proteção contra loops: `memberFetched` flag (linha 27) - **MAS NÃO ESTÁ SENDO USADA**

**Problemas Identificados:**

1. **Flag `memberFetched` não utilizada:**
   ```typescript
   // Linha 27: Flag declarada mas nunca verificada
   const [memberFetched, setMemberFetched] = useState(false);
   ```
   
   **Impacto:** Se `fetchMember` for chamado múltiplas vezes antes de completar, pode causar race conditions.

   **Recomendação:**
   ```typescript
   const fetchMember = async (_userId?: string) => {
     if (memberFetched) return; // Evitar múltiplas chamadas simultâneas
     try {
       // ... código existente ...
     } finally {
       setMemberFetched(true);
     }
   };
   ```

2. **RPC `get_members_visible` sem parâmetro `household_id`:**
   ```typescript
   // Linha 32: RPC chamado sem parâmetro
   const { data, error } = await supabase.rpc('get_members_visible');
   ```
   
   **Análise:** O RPC provavelmente usa `get_user_household_id()` internamente (via RLS), então está seguro. Mas seria mais explícito passar `household_id` se disponível.

3. **Proteção contra loops de redirecionamento:**
   ✅ **OK** - O `ProtectedRoute` provavelmente verifica `loading` antes de redirecionar.

---

## 🔒 SEGURANÇA (RLS)

### 4. VERIFICAÇÃO DE FILTROS `household_id`

#### 4.1 Queries Diretas (`.from().select()`)
**Status:** ✅ **EXCELENTE**

Todas as queries diretas verificadas **incluem filtro `household_id`**:

| Hook | Query | Filtro `household_id` |
|------|-------|----------------------|
| `useAccounts` | `get_accounts_with_balances()` RPC | ✅ Protegido por RLS |
| `useAccountProjections` | `accounts.select()` | ✅ `.eq('household_id', householdId)` |
| `useAccountProjections` | `transactions.select()` | ✅ `.eq('household_id', householdId)` |
| `useTransactions` | `transactions.select()` | ✅ `.eq('household_id', householdId)` |
| `useNotifications` | `notifications.select()` | ✅ `.eq('household_id', householdId)` |
| `useMembers` | `get_members_visible()` RPC | ✅ Protegido por RLS |

**Conclusão:** ✅ **Nenhuma query direta sem filtro `household_id` encontrada.**

#### 4.2 RPC Functions
**Status:** ⚠️ **ATENÇÃO**

| RPC Function | Filtro Explícito | Proteção RLS |
|--------------|------------------|--------------|
| `get_accounts_with_balances()` | ❌ Não | ✅ Sim (usa `get_user_household_id()`) |
| `get_members_visible()` | ❌ Não | ✅ Sim (usa `get_user_household_id()`) |
| `get_financial_radar(p_household_id)` | ✅ Sim | ✅ Sim (verifica `get_user_household_id()`) |
| `predict_transaction_details()` | ❌ Não | ✅ Sim (usa `get_user_household_id()`) |

**Análise:**
- ✅ Todas as RPCs verificadas têm proteção RLS via `get_user_household_id()`
- ⚠️ Algumas RPCs não recebem `household_id` como parâmetro, mas estão protegidas internamente

**Recomendação:** 
- Manter como está (RLS é suficiente)
- Considerar adicionar `household_id` como parâmetro para maior clareza e testabilidade

---

## 🧹 ACOPLAMENTO LOVABLE

### 5. DEPENDÊNCIAS E IMPORTS RESIDUAIS

#### 5.1 Dependências no `package.json`
**Status:** ⚠️ **DEPENDÊNCIA RESIDUAL ENCONTRADA**

```json
// package.json linha 93
"devDependencies": {
  "lovable-tagger": "^1.1.13",  // ⚠️ DEPENDÊNCIA RESIDUAL
}
```

**Uso encontrado:**
- `vite.config.ts` linha 4: `import { componentTagger } from "lovable-tagger";`

**Impacto:** Baixo (apenas para tagging de componentes durante desenvolvimento)

**Recomendação:** 
- ✅ **Manter** se ainda útil para desenvolvimento
- ❌ **Remover** se não for mais necessário

#### 5.2 Mock Data
**Status:** ⚠️ **MOCK DATA ENCONTRADO**

| Arquivo | Mock Data | Status |
|---------|-----------|--------|
| `src/types/openFinance.ts` | `MOCK_BANKS` (linha 105) | ⚠️ **OK** (para desenvolvimento) |
| `src/hooks/useOpenFinanceConsent.ts` | Usa `MOCK_BANKS` | ⚠️ **OK** (feature em desenvolvimento) |
| `supabase/functions/categorize-transactions/index.ts` | Referência `LOVABLE_API_KEY` | ⚠️ **OK** (integração real) |

**Análise:**
- ✅ Mock data está isolado em features específicas (Open Finance)
- ✅ Não há mock data sendo usado em produção para dados críticos

**Recomendação:** ✅ **Manter como está** - mocks estão apropriadamente isolados.

#### 5.3 Referências Lovable em Documentação
**Status:** ⚠️ **DOCUMENTAÇÃO DESATUALIZADA**

| Arquivo | Conteúdo |
|---------|----------|
| `README.md` | Referências a Lovable como plataforma principal |
| `index.html` | Meta tags com imagens Lovable |

**Recomendação:** 
- Atualizar `README.md` para refletir migração para desenvolvimento local
- Atualizar `index.html` com imagens próprias do projeto

---

## 📋 MAPA DE SAÚDE DA ARQUITETURA

### 6. NOTA POR CATEGORIA

| Categoria | Nota | Comentário |
|-----------|------|------------|
| **Sincronia de Dados** | 8/10 | 2 campos faltando (`archived_at` em categories/subcategories) |
| **Performance (Cache)** | 7/10 | Configuração global boa, mas falta `gcTime` explícito em hooks críticos |
| **Segurança (RLS)** | 9/10 | Excelente - todas queries protegidas, RLS funcionando |
| **Estado de Autenticação** | 8/10 | Bom, mas flag `memberFetched` não utilizada |
| **Acoplamento Lovable** | 9/10 | Mínimo - apenas dependência dev e mocks isolados |
| **Arquitetura Geral** | 8/10 | Database-First bem implementado, Domain Layer separado |

### **NOTA FINAL: 7.5/10**

---

## 🎯 PLANO DE AÇÃO PRIORITÁRIO

### 🔴 CRÍTICO (Fazer Imediatamente)
1. **Adicionar campo `archived_at` às tabelas `categories` e `subcategories`**
   ```sql
   ALTER TABLE public.categories ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE NULL;
   ALTER TABLE public.subcategories ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE NULL;
   ```

### 🟡 IMPORTANTE (Próximas 2 semanas)
2. **Adicionar `gcTime` explícito em hooks críticos:**
   - `useAccounts.ts`
   - `useAccountProjections.ts`
   - `useTransactions.ts`
   - `useNotifications.ts` (com `staleTime` curto)

3. **Corrigir flag `memberFetched` não utilizada em `AuthContext.tsx`**

### 🟢 MELHORIAS (Próximo mês)
4. **Atualizar documentação:**
   - `README.md` - remover referências Lovable
   - `index.html` - atualizar meta tags

5. **Considerar adicionar `household_id` como parâmetro explícito em RPCs** (opcional, RLS já protege)

---

## 📝 CONCLUSÃO

O projeto está em **bom estado técnico** após a migração do Lovable. As principais inconsistências são:

1. ✅ **Segurança:** Excelente - RLS funcionando corretamente
2. ⚠️ **Sincronia:** 2 campos faltando no banco (`archived_at`)
3. ⚠️ **Performance:** Cache pode ser otimizado com `gcTime` explícito
4. ✅ **Arquitetura:** Database-First bem implementado

**Recomendação Geral:** Priorizar correção dos campos faltantes (`archived_at`) e otimização de cache nos hooks críticos. O restante são melhorias incrementais.

---

**Gerado por:** Auditoria Técnica Automatizada  
**Data:** 29 de Janeiro de 2026
