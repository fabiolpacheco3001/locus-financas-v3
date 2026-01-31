# AUDITORIA DE LÓGICA: STATUS DE TRANSAÇÃO (PAGO vs PENDENTE)

**Data:** 31 de Janeiro de 2026  
**Problema Reportado:** Usuários relatam que, mesmo marcando uma despesa como "Pendente" no formulário, ela está sendo salva como "Confirmada/Paga" no banco de dados.

---

## RESUMO EXECUTIVO

**Status:** ⚠️ **PROBLEMA CRÍTICO IDENTIFICADO**

A lógica atual de determinação de status está **sobrepondo a escolha manual do usuário** em múltiplos pontos:

1. **Linha 249 de `useTransactionForm.ts`**: Força `status = 'confirmed'` quando `payment_method === 'credit_card'`, ignorando completamente o toggle "Pendente"
2. **Linha 250 de `useTransactionForm.ts`**: A verificação de `validatedData.status === 'planned'` só ocorre se não for cartão de crédito
3. **Linhas 208-227 de `TransactionFormDialog.tsx`**: `useEffect` automático muda o status baseado em data/payment_method, potencialmente sobrescrevendo escolha manual

**Impacto:** Usuários não conseguem marcar despesas no cartão de crédito como "Pendente", mesmo quando desejam fazer isso manualmente.

---

## ANÁLISE DETALHADA

### Arquivo: `src/components/transactions/TransactionForm/useTransactionForm.ts`

#### Função: `buildFormData()` (Linhas 236-275)

**Código Problemático:**

```typescript
// Linha 247-251
let status: TransactionStatus = 'confirmed';
if (validatedData.kind === 'EXPENSE') {
    if (validatedData.payment_method === 'credit_card') status = 'confirmed';  // ❌ PROBLEMA 1
    else if (validatedData.date > format(new Date(), 'yyyy-MM-dd') || validatedData.status === 'planned') status = 'planned';  // ⚠️ PROBLEMA 2
}
```

**Problemas Identificados:**

1. **Linha 249 - Força 'confirmed' para cartão de crédito:**
   ```typescript
   if (validatedData.payment_method === 'credit_card') status = 'confirmed';
   ```
   - **Impacto:** Ignora completamente o valor de `validatedData.status` quando o pagamento é por cartão de crédito
   - **Cenário:** Usuário marca toggle como "Pendente" → Salva como "Confirmada"
   - **Motivo original (presumido):** Cartões de crédito são sempre confirmados porque a fatura já foi gerada
   - **Problema:** Usuário pode querer marcar como pendente para controle futuro

2. **Linha 250 - Lógica condicional complexa:**
   ```typescript
   else if (validatedData.date > format(new Date(), 'yyyy-MM-dd') || validatedData.status === 'planned') status = 'planned';
   ```
   - **Impacto:** Só verifica `validatedData.status === 'planned'` se NÃO for cartão de crédito
   - **Problema:** Se for cartão de crédito, nunca chega nesta linha, então a escolha manual é ignorada

3. **Linha 247 - Default 'confirmed':**
   ```typescript
   let status: TransactionStatus = 'confirmed';
   ```
   - **Impacto:** Se nenhuma condição for atendida, assume 'confirmed' por padrão
   - **Problema:** Não há fallback para respeitar a escolha do usuário

---

### Arquivo: `src/components/transactions/TransactionForm/TransactionFormDialog.tsx`

#### useEffect Auto-Status (Linhas 208-227)

**Código Problemático:**

```typescript
// FIX: Auto-status based on date selection
useEffect(() => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isFutureDate = formDate > todayStr;
  
  if (formKind === 'INCOME') {
    setFormIsPlanned(false);
    return;
  }
  
  if (formKind === 'EXPENSE' && formPaymentMethod === 'credit_card') {
    setFormIsPlanned(false);  // ❌ PROBLEMA 3
    return;
  }
  
  if (isFutureDate) {
    setFormIsPlanned(true);
  } else {
    setFormIsPlanned(false);
  }
}, [formDate, formPaymentMethod, formKind, setFormIsPlanned]);
```

**Problemas Identificados:**

1. **Linha 217-219 - Força 'confirmed' para cartão de crédito:**
   ```typescript
   if (formKind === 'EXPENSE' && formPaymentMethod === 'credit_card') {
     setFormIsPlanned(false);  // Força confirmed
     return;
   }
   ```
   - **Impacto:** Quando o usuário seleciona "Cartão de Crédito", o toggle é automaticamente mudado para "Confirmada"
   - **Problema:** Não há como o usuário manter como "Pendente" se mudar o payment_method para credit_card depois

2. **Linha 222-226 - Auto-mudança baseada em data:**
   ```typescript
   if (isFutureDate) {
     setFormIsPlanned(true);
   } else {
     setFormIsPlanned(false);
   }
   ```
   - **Impacto:** Muda o status automaticamente quando a data muda
   - **Problema:** Pode sobrescrever escolha manual do usuário se ele mudar a data depois de marcar como "Pendente"

---

## MAPEAMENTO DO FLUXO ATUAL

### Cenário 1: Usuário marca como "Pendente" + Cartão de Crédito

```
1. Usuário abre formulário
2. Usuário marca toggle "Pendente" → formIsPlanned = true → form.status = 'planned'
3. Usuário seleciona payment_method = 'credit_card'
   → useEffect (linha 217) detecta credit_card
   → setFormIsPlanned(false) → form.status = 'confirmed'  ❌ ESCOLHA IGNORADA
4. Usuário salva
   → buildFormData() linha 249 detecta credit_card
   → status = 'confirmed' (ignora form.status)  ❌ ESCOLHA IGNORADA NOVAMENTE
5. Resultado: Transação salva como 'confirmed' mesmo usuário querendo 'planned'
```

### Cenário 2: Usuário marca como "Pendente" + Data Futura + Débito

```
1. Usuário marca toggle "Pendente" → formIsPlanned = true → form.status = 'planned'
2. Usuário seleciona data futura
   → useEffect (linha 222) detecta isFutureDate
   → setFormIsPlanned(true) → form.status = 'planned'  ✅ OK (mantém)
3. Usuário salva
   → buildFormData() linha 250 verifica: date > hoje OU status === 'planned'
   → status = 'planned'  ✅ OK
4. Resultado: Transação salva como 'planned' corretamente
```

### Cenário 3: Usuário marca como "Pendente" + Data Passada + Débito

```
1. Usuário marca toggle "Pendente" → formIsPlanned = true → form.status = 'planned'
2. Usuário seleciona data passada
   → useEffect (linha 225) detecta !isFutureDate
   → setFormIsPlanned(false) → form.status = 'confirmed'  ❌ ESCOLHA SOBRESCRITA
3. Usuário salva
   → buildFormData() linha 250 verifica: date > hoje? NÃO
   → Mas verifica: status === 'planned'? SIM (se ainda estiver no form)
   → status = 'planned'  ⚠️ DEPENDE DO ESTADO DO FORM
4. Resultado: Inconsistente - depende se useEffect executou antes do save
```

---

## PROPOSTA DE SOLUÇÃO

### Princípio: **Formulário como Fonte Única de Verdade**

O campo `status` do formulário deve ser **soberano**. Regras automáticas devem ser apenas **sugestões iniciais**, não imposições.

### Mudanças Necessárias

#### 1. Simplificar `buildFormData()` em `useTransactionForm.ts`

**ANTES (Linhas 247-251):**
```typescript
let status: TransactionStatus = 'confirmed';
if (validatedData.kind === 'EXPENSE') {
    if (validatedData.payment_method === 'credit_card') status = 'confirmed';
    else if (validatedData.date > format(new Date(), 'yyyy-MM-dd') || validatedData.status === 'planned') status = 'planned';
}
```

**DEPOIS (Proposta):**
```typescript
// Respeitar escolha do usuário primeiro
let status: TransactionStatus = validatedData.status || 'confirmed';

// Aplicar regras automáticas APENAS se status não foi definido explicitamente
if (!validatedData.status) {
  if (validatedData.kind === 'EXPENSE') {
    // Regra automática: cartão de crédito geralmente é confirmado
    if (validatedData.payment_method === 'credit_card') {
      status = 'confirmed';
    }
    // Regra automática: data futura geralmente é planejada
    else if (validatedData.date > format(new Date(), 'yyyy-MM-dd')) {
      status = 'planned';
    }
  }
  // Receitas sempre confirmadas por padrão (se não especificado)
  else if (validatedData.kind === 'INCOME') {
    status = 'confirmed';
  }
}
```

**Benefícios:**
- ✅ Se usuário definiu `status` explicitamente, respeita
- ✅ Se não definiu, aplica regras automáticas como fallback
- ✅ Remove lógica condicional complexa

#### 2. Modificar `useEffect` em `TransactionFormDialog.tsx`

**ANTES (Linhas 208-227):**
```typescript
useEffect(() => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isFutureDate = formDate > todayStr;
  
  if (formKind === 'INCOME') {
    setFormIsPlanned(false);
    return;
  }
  
  if (formKind === 'EXPENSE' && formPaymentMethod === 'credit_card') {
    setFormIsPlanned(false);
    return;
  }
  
  if (isFutureDate) {
    setFormIsPlanned(true);
  } else {
    setFormIsPlanned(false);
  }
}, [formDate, formPaymentMethod, formKind, setFormIsPlanned]);
```

**DEPOIS (Proposta):**
```typescript
// Auto-sugestão de status baseada em contexto (não força, apenas sugere)
useEffect(() => {
  // Não alterar se usuário já interagiu manualmente com o toggle
  // (podemos adicionar um flag para rastrear interação manual)
  
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isFutureDate = formDate > todayStr;
  const currentStatus = form.getValues('status');
  
  // Se status já foi definido explicitamente, não mudar automaticamente
  // (assumindo que se o usuário mudou manualmente, quer manter)
  
  // Apenas aplicar sugestões quando o formulário é aberto pela primeira vez
  // ou quando campos relacionados mudam E status não foi tocado manualmente
  
  if (formKind === 'INCOME') {
    // Receitas sempre confirmadas (regra de negócio)
    if (currentStatus !== 'planned') { // Só muda se não foi marcado como planned manualmente
      setFormIsPlanned(false);
    }
    return;
  }
  
  // Para despesas, sugerir baseado em contexto, mas não forçar
  if (formKind === 'EXPENSE') {
    // Se é cartão de crédito, sugerir confirmed (mas não forçar se usuário marcou planned)
    if (formPaymentMethod === 'credit_card' && currentStatus !== 'planned') {
      setFormIsPlanned(false);
      return;
    }
    
    // Se data é futura, sugerir planned (mas não forçar se usuário marcou confirmed)
    if (isFutureDate && currentStatus !== 'confirmed') {
      setFormIsPlanned(true);
    } else if (!isFutureDate && currentStatus !== 'planned') {
      setFormIsPlanned(false);
    }
  }
}, [formDate, formPaymentMethod, formKind, setFormIsPlanned, form]);
```

**Alternativa Mais Simples (Recomendada):**

Remover completamente o `useEffect` automático e deixar apenas sugestões visuais (tooltips, badges) informando ao usuário sobre regras de negócio, mas sempre respeitando a escolha manual.

---

## LINHAS EXATAS ONDE A VONTADE DO USUÁRIO É IGNORADA

### Arquivo: `src/components/transactions/TransactionForm/useTransactionForm.ts`

| Linha | Código | Problema |
|-------|--------|----------|
| **247** | `let status: TransactionStatus = 'confirmed';` | Default assume 'confirmed' sem verificar escolha do usuário |
| **249** | `if (validatedData.payment_method === 'credit_card') status = 'confirmed';` | **CRÍTICO:** Força 'confirmed' ignorando `validatedData.status` |
| **250** | `else if (validatedData.date > format(new Date(), 'yyyy-MM-dd') \|\| validatedData.status === 'planned')` | Verificação de `status === 'planned'` só ocorre se não for credit_card |

### Arquivo: `src/components/transactions/TransactionForm/TransactionFormDialog.tsx`

| Linha | Código | Problema |
|-------|--------|----------|
| **217-219** | `if (formKind === 'EXPENSE' && formPaymentMethod === 'credit_card') { setFormIsPlanned(false); return; }` | **CRÍTICO:** Força toggle para 'confirmed' quando seleciona credit_card |
| **222-226** | `if (isFutureDate) { setFormIsPlanned(true); } else { setFormIsPlanned(false); }` | Muda status automaticamente baseado em data, pode sobrescrever escolha manual |

---

## RECOMENDAÇÃO FINAL

### Solução Simplificada (Prioridade Alta)

**1. Modificar `buildFormData()` para respeitar escolha do usuário:**

```typescript
// Linha 247-251 - SUBSTITUIR POR:
let status: TransactionStatus = validatedData.status || 'confirmed';

// Aplicar regras automáticas APENAS se status não foi definido
if (!validatedData.status && validatedData.kind === 'EXPENSE') {
  if (validatedData.payment_method === 'credit_card') {
    status = 'confirmed'; // Sugestão automática
  } else if (validatedData.date > format(new Date(), 'yyyy-MM-dd')) {
    status = 'planned'; // Sugestão automática
  }
}
```

**2. Remover ou tornar opcional o `useEffect` automático:**

- **Opção A:** Remover completamente o `useEffect` (linhas 208-227)
- **Opção B:** Adicionar flag para rastrear interação manual e só aplicar auto-sugestões quando flag não estiver setado

**3. Adicionar feedback visual:**

- Mostrar tooltip/badge informando: "Cartões de crédito geralmente são confirmados, mas você pode marcar como pendente se necessário"
- Mostrar tooltip quando data futura: "Datas futuras geralmente são planejadas"

---

## TESTES NECESSÁRIOS APÓS CORREÇÃO

1. ✅ Usuário marca "Pendente" + Cartão de Crédito → Deve salvar como 'planned'
2. ✅ Usuário marca "Confirmada" + Data Futura → Deve salvar como 'confirmed'
3. ✅ Usuário não marca nada + Cartão de Crédito → Deve salvar como 'confirmed' (sugestão automática)
4. ✅ Usuário não marca nada + Data Futura → Deve salvar como 'planned' (sugestão automática)
5. ✅ Usuário marca "Pendente" + Muda para Cartão de Crédito → Deve manter 'planned'
6. ✅ Usuário marca "Confirmada" + Muda data para futura → Deve manter 'confirmed'

---

**Fim do Relatório**
