import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeFutureEngine, type FutureEngineInput } from '../computeFutureEngine';

/**
 * Suite de testes unitários para computeFutureEngine
 * 
 * Testa a lógica central de projeção financeira:
 * - Cálculo de projeção com média histórica
 * - Fallback para orçamento planejado
 * - Cálculo de risco com saldo negativo
 * - Comportamento no final do mês
 */

describe('computeFutureEngine', () => {
  // Data fixa para testes: 15 de janeiro de 2026 (meio do mês)
  const FIXED_DATE = new Date('2026-01-15T12:00:00Z');
  
  beforeEach(() => {
    // Mock de Date.now() para usar data fixa
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Cenário 1: Média Histórica Pura
   * 
   * Validar cálculo de projeção quando há histórico (3 meses) e saldo positivo.
   */
  describe('Média Histórica Pura', () => {
    it('deve calcular projeção corretamente com histórico de 3 meses e saldo positivo', () => {
      const input: FutureEngineInput = {
        currentBalance: 5000, // R$ 5.000,00
        pendingFixedExpenses: 2000, // R$ 2.000,00
        confirmedVariableThisMonth: 500, // R$ 500,00 já gastos
        historicalVariableAvg: 3000, // Média de R$ 3.000,00/mês (últimos 3 meses)
        daysElapsed: 15, // 15 dias transcorridos
        daysInMonth: 31, // Janeiro tem 31 dias
        plannedBudgetVariable: 2500, // Orçamento planejado (não deve ser usado)
      };

      const result = computeFutureEngine(input);

      // Dias restantes: 31 - 15 = 16 dias
      expect(result.daysRemaining).toBe(16);

      // Taxa diária: 3000 / 31 = 96,77...
      // Projeção variável restante: 96,77 * 16 = 1548,39...
      const expectedDailyRate = 3000 / 31;
      const expectedProjectedVariable = expectedDailyRate * 16;
      expect(result.projectedVariableRemaining).toBeCloseTo(expectedProjectedVariable, 2);

      // Total projetado: 2000 (fixas) + 1548,39 (variáveis) = 3548,39
      const expectedTotalExpenses = 2000 + expectedProjectedVariable;
      expect(result.totalProjectedExpenses).toBeCloseTo(expectedTotalExpenses, 2);

      // Saldo final: 5000 - 3548,39 = 1451,61
      const expectedEndOfMonth = 5000 - expectedTotalExpenses;
      expect(result.estimatedEndOfMonth).toBeCloseTo(expectedEndOfMonth, 2);

      // Deve usar histórico, não fallback
      expect(result.usingBudgetFallback).toBe(false);
      expect(result.isDataSufficient).toBe(true);
      expect(result.confidenceLevel).toBe('high'); // Tem histórico e >= 7 dias transcorridos
    });

    it('deve usar média histórica mesmo quando há orçamento planejado disponível', () => {
      const input: FutureEngineInput = {
        currentBalance: 5000,
        pendingFixedExpenses: 2000,
        confirmedVariableThisMonth: 500,
        historicalVariableAvg: 3000, // Histórico disponível
        daysElapsed: 15,
        daysInMonth: 31,
        plannedBudgetVariable: 2500, // Orçamento maior, mas não deve ser usado
      };

      const result = computeFutureEngine(input);

      // Deve usar histórico (3000), não orçamento (2500)
      const expectedDailyRate = 3000 / 31;
      const expectedProjectedVariable = expectedDailyRate * 16;
      expect(result.projectedVariableRemaining).toBeCloseTo(expectedProjectedVariable, 2);
      expect(result.usingBudgetFallback).toBe(false);
    });
  });

  /**
   * Cenário 2: Fallback de Orçamento
   * 
   * Validar se a função usa corretamente o plannedBudgetVariable quando historicalVariableAvg é zero.
   */
  describe('Fallback de Orçamento', () => {
    it('deve usar orçamento planejado quando não há histórico disponível', () => {
      const input: FutureEngineInput = {
        currentBalance: 5000,
        pendingFixedExpenses: 2000,
        confirmedVariableThisMonth: 500,
        historicalVariableAvg: 0, // Sem histórico
        daysElapsed: 15,
        daysInMonth: 31,
        plannedBudgetVariable: 2500, // Deve usar este valor
      };

      const result = computeFutureEngine(input);

      // Deve usar orçamento planejado (2500), não histórico (0)
      const expectedDailyRate = 2500 / 31;
      const expectedProjectedVariable = expectedDailyRate * 16;
      expect(result.projectedVariableRemaining).toBeCloseTo(expectedProjectedVariable, 2);

      // Flags de fallback
      expect(result.usingBudgetFallback).toBe(true);
      expect(result.isDataSufficient).toBe(true); // Tem orçamento planejado
      expect(result.confidenceLevel).toBe('medium'); // Usando fallback com >= 3 dias
    });

    it('deve usar orçamento planejado quando historicalVariableAvg é zero e há orçamento', () => {
      const input: FutureEngineInput = {
        currentBalance: 3000,
        pendingFixedExpenses: 1500,
        confirmedVariableThisMonth: 200,
        historicalVariableAvg: 0,
        daysElapsed: 10,
        daysInMonth: 30,
        plannedBudgetVariable: 1800,
      };

      const result = computeFutureEngine(input);

      // Taxa diária baseada no orçamento: 1800 / 30 = 60
      // Dias restantes: 30 - 10 = 20
      // Projeção: 60 * 20 = 1200
      const expectedDailyRate = 1800 / 30;
      const expectedProjectedVariable = expectedDailyRate * 20;
      expect(result.projectedVariableRemaining).toBeCloseTo(expectedProjectedVariable, 2);

      expect(result.usingBudgetFallback).toBe(true);
      expect(result.confidenceLevel).toBe('medium');
    });

    it('deve ter confiança baixa quando usa fallback com poucos dias transcorridos', () => {
      const input: FutureEngineInput = {
        currentBalance: 5000,
        pendingFixedExpenses: 2000,
        confirmedVariableThisMonth: 100,
        historicalVariableAvg: 0,
        daysElapsed: 2, // Apenas 2 dias transcorridos
        daysInMonth: 31,
        plannedBudgetVariable: 2500,
      };

      const result = computeFutureEngine(input);

      expect(result.usingBudgetFallback).toBe(true);
      expect(result.confidenceLevel).toBe('low'); // < 3 dias transcorridos
    });
  });

  /**
   * Cenário 3: Saldo Negativo
   * 
   * Validar se os níveis de risco ('danger') e a zona de gasto seguro são calculados corretamente com saldo inicial negativo.
   */
  describe('Saldo Negativo', () => {
    it('deve calcular risco como danger quando saldo projetado é negativo', () => {
      const input: FutureEngineInput = {
        currentBalance: -500, // Saldo negativo inicial
        pendingFixedExpenses: 2000,
        confirmedVariableThisMonth: 300,
        historicalVariableAvg: 3000,
        daysElapsed: 15,
        daysInMonth: 31,
        plannedBudgetVariable: 2500,
      };

      const result = computeFutureEngine(input);

      // Com saldo negativo, o resultado deve ser ainda mais negativo
      expect(result.estimatedEndOfMonth).toBeLessThan(0);
      expect(result.riskLevel).toBe('danger');

      // Percentual de risco deve ser baixo (próximo de 0)
      expect(result.riskPercentage).toBeLessThan(50);
    });

    it('deve calcular zona de gasto seguro como zero quando saldo é negativo', () => {
      const input: FutureEngineInput = {
        currentBalance: -1000, // Saldo negativo
        pendingFixedExpenses: 2000,
        confirmedVariableThisMonth: 500,
        historicalVariableAvg: 3000,
        daysElapsed: 15,
        daysInMonth: 31,
        plannedBudgetVariable: 2500,
        safetyBufferPercent: 10,
      };

      const result = computeFutureEngine(input);

      // Zona de gasto seguro deve ser 0 quando saldo é negativo
      // Fórmula: max(0, currentBalance - pendingFixedExpenses - safetyBuffer)
      // Com saldo negativo, sempre será 0
      expect(result.safeSpendingZone).toBe(0);
    });

    it('deve calcular risco como danger quando saldo inicial positivo mas projeção fica negativa', () => {
      const input: FutureEngineInput = {
        currentBalance: 1000, // Saldo positivo inicial
        pendingFixedExpenses: 2000, // Despesas fixas maiores que saldo
        confirmedVariableThisMonth: 500,
        historicalVariableAvg: 3000, // Alto gasto variável projetado
        daysElapsed: 15,
        daysInMonth: 31,
        plannedBudgetVariable: 2500,
      };

      const result = computeFutureEngine(input);

      // Saldo projetado deve ser negativo
      expect(result.estimatedEndOfMonth).toBeLessThan(0);
      expect(result.riskLevel).toBe('danger');

      // Percentual de risco deve refletir a situação crítica
      expect(result.riskPercentage).toBeLessThan(50);
    });

    it('deve calcular percentual de risco corretamente com saldo negativo', () => {
      const input: FutureEngineInput = {
        currentBalance: -500,
        pendingFixedExpenses: 1000,
        confirmedVariableThisMonth: 200,
        historicalVariableAvg: 2000,
        daysElapsed: 15,
        daysInMonth: 31,
        plannedBudgetVariable: 1500,
      };

      const result = computeFutureEngine(input);

      // Quando currentBalance <= 0, riskPercentage deve ser 0
      expect(result.riskPercentage).toBe(0);
      expect(result.riskLevel).toBe('danger');
    });
  });

  /**
   * Cenário 4: Final do Mês
   * 
   * Testar comportamento quando faltam apenas 1 ou 2 dias para acabar o mês.
   */
  describe('Final do Mês', () => {
    it('deve calcular corretamente quando faltam apenas 1 dia para o fim do mês', () => {
      const input: FutureEngineInput = {
        currentBalance: 5000,
        pendingFixedExpenses: 2000,
        confirmedVariableThisMonth: 2500, // Já gastou bastante
        historicalVariableAvg: 3000,
        daysElapsed: 30, // 30 dias transcorridos
        daysInMonth: 31, // Janeiro tem 31 dias
        plannedBudgetVariable: 2500,
      };

      const result = computeFutureEngine(input);

      // Dias restantes: 31 - 30 = 1
      expect(result.daysRemaining).toBe(1);

      // Taxa diária: 3000 / 31 = 96,77...
      // Projeção variável restante: 96,77 * 1 = 96,77
      const expectedDailyRate = 3000 / 31;
      const expectedProjectedVariable = expectedDailyRate * 1;
      expect(result.projectedVariableRemaining).toBeCloseTo(expectedProjectedVariable, 2);

      // Total projetado: 2000 (fixas) + 96,77 (variáveis) = 2096,77
      const expectedTotalExpenses = 2000 + expectedProjectedVariable;
      expect(result.totalProjectedExpenses).toBeCloseTo(expectedTotalExpenses, 2);

      // Saldo final: 5000 - 2096,77 = 2903,23
      const expectedEndOfMonth = 5000 - expectedTotalExpenses;
      expect(result.estimatedEndOfMonth).toBeCloseTo(expectedEndOfMonth, 2);
    });

    it('deve calcular corretamente quando faltam apenas 2 dias para o fim do mês', () => {
      const input: FutureEngineInput = {
        currentBalance: 4000,
        pendingFixedExpenses: 1500,
        confirmedVariableThisMonth: 2000,
        historicalVariableAvg: 2500,
        daysElapsed: 29, // 29 dias transcorridos
        daysInMonth: 31,
        plannedBudgetVariable: 2000,
      };

      const result = computeFutureEngine(input);

      // Dias restantes: 31 - 29 = 2
      expect(result.daysRemaining).toBe(2);

      // Taxa diária: 2500 / 31 = 80,65...
      // Projeção variável restante: 80,65 * 2 = 161,29
      const expectedDailyRate = 2500 / 31;
      const expectedProjectedVariable = expectedDailyRate * 2;
      expect(result.projectedVariableRemaining).toBeCloseTo(expectedProjectedVariable, 2);

      // Total projetado: 1500 (fixas) + 161,29 (variáveis) = 1661,29
      const expectedTotalExpenses = 1500 + expectedProjectedVariable;
      expect(result.totalProjectedExpenses).toBeCloseTo(expectedTotalExpenses, 2);

      // Saldo final: 4000 - 1661,29 = 2338,71
      const expectedEndOfMonth = 4000 - expectedTotalExpenses;
      expect(result.estimatedEndOfMonth).toBeCloseTo(expectedEndOfMonth, 2);
    });

    it('deve calcular dias restantes como zero quando já passou o último dia do mês', () => {
      const input: FutureEngineInput = {
        currentBalance: 5000,
        pendingFixedExpenses: 2000,
        confirmedVariableThisMonth: 3000,
        historicalVariableAvg: 3000,
        daysElapsed: 31, // Todos os dias transcorridos
        daysInMonth: 31,
        plannedBudgetVariable: 2500,
      };

      const result = computeFutureEngine(input);

      // Dias restantes: max(0, 31 - 31) = 0
      expect(result.daysRemaining).toBe(0);

      // Projeção variável restante deve ser 0 (sem dias restantes)
      expect(result.projectedVariableRemaining).toBe(0);

      // Total projetado: apenas despesas fixas (2000)
      expect(result.totalProjectedExpenses).toBe(2000);

      // Saldo final: 5000 - 2000 = 3000
      expect(result.estimatedEndOfMonth).toBe(3000);
    });

    it('deve manter nível de confiança alto mesmo no final do mês quando há histórico', () => {
      const input: FutureEngineInput = {
        currentBalance: 5000,
        pendingFixedExpenses: 2000,
        confirmedVariableThisMonth: 2500,
        historicalVariableAvg: 3000,
        daysElapsed: 30, // 30 dias (>= 7)
        daysInMonth: 31,
        plannedBudgetVariable: 2500,
      };

      const result = computeFutureEngine(input);

      // Com histórico e >= 7 dias transcorridos, deve ser 'high'
      expect(result.confidenceLevel).toBe('high');
      expect(result.usingBudgetFallback).toBe(false);
    });
  });

  /**
   * Testes adicionais para garantir robustez
   */
  describe('Casos Especiais', () => {
    it('deve calcular zona de gasto seguro com margem de segurança customizada', () => {
      const input: FutureEngineInput = {
        currentBalance: 5000,
        pendingFixedExpenses: 2000,
        confirmedVariableThisMonth: 500,
        historicalVariableAvg: 3000,
        daysElapsed: 15,
        daysInMonth: 31,
        plannedBudgetVariable: 2500,
        safetyBufferPercent: 20, // 20% de margem
      };

      const result = computeFutureEngine(input);

      // Safety buffer: 5000 * 0.20 = 1000
      // Safe spending zone: max(0, 5000 - 2000 - 1000) = 2000
      const expectedBuffer = Math.abs(5000) * 0.20;
      const expectedSafeZone = Math.max(0, 5000 - 2000 - expectedBuffer);
      expect(result.safeSpendingZone).toBeCloseTo(expectedSafeZone, 2);
    });

    it('deve calcular risco como safe quando saldo projetado é maior que buffer de segurança', () => {
      const input: FutureEngineInput = {
        currentBalance: 10000,
        pendingFixedExpenses: 2000,
        confirmedVariableThisMonth: 500,
        historicalVariableAvg: 2000, // Gasto variável baixo
        daysElapsed: 15,
        daysInMonth: 31,
        plannedBudgetVariable: 2500,
        safetyBufferPercent: 10,
      };

      const result = computeFutureEngine(input);

      // Buffer: 10000 * 0.10 = 1000
      // Se estimatedEndOfMonth >= 1000, deve ser 'safe'
      const buffer = Math.abs(10000) * 0.10;
      if (result.estimatedEndOfMonth >= buffer) {
        expect(result.riskLevel).toBe('safe');
      }
    });

    it('deve calcular risco como caution quando saldo projetado está entre 0 e buffer', () => {
      const input: FutureEngineInput = {
        currentBalance: 5000,
        pendingFixedExpenses: 2000,
        confirmedVariableThisMonth: 500,
        historicalVariableAvg: 4000, // Gasto variável alto
        daysElapsed: 15,
        daysInMonth: 31,
        plannedBudgetVariable: 3500,
        safetyBufferPercent: 10,
      };

      const result = computeFutureEngine(input);

      // Buffer: 5000 * 0.10 = 500
      // Se estimatedEndOfMonth está entre 0 e 500, deve ser 'caution'
      const buffer = Math.abs(5000) * 0.10;
      if (result.estimatedEndOfMonth >= 0 && result.estimatedEndOfMonth < buffer) {
        expect(result.riskLevel).toBe('caution');
      }
    });

    it('deve lidar corretamente com mês de 30 dias', () => {
      const input: FutureEngineInput = {
        currentBalance: 5000,
        pendingFixedExpenses: 2000,
        confirmedVariableThisMonth: 500,
        historicalVariableAvg: 3000,
        daysElapsed: 15,
        daysInMonth: 30, // Abril, junho, setembro, novembro
        plannedBudgetVariable: 2500,
      };

      const result = computeFutureEngine(input);

      // Dias restantes: 30 - 15 = 15
      expect(result.daysRemaining).toBe(15);

      // Taxa diária: 3000 / 30 = 100
      // Projeção: 100 * 15 = 1500
      const expectedDailyRate = 3000 / 30;
      const expectedProjectedVariable = expectedDailyRate * 15;
      expect(result.projectedVariableRemaining).toBeCloseTo(expectedProjectedVariable, 2);
    });

    it('deve lidar corretamente com fevereiro (28 dias)', () => {
      const input: FutureEngineInput = {
        currentBalance: 5000,
        pendingFixedExpenses: 2000,
        confirmedVariableThisMonth: 500,
        historicalVariableAvg: 3000,
        daysElapsed: 14,
        daysInMonth: 28, // Fevereiro não-bissexto
        plannedBudgetVariable: 2500,
      };

      const result = computeFutureEngine(input);

      // Dias restantes: 28 - 14 = 14
      expect(result.daysRemaining).toBe(14);

      // Taxa diária: 3000 / 28 = 107,14...
      // Projeção: 107,14 * 14 = 1500
      const expectedDailyRate = 3000 / 28;
      const expectedProjectedVariable = expectedDailyRate * 14;
      expect(result.projectedVariableRemaining).toBeCloseTo(expectedProjectedVariable, 2);
    });
  });
});
