# Architectural Audit: Locus Finanças

**Data:** 22 de Janeiro de 2026  
**Versão:** 3.0 (Auditoria Completa)  
**Objetivo:** Mapeamento completo para preparação de escala (SaaS)

---

## 1. Tech Stack Core

### Frameworks & Libraries de Produção

| Categoria | Tecnologia | Versão | Uso |
|-----------|-----------|--------|-----|
| **Frontend Framework** | React | ^18.3.1 | SPA com TypeScript |
| **Build Tool** | Vite | -- | Dev server + bundling |
| **Styling** | Tailwind CSS | -- | Design system tokenizado |
| **UI Components** | shadcn/ui (Radix) | Múltiplos | 54 primitivos acessíveis |
| **State Management** | TanStack Query | ^5.83.0 | Cache + server state |
| **Routing** | React Router | ^6.30.1 | Client-side routing |
| **Backend** | Supabase (Cloud) | ^2.90.1 | Auth, DB, RLS |
| **Forms** | React Hook Form + Zod | ^7.61.1 / ^3.25.76 | Validação tipada |
| **i18n** | i18next + react-i18next | ^25.7.4 / ^16.5.3 | pt-BR, en, es |
| **Animations** | Framer Motion | ^12.27.5 | Micro-interações |
| **Charts** | Recharts | ^2.15.4 | Gráficos financeiros |
| **Dates** | date-fns | ^3.6.0 | Manipulação de datas |
| **Toasts** | Sonner | ^1.7.4 | Notificações |

### Libraries de Desenvolvimento/Testes

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| Vitest | ^4.0.17 | Unit tests |
| Playwright | ^1.57.0 | E2E tests |
| TypeScript | -- | Tipagem estática |
| ESLint | -- | Linting |

---

## 2. Estrutura de Pastas & Organização

```
src/
├── components/         # Componentes React (14 subpastas)
│   ├── ui/             # ✅ 54 primitivos shadcn reutilizáveis
│   ├── accounts/       # ⭐ REFATORADO - Cards, List, Form, Detail
│   │   ├── hooks/useAccountsPageState.ts
│   │   ├── AccountCard.tsx
│   │   ├── AccountsList.tsx
│   │   ├── AccountFormDialog.tsx
│   │   └── AccountDetailDialog.tsx
│   ├── auth/           # InputWithError, ProtectedRoute
│   ├── budget/         # ⭐ REFATORADO - Summary, Cards, Dialogs
│   │   ├── hooks/useBudgetPageState.ts
│   │   ├── BudgetSummary.tsx
│   │   ├── BudgetCategoryCard.tsx
│   │   ├── RecurringBudgetDialog.tsx
│   │   ├── RecurringBudgetList.tsx
│   │   └── DeleteRecurringBudgetDialog.tsx
│   ├── credit-cards/   # CreditCardDialog, InvoiceDrawer, Visual
│   ├── dashboard/      # 11 widgets (AnimatedCard, Charts, etc.)
│   ├── gamification/   # XpProgressBar
│   ├── invites/        # PendingInvitesBanner
│   ├── layout/         # AppLayout, StickyHeaderFilters
│   ├── members/        # InviteDialog
│   ├── notifications/  # NotificationBell
│   ├── settings/       # LanguageSelector
│   ├── theme/          # ThemeProvider, ThemeToggle
│   └── transactions/   # ⭐ REFATORADO - Form, Table, Filters
│       ├── TransactionForm/
│       │   ├── TransactionFormDialog.tsx
│       │   └── useTransactionForm.ts
│       ├── ContextBarBadges.tsx
│       ├── InstallmentFields.tsx
│       ├── MoreFiltersContent.tsx
│       ├── RecurringFields.tsx
│       ├── TransactionHeader.tsx
│       ├── TransactionSummaryCards.tsx
│       └── TransactionTable.tsx
│
├── contexts/           # React Contexts
│   └── AuthContext.tsx # ✅ Único context global (152 linhas)
│
├── domain/             # ⭐ CAMADA PURA - Regras de negócio
│   └── finance/        # 9 módulos de cálculos financeiros
│       ├── buildTransactionFilters.ts
│       ├── calculateAvailableBalance.ts
│       ├── computeForecast.ts
│       ├── computeMonthlySnapshot.ts
│       ├── computeRiskAssessment.ts
│       ├── computeUnifiedMetrics.ts
│       ├── evaluateNotificationRules.ts
│       ├── logger.ts
│       └── types.ts
│
├── hooks/              # ⭐ 31 Custom Hooks centralizados
│   ├── useTransactions.ts      # CRUD transações + metrics
│   ├── useAccounts.ts          # CRUD contas + balance sync
│   ├── useAccountProjections.ts # Projeções mensais
│   ├── useBudgets.ts           # CRUD orçamentos
│   ├── useCategories.ts        # CRUD categorias
│   ├── useCreditCards.ts       # CRUD cartões + invoice
│   ├── useMembers.ts           # CRUD membros
│   ├── useNotifications.ts     # CRUD notificações + realtime
│   ├── useTransactionHandlers.ts # Handlers de form
│   ├── useRecurringTransactions.ts # Recorrências
│   ├── useRecurringBudgets.ts  # Orçamentos recorrentes
│   ├── useInstallments.ts      # Parcelamentos
│   ├── useSimulation.ts        # Simulações
│   ├── useFutureEvents.ts      # Eventos futuros
│   ├── useRiskEvents.ts        # Eventos de risco
│   ├── useRiskDetection.ts     # Detecção de riscos
│   ├── useRiskNotifications.ts # Notificações de risco
│   ├── useBudgetAlerts.ts      # Alertas de orçamento
│   ├── useBudgetValidation.ts  # Validação de orçamento
│   ├── useCategorySuggestion.ts # Sugestão de categoria
│   ├── useDescriptionSuggestions.ts # Sugestões de descrição
│   ├── useGamification.ts      # Sistema de XP
│   ├── useDeterministicInsights.ts # Insights
│   ├── usePendingInvites.ts    # Convites pendentes
│   ├── useRecurrenceDetection.ts # Detecção de recorrência
│   ├── useAIDecisionDetection.ts # Detecção IA
│   ├── useAIDecisionNotifications.ts # Notificações IA
│   ├── useNotificationTriggers.ts # Triggers
│   ├── useTransactionPreferences.ts # Preferências
│   ├── use-mobile.tsx          # Detecção mobile
│   └── use-toast.ts            # Toast helper
│
├── i18n/               # Internacionalização completa
│   ├── locales/        # 4 idiomas (pt-BR, en, es, pseudo)
│   ├── index.ts        # Configuração i18next
│   ├── useLocale.ts    # Hook de formatação
│   ├── messageTypes.ts # Tipos de mensagem
│   └── translateMessage.ts # Tradução dinâmica
│
├── integrations/       # Integrações externas
│   └── supabase/
│       ├── client.ts   # ⚠️ AUTO-GERADO - NÃO EDITAR
│       └── types.ts    # ⚠️ AUTO-GERADO - NÃO EDITAR
│
├── lib/                # 10 Utilitários puros
│   ├── utils.ts        # cn(), helpers Tailwind
│   ├── financeMetrics.ts # Métricas financeiras
│   ├── riskEngine.ts   # Motor de riscos
│   ├── dateUtils.ts    # Utilidades de data
│   ├── dateOnly.ts     # Data sem timezone
│   ├── authErrorMapper.ts # Mapeamento de erros auth
│   ├── errorMessages.ts # Mensagens de erro
│   ├── householdInvites.ts # Lógica de convites
│   ├── inviteUtils.ts  # Utils de convites
│   └── sanitizeMetadata.ts # Sanitização
│
├── pages/              # 11 Páginas/Rotas
│   ├── Index.tsx       # Dashboard (~600 linhas) - Candidato refatoração
│   ├── Transactions.tsx # ✅ REFATORADO (~455 linhas)
│   ├── Budget.tsx      # ✅ REFATORADO (~195 linhas)
│   ├── Accounts.tsx    # ✅ REFATORADO (~190 linhas)
│   ├── Categories.tsx  # Gestão de categorias
│   ├── CreditCards.tsx # Gestão de cartões
│   ├── Members.tsx     # Gestão de membros
│   ├── Notifications.tsx # Central de notificações
│   ├── Auth.tsx        # Autenticação
│   ├── Join.tsx        # Aceitar convites
│   └── NotFound.tsx    # 404
│
├── services/           # Camada de serviços (side effects)
│   ├── notificationsService.ts # Serviço de notificações
│   ├── balanceStateService.ts  # Serviço de saldos
│   └── index.ts
│
└── types/              # 4 arquivos de tipos TypeScript
    ├── finance.ts      # ✅ Tipos core (Transaction, Account, etc.)
    ├── creditCards.ts  # Tipos de cartões
    ├── notifications.ts # Tipos de notificações
    ├── gamification.ts # Tipos de gamificação
    └── riskEvents.ts   # Tipos de eventos de risco
```

### Análise da Estrutura

| Aspecto | Status | Observação |
|---------|--------|------------|
| Separação UI/Lógica | ✅ Excelente | `domain/` e `hooks/` bem separados |
| Componentes reutilizáveis | ✅ Excelente | `components/ui/` com 54 primitivos |
| Domain Layer | ✅ Excelente | `domain/finance/` com 9 funções puras |
| Services Layer | ✅ Bom | 2 serviços isolados |
| Hooks centralizados | ✅ Excelente | 31 hooks, nenhum fetch direto em componentes |
| Tipagem | ✅ Excelente | 5 arquivos de tipos + Supabase types |
| i18n | ✅ Excelente | 4 idiomas com fallback robusto |

---

## 3. Análise de Fluxo de Dados (Data Flow)

### Padrão de Fetching

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA FLOW PATTERN                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Page/Component                                                    │
│        │                                                            │
│        ▼                                                            │
│   ┌─────────────────┐                                               │
│   │  Custom Hook    │ ◄── useTransactions, useAccounts, etc.       │
│   │  (React Query)  │     31 hooks centralizados                    │
│   └────────┬────────┘                                               │
│            │                                                        │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │ Supabase Client │ ◄── supabase.from('table').select(...)       │
│   └────────┬────────┘                                               │
│            │                                                        │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │  Lovable Cloud  │ ◄── RLS Policies enforce security            │
│   │  (Supabase DB)  │                                               │
│   └─────────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Checklist de Padrões

| Padrão | Implementado | Detalhes |
|--------|--------------|----------|
| **Custom Hooks centralizados** | ✅ Sim | 31 hooks em `src/hooks/` |
| **Chamadas diretas em componentes** | ❌ Não | Todas via hooks |
| **React Query (TanStack Query)** | ✅ Sim | Cache automático, invalidation |
| **Tipagem forte** | ✅ Sim | Types em `src/types/` + Supabase types |
| **Erro handling centralizado** | ✅ Sim | `onError` com toasts via `sonner` |
| **Optimistic updates** | ⚠️ Parcial | Apenas em alguns mutations |
| **Domain Layer pura** | ✅ Sim | `domain/finance/` sem side effects |

### Fluxo de Dados Detalhado

```typescript
// ✅ PADRÃO IMPLEMENTADO EM TODO O PROJETO

// 1. Página usa hook
const { transactions, createTransaction } = useTransactions({ month });

// 2. Hook usa React Query
const { data, isLoading } = useQuery({
  queryKey: ['transactions', householdId, month],
  queryFn: async () => supabase.from('transactions').select('*'),
  enabled: !!householdId
});

// 3. Mutations com invalidation automática
const createTransaction = useMutation({
  mutationFn: async (data) => supabase.from('transactions').insert(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    toast.success(t('transaction.created'));
  }
});
```

### Cache Strategy

| Recurso | Cache Key | Invalidation |
|---------|-----------|--------------|
| Transactions | `['transactions', householdId, month, filters]` | On CRUD |
| Accounts | `['accounts', 'with-balances', householdId]` | On CRUD + reconcile |
| Budgets | `['budgets', householdId, year, month]` | On upsert/delete |
| Categories | `['categories', householdId]` | On CRUD |
| Members | `['members', householdId]` | On CRUD |
| Credit Cards | `['credit-cards', householdId]` | On CRUD |
| Notifications | `['notifications', householdId]` | On CRUD + realtime |

---

## 4. Pontos de Atenção (Dívida Técnica)

### 4.1 Arquivos Grandes (Linhas de Código)

| Arquivo | Linhas | Status | Ação Recomendada |
|---------|--------|--------|------------------|
| `pages/Index.tsx` (Dashboard) | ~600 | 🟡 Médio | Próximo candidato a modularização |
| `hooks/useAccounts.ts` | ~529 | 🟡 Médio | Considerar split de reconcile logic |
| `pages/Transactions.tsx` | ~455 | ✅ OK | Refatorado |
| `pages/Budget.tsx` | ~195 | ✅ OK | Refatorado |
| `pages/Accounts.tsx` | ~190 | ✅ OK | Refatorado |

### 4.2 Duplicação de Lógica (Resolvida/Pendente)

| Padrão | Locais | Status |
|--------|--------|--------|
| Formatação de moeda | Múltiplos | ✅ Centralizado em `useLocale.formatCurrency` |
| Cálculo de métricas | `financeMetrics.ts` + `computeUnifiedMetrics.ts` | 🟡 Consolidar |
| Data effective (due_date vs date) | Vários hooks | ✅ Função `getEffectiveDate` |
| Early returns (authLoading) | Todas as páginas | 🟡 Considerar HOC/wrapper |

### 4.3 Mistura de Responsabilidades

| Arquivo | Status | Detalhes |
|---------|--------|----------|
| `pages/Budget.tsx` | ✅ OK | Lógica em `useBudgetPageState` |
| `pages/Accounts.tsx` | ✅ OK | Lógica em `useAccountsPageState` |
| `pages/Transactions.tsx` | ✅ OK | Lógica em `useTransactionForm` |
| `hooks/useAccounts.ts` | 🟡 Médio | Fetch + Sync + Reconcile em um hook |

### 4.4 Potenciais Problemas de Performance

| Problema | Localização | Impacto | Solução |
|----------|-------------|---------|---------|
| Fetch de 10k transações | `useAccounts.ts` | 🟡 Médio | Aggregation no backend |
| Loop de cálculo no cliente | `useAccounts.ts` | 🟡 Médio | Stored procedure SQL |
| Lista sem virtualização | `TransactionTable.tsx` | 🟡 Médio | @tanstack/react-virtual |
| Re-renders em form | `TransactionForm` | ✅ OK | Isolado em `useTransactionForm` |

---

## 5. Segurança & Auth

### Arquitetura de Autenticação

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AUTH ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────┐                                               │
│   │   AuthProvider  │ ◄── Único context global (152 linhas)        │
│   │   (Context)     │     Wraps entire app                          │
│   └────────┬────────┘                                               │
│            │ useAuth()                                              │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │  Supabase Auth  │ ◄── JWT tokens, refresh, session             │
│   │  (Lovable Cloud)│     OAuth (Google) + Email/Password           │
│   └────────┬────────┘                                               │
│            │                                                        │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │  member_ident-  │ ◄── Links auth.users → members → household   │
│   │  ities (RLS)    │                                               │
│   └────────┬────────┘                                               │
│            │                                                        │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │  RLS Policies   │ ◄── Todas tabelas filtradas por household_id │
│   └─────────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### AuthContext API

```typescript
interface AuthContextType {
  user: User | null;           // Supabase auth user
  session: Session | null;      // JWT session
  member: Member | null;        // Perfil no household
  householdId: string | null;   // ID do household atual
  loading: boolean;             // Estado de carregamento
  signIn(email, password): Promise<{ error: Error | null }>;
  signUp(email, password, name): Promise<{ error: Error | null }>;
  signInWithGoogle(): Promise<{ error: Error | null }>;
  signOut(): Promise<void>;
  refreshMember(): Promise<void>;
}
```

### Fluxo de Sessão

1. **Inicialização:** `supabase.auth.getSession()` no mount
2. **Listener:** `onAuthStateChange` para sync automático
3. **Member fetch:** RPC `get_members_visible()` busca membro atual
4. **Household ID:** Armazenado no context, usado em todos os hooks

### Segurança - Checklist

| Item | Status | Detalhes |
|------|--------|----------|
| RLS em todas tabelas | ✅ Sim | Policies por `household_id` |
| Tokens JWT | ✅ Sim | Supabase managed |
| CSRF Protection | ✅ Sim | SameSite cookies |
| Secrets em .env | ✅ Sim | `VITE_SUPABASE_*` |
| Input sanitization | ✅ Sim | Triggers `trg_sanitize_*` |
| SQL Injection | ✅ Protegido | Supabase client escapes |
| XSS | ✅ Protegido | React auto-escaping |
| OAuth (Google) | ✅ Implementado | Com redirect seguro |
| Zero Trust RLS | ✅ Sim | `SECURITY DEFINER` RPCs |

### RPCs de Segurança

| Função | Propósito |
|--------|-----------|
| `get_user_household_id()` | Retorna household do usuário autenticado |
| `is_household_admin()` | Verifica se user é ADMIN |
| `get_members_visible()` | Lista membros com mascaramento de email |
| `accept_household_invite()` | Aceita convite com validações |
| `create_household_invite()` | Cria convite com token hash |
| `force_update_account_balance()` | SECURITY DEFINER para sync |

---

## 6. Resumo Executivo

### ✅ Pontos Fortes (Excelente)

1. **Arquitetura de Hooks** - 31 custom hooks centralizados, zero fetch direto em componentes
2. **Domain Layer Pura** - `domain/finance/` com 9 funções sem side effects
3. **TypeScript Strict** - Tipagem forte em 5 arquivos + Supabase types
4. **i18n Completo** - 4 idiomas com fallback robusto
5. **RLS Security** - Zero Trust model com SECURITY DEFINER RPCs
6. **React Query** - Cache e invalidation bem configurados
7. **Componentes UI** - 54 primitivos shadcn reutilizáveis
8. **Refatoração Completa** - `Budget.tsx`, `Accounts.tsx`, `Transactions.tsx` modularizados
9. **Testes** - 25+ specs E2E + 15+ testes unitários

### 🟡 Áreas de Melhoria (Médio)

1. **Dashboard** - `Index.tsx` (~600 linhas) candidato a modularização
2. **useAccounts.ts** - (~529 linhas) mistura fetch + reconcile
3. **Virtualização** - Listas longas sem @tanstack/react-virtual
4. **Aggregations** - Cálculos pesados ainda no cliente

### 🔴 Ações Prioritárias

| Prioridade | Ação | Impacto |
|------------|------|---------|
| 1 | Stored procedures para cálculos de saldo | Performance |
| 2 | Virtualização em TransactionTable | Performance |
| 3 | Modularizar Dashboard (Index.tsx) | Manutenibilidade |
| 4 | Consolidar financeMetrics.ts e computeUnifiedMetrics.ts | DRY |

---

## 7. Recomendações para Escala (200k usuários)

### Backend

- [ ] Criar stored procedures para cálculos de saldo
- [ ] Implementar indexes em `transactions(household_id, date, status)`
- [ ] Adicionar pagination/cursor nas queries pesadas
- [ ] Considerar materialized views para métricas

### Frontend

- [ ] Implementar virtualização com @tanstack/react-virtual
- [ ] Adicionar Suspense boundaries para loading states
- [ ] Considerar React.lazy para code splitting de páginas
- [ ] Implementar skeleton loaders consistentes

### Monitoramento

- [ ] Adicionar métricas de performance (Core Web Vitals)
- [ ] Implementar error tracking (Sentry ou similar)
- [ ] Dashboard de uso para identificar gargalos

---

**Documento gerado automaticamente - v3.0**  
**Última atualização:** 22/01/2026
