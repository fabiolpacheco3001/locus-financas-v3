# Release Notes: i18n Zero Keys Visíveis

**Versão:** 1.0.0  
**Data:** Janeiro 2026  
**Tipo:** Correção de Bug / Qualidade

---

## 📋 Resumo

Correção completa de regressões de internacionalização (i18n) onde chaves de tradução estavam aparecendo na UI em vez de texto traduzido.

---

## 🐛 O que foi corrigido

### 1. Notificações (Empty State e Dropdown)
- ✅ Adicionadas chaves faltantes no `pt-BR.json`:
  - `notifications.noNotifications` → "Nenhuma notificação"
  - `notifications.silenceIsGood` → "Silêncio é bom sinal!"
  - `notifications.viewAll` → "Ver todas as notificações"
  - `notifications.urgentActions` → "Há ações financeiras urgentes"
  - `notifications.attentionAlerts` → "Há alertas que merecem atenção"
  - `notifications.informativeUpdates` → "Atualizações informativas"
  - `notifications.info` → "Info"
  - `notifications.urgent` → "urgente"

### 2. Modal "Nova Transação"
- ✅ Chaves de validação de formulário já existentes e funcionando:
  - `transactions.form.selectCategory`
  - `transactions.form.selectSubcategory`
  - `transactions.form.selectCategoryFirst`
  - `transactions.form.enterAmount`
  - `transactions.form.enterDate`
  - `transactions.form.enterDueDate`
  - `transactions.form.descriptionPlaceholder`

### 3. Modal "Novo Orçamento Recorrente"
- ✅ Chaves de validação e labels já existentes:
  - `budget.recurring.monthlyAmount`
  - `budget.recurring.enterMonthlyAmount`
  - `budget.recurring.enterStartMonth`
  - `budget.recurring.autoGenerateNote`
  - `budget.recurring.create`
  - `budget.recurring.entireCategory`
  - `budget.recurring.createForSubcategory` (ADICIONADA)
  - `budget.recurring.activeTitle` (MOVIDA para dentro de recurring)

### 4. Paridade de Estrutura entre Locales
- ✅ Adicionada estrutura `notifications.messages.*` ao `pt-BR.json` (paridade com en/es)
- ✅ Adicionada estrutura aninhada `notifications.payment_delayed.*`, `month_at_risk.*`, etc. ao `en.json` (paridade com pt-BR/es)
- ✅ Sincronizadas todas as chaves entre `pt-BR.json`, `en.json` e `es.json`

---

## ✅ Checklist de Publicação "Zero Keys Visíveis"

### Verificações Automatizadas

Execute os seguintes comandos na raiz do projeto:

```bash
# 1. Auditoria de chaves i18n (detecta chaves faltantes/órfãs)
npx tsx scripts/i18n-audit.ts

# 2. Verificação de strings hardcoded
npx tsx scripts/check-hardcoded-strings.ts

# 3. Verificação pré-publicação completa
npx tsx scripts/pre-publish-check.ts

# 4. Testes E2E de anti-regressão i18n
npx playwright test tests/e2e/i18nAntiRegression.spec.ts

# 5. Testes E2E de formulários i18n
npx playwright test tests/e2e/formsI18nRegression.spec.ts
```

### Critérios de Bloqueio

❌ **BLOQUEAR RELEASE** se qualquer das seguintes condições ocorrer:

1. `i18n-audit.ts` reportar chaves faltantes ou inconsistentes
2. `pre-publish-check.ts` falhar em qualquer verificação
3. Testes E2E de i18n falharem
4. Validação manual encontrar keys visíveis

---

## 🔍 Validação Manual (3 Fluxos Obrigatórios)

### Fluxo A: Notificações Empty State

**Passos:**
1. Fazer login no app
2. Navegar para `/notifications`
3. Se não houver notificações, verificar o empty state

**Validar em cada idioma (PT-BR, EN, ES):**
- [ ] Título do empty state está traduzido (não mostra `notifications.empty.title`)
- [ ] Descrição está traduzida (não mostra `notifications.empty.openDescription`)
- [ ] Clicar no sino (bell icon) no header
- [ ] Verificar que dropdown mostra texto traduzido (não `notifications.noNotifications`)
- [ ] Verificar que mostra "Silêncio é bom sinal!" / "Silence is a good sign!" / "¡El silencio es buena señal!"

### Fluxo B: Nova Transação com Erros

**Passos:**
1. Navegar para `/transactions`
2. Clicar em "Nova Transação" / "New Transaction" / "Nueva Transacción"
3. Selecionar tipo "Despesa" / "Expense" / "Gasto"
4. Tentar salvar SEM preencher campos obrigatórios

**Validar em cada idioma (PT-BR, EN, ES):**
- [ ] Label "Categoria" está traduzido
- [ ] Mensagem de erro "Selecione uma categoria" está traduzida (não mostra `transactions.form.selectCategory`)
- [ ] Placeholder do campo descrição está traduzido
- [ ] Todos os botões (Salvar/Cancelar) estão traduzidos
- [ ] Nenhum texto contém padrão `namespace.key`

### Fluxo C: Novo Orçamento Recorrente com Erros

**Passos:**
1. Navegar para `/budget`
2. Clicar em "Novo Orçamento Recorrente" / "New Recurring Budget" / "Nuevo Presupuesto Recurrente"
3. Tentar criar SEM preencher campos obrigatórios

**Validar em cada idioma (PT-BR, EN, ES):**
- [ ] Título do modal está traduzido
- [ ] Label "Valor mensal" está traduzido (não mostra `budget.recurring.monthlyAmount`)
- [ ] Mensagem de validação está traduzida
- [ ] Nota de auto-geração está traduzida (não mostra `budget.recurring.autoGenerateNote`)
- [ ] Botão "Criar" está traduzido (não mostra `budget.recurring.create`)
- [ ] Botão "Cancelar" está traduzido

---

## 🧪 Testes Automatizados Adicionados

### E2E Tests

| Arquivo | Cobertura |
|---------|-----------|
| `tests/e2e/i18nAntiRegression.spec.ts` | Todas as páginas, modais, viewports desktop/mobile |
| `tests/e2e/formsI18nRegression.spec.ts` | Formulários de transação, orçamento, conta, categoria |

### Unit Tests

| Arquivo | Cobertura |
|---------|-----------|
| `tests/unit/i18nFallback.spec.ts` | Fallback seguro, logging, detecção de keys literais |

### Scripts de Verificação

| Script | Função |
|--------|--------|
| `scripts/i18n-audit.ts` | Detecta chaves faltantes, órfãs e inconsistentes |
| `scripts/check-hardcoded-strings.ts` | Detecta strings hardcoded em componentes |
| `scripts/pre-publish-check.ts` | Verificação completa pré-publicação |

---

## 📱 Viewports Testados

- **Desktop:** 1280x720
- **Mobile:** 390x844 (iPhone 14 Pro)

---

## 🔐 Regex de Detecção

Padrão usado para detectar keys não traduzidas:

```regex
/[a-zA-Z]+\.[a-zA-Z0-9_.-]+/
```

Também detectamos:
- `undefined`
- `null`
- `missingKey`
- `missing_key`

---

## 📝 Como Trocar de Idioma

1. Abrir o seletor de idioma (geralmente no header ou settings)
2. Selecionar: **Português (BR)**, **English**, ou **Español**
3. O app deve recarregar automaticamente com o novo idioma

---

## 🚀 Aprovação para Release

- [ ] Todos os testes automatizados passando
- [ ] Validação manual dos 3 fluxos concluída
- [ ] Nenhuma key visível em PT-BR, EN, ES
- [ ] Build sem erros

**Aprovado por:** _________________  
**Data:** _________________

---

## 📞 Suporte

Em caso de regressão de i18n após release:
1. Executar `npx tsx scripts/i18n-audit.ts` para identificar chaves faltantes
2. Adicionar chaves em todos os 3 arquivos de locale
3. Executar testes E2E para validar correção
