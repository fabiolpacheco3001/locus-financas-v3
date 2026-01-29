# Debug Dashboard - Saldo e Categorias

## Análise Realizada

### 1. HeroBalance e Saldo

**Fluxo de dados:**
- `Index.tsx` → `HeroBalance` recebe `totals.realizedBalance` de `useAccountProjections`
- `useAccountProjections` busca contas via `.from('accounts').eq('household_id', householdId)`
- Calcula saldo usando `computeUnifiedAccountMetrics` que considera:
  - `initial_balance` da conta
  - Transações confirmadas até o fim do mês atual

**Seed da conta:**
- A função `seed_household_data` cria uma conta "Conta Principal" com:
  - `initial_balance = 0` (DEFAULT)
  - `current_balance = 0` (DEFAULT)
  - Sem transações iniciais

**Resultado esperado:** R$ 0,00 ✅ (correto para conta nova sem transações)

### 2. Categorias em Transactions.tsx

**Fluxo de dados:**
- `Transactions.tsx` usa `useCategories()` hook
- `useCategories` busca via `.from('categories').eq('household_id', householdId)`
- Seed cria 12 categorias padrão

**Categorias esperadas:**
1. Moradia
2. Contas Fixas
3. Alimentação
4. Restaurante
5. Transporte
6. Saúde
7. Seguros
8. Assinaturas
9. Lazer
10. Educação
11. Investimentos
12. Outros

### 3. Possíveis Problemas de RLS

**Políticas RLS relevantes:**

```sql
-- Accounts
CREATE POLICY "Users can view accounts in their household"
  ON public.accounts FOR SELECT
  USING (household_id = public.get_user_household_id());

-- Categories  
CREATE POLICY "Users can view categories in their household"
  ON public.categories FOR SELECT
  USING (household_id = public.get_user_household_id());
```

**Função `get_user_household_id()`:**
```sql
SELECT m.household_id
FROM public.member_identities mi
JOIN public.members m ON m.id = mi.member_id
WHERE mi.user_id = auth.uid()
LIMIT 1;
```

**Possíveis causas de erro 404/403:**

1. **`householdId` não atualizado após criar família**
   - Se `refreshMember()` não for chamado após criar família
   - Se `get_members_visible()` não retornar o household_id corretamente

2. **`member_identities` não criado corretamente**
   - Se `create_household_with_admin` não criar o vínculo corretamente
   - Se houver problema na função `handle_new_user()` trigger

3. **Queries usando `householdId` direto vs RLS**
   - As queries usam `.eq('household_id', householdId)` diretamente
   - RLS ainda precisa permitir acesso baseado em `get_user_household_id()`
   - Se `get_user_household_id()` retornar NULL, RLS bloqueia mesmo com `householdId` correto

## Checklist de Validação

### ✅ Saldo
- [ ] HeroBalance mostra R$ 0,00 (correto para conta nova)
- [ ] Conta "Conta Principal" existe na tabela `accounts`
- [ ] `initial_balance = 0` e `current_balance = 0`

### ✅ Categorias
- [ ] 12 categorias aparecem em Transactions.tsx
- [ ] Categorias são selecionáveis no formulário
- [ ] Nenhum erro 404/403 no console ao carregar categorias

### ✅ RLS
- [ ] `get_user_household_id()` retorna o household_id correto
- [ ] `member_identities` tem registro para o usuário
- [ ] Queries de accounts e categories retornam dados (não vazio)

## Comandos SQL para Debug

```sql
-- Verificar household_id do usuário atual
SELECT public.get_user_household_id();

-- Verificar member_identities
SELECT * FROM public.member_identities WHERE user_id = auth.uid();

-- Verificar contas do household
SELECT * FROM public.accounts WHERE household_id = public.get_user_household_id();

-- Verificar categorias do household
SELECT * FROM public.categories WHERE household_id = public.get_user_household_id();

-- Verificar membros
SELECT * FROM public.get_members_visible();
```

## Soluções Possíveis

### Se `householdId` não estiver sendo atualizado:

1. Verificar se `refreshMember()` é chamado após criar família
2. Verificar se `get_members_visible()` retorna dados corretos
3. Adicionar log no `AuthContext` para debug

### Se RLS estiver bloqueando:

1. Verificar se `get_user_household_id()` retorna valor não-nulo
2. Verificar se `member_identities` tem registro correto
3. Verificar se as políticas RLS estão ativas

### Se categorias não aparecerem:

1. Verificar se seed foi executado corretamente
2. Verificar se `householdId` está correto na query
3. Verificar console do navegador para erros específicos
