import { describe, it, expect } from 'vitest';
import { parseBrazilianCurrency, formatCurrency, isValidAmount } from '@/lib/utils/money';

describe('parseBrazilianCurrency', () => {
  it('deve converter padrão brasileiro com milhar e vírgula', () => {
    expect(parseBrazilianCurrency("1.250,50")).toBe(1250.50);
  });

  it('deve converter valores abaixo de mil corretamente', () => {
    expect(parseBrazilianCurrency("999,99")).toBe(999.99);
  });

  it('deve lidar com strings puras sem formatação', () => {
    expect(parseBrazilianCurrency("1000")).toBe(1000);
  });

  it('deve retornar 0 para valores inválidos ou vazios', () => {
    expect(parseBrazilianCurrency("abc")).toBe(0);
    expect(parseBrazilianCurrency("")).toBe(0);
  });

  it('deve converter números diretamente', () => {
    expect(parseBrazilianCurrency(1234.56)).toBe(1234.56);
    expect(parseBrazilianCurrency(1000)).toBe(1000);
  });

  it('deve retornar 0 para null ou undefined', () => {
    expect(parseBrazilianCurrency(null)).toBe(0);
    expect(parseBrazilianCurrency(undefined)).toBe(0);
  });

  it('deve prevenir bug de milhar (1.000,00 não deve virar 1)', () => {
    expect(parseBrazilianCurrency("1.000,00")).toBe(1000.00);
    expect(parseBrazilianCurrency("10.000,00")).toBe(10000.00);
    expect(parseBrazilianCurrency("100.000,50")).toBe(100000.50);
  });

  it('deve remover espaços e símbolos de moeda', () => {
    expect(parseBrazilianCurrency("R$ 1.234,56")).toBe(1234.56);
    expect(parseBrazilianCurrency("1 234,56")).toBe(1234.56);
  });
});

describe('formatCurrency', () => {
  it('should format number to Brazilian currency', () => {
    expect(formatCurrency(1234.56)).toBe('1.234,56');
  });

  it('should format 1000 to "1.000,00"', () => {
    expect(formatCurrency(1000)).toBe('1.000,00');
  });

  it('should format 0 to "0,00"', () => {
    expect(formatCurrency(0)).toBe('0,00');
  });

  it('should handle NaN as "0,00"', () => {
    expect(formatCurrency(NaN)).toBe('0,00');
  });

  it('should handle null as "0,00"', () => {
    expect(formatCurrency(null as any)).toBe('0,00');
  });

  it('should handle undefined as "0,00"', () => {
    expect(formatCurrency(undefined as any)).toBe('0,00');
  });
});

describe('isValidAmount', () => {
  it('should return true for positive numbers', () => {
    expect(isValidAmount(1234.56)).toBe(true);
    expect(isValidAmount(1)).toBe(true);
    expect(isValidAmount(0.01)).toBe(true);
  });

  it('should return false for zero', () => {
    expect(isValidAmount(0)).toBe(false);
  });

  it('should return false for negative numbers', () => {
    expect(isValidAmount(-100)).toBe(false);
  });

  it('should return false for NaN', () => {
    expect(isValidAmount(NaN)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isValidAmount(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isValidAmount(undefined)).toBe(false);
  });
});
