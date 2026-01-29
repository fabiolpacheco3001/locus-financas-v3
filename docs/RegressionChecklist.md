# Checklist de Regressão Manual (10 minutos)

Este checklist cobre os cenários críticos que devem ser verificados antes de cada release.

## ⏱️ Tempo estimado: 10 minutos

---

## 📊 1. Cálculos Financeiros (2 min)

### 1.1 Receitas e Despesas
- [ ] Criar uma receita confirmada de R$ 1.000
- [ ] Verificar que "Receitas confirmadas" aumentou R$ 1.000
- [ ] Criar uma despesa confirmada de R$ 300
- [ ] Verificar que "Despesas confirmadas" aumentou R$ 300
- [ ] Verificar que o saldo do mês = R$ 700

### 1.2 A Pagar
- [ ] Criar uma despesa planejada de R$ 200
- [ ] Verificar que "A pagar" mostra R$ 200
- [ ] Verificar que "Saldo previsto" = R$ 500 (1000 - 300 - 200)

---

## 🔔 2. Notificações (2 min)

### 2.1 Prioridade
- [ ] Criar despesa vencida (data passada, status=planned)
- [ ] Verificar notificação "Conta vencida" aparece
- [ ] Verificar que notificações de menor prioridade estão ocultas

### 2.2 Idempotência
- [ ] Recarregar página (F5)
- [ ] Verificar que a mesma notificação não foi duplicada
- [ ] Navegar para outro mês e voltar
- [ ] Verificar que não criou notificação duplicada

---

## 🚨 3. Insights (Toasts) (2 min)

### 3.1 Risco de Fechar no Vermelho
- [ ] Criar despesas até o saldo previsto ficar negativo
- [ ] Verificar toast "Risco de fechar no vermelho" apareceu
- [ ] Recarregar página (F5)
- [ ] Verificar que o toast NÃO apareceu novamente (mesmo estado)

### 3.2 Mês Recuperado
- [ ] Confirmar uma receita para o saldo voltar a positivo
- [ ] Verificar toast "Mês recuperado" apareceu
- [ ] Recarregar página (F5)
- [ ] Verificar que o toast NÃO apareceu novamente (mesmo estado)

### 3.3 Transição Múltipla
- [ ] Fazer saldo ficar negativo novamente
- [ ] Verificar toast "Risco" apareceu (nova transição)
- [ ] Fazer saldo ficar positivo
- [ ] Verificar toast "Recuperado" apareceu (nova transição)

---

## 💳 4. Transações (2 min)

### 4.1 Cancelamento (Soft Delete)
- [ ] Cancelar uma transação
- [ ] Verificar que ela não aparece na listagem padrão
- [ ] Ativar toggle "Mostrar canceladas"
- [ ] Verificar que a transação cancelada aparece com destaque visual
- [ ] Verificar que ela tem status "Cancelada" e timestamp

### 4.2 Filtros via Notificação
- [ ] Clicar em "Ver transações" de uma notificação de vencidas
- [ ] Verificar que lista mostra apenas transações vencidas
- [ ] Voltar e clicar em "Ver transações" de outra notificação
- [ ] Verificar que o filtro correto foi aplicado

---

## 🧭 5. Navegação (2 min)

### 5.1 Troca de Mês
- [ ] Navegar para mês anterior
- [ ] Verificar contagem de notificações não aumentou
- [ ] Navegar para mês seguinte
- [ ] Voltar ao mês original
- [ ] Verificar que não há notificações duplicadas

### 5.2 Logout/Login
- [ ] Fazer logout
- [ ] Fazer login novamente
- [ ] Verificar que insights não reapareceram (se estado não mudou)
- [ ] Verificar que notificações existentes estão preservadas

---

## ✅ Resultado

- [ ] Todos os itens passaram
- [ ] Nenhuma regressão identificada

**Testado por:** _______________  
**Data:** _______________  
**Versão/Branch:** _______________

---

## 📝 Notas

Se algum item falhar, documente aqui:

```
Item: 
Comportamento esperado:
Comportamento observado:
Screenshot/Logs:
```
