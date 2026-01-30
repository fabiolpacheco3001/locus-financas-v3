/**
 * Money utility functions - Pure, testable functions for currency handling
 * 
 * These functions handle Brazilian currency format (R$ 1.234,56) and ensure
 * robust parsing without data loss or precision issues.
 */

/**
 * Transforma qualquer input de moeda (BR ou US) em um número puro para o banco.
 * Ex: "1.250,50" -> 1250.5
 * 
 * @param value - String com formatação ou número
 * @returns Número parseado, ou 0 se inválido
 * 
 * @example
 * parseBrazilianCurrency("1.234,56") // 1234.56
 * parseBrazilianCurrency("1,234.56") // 1234.56
 * parseBrazilianCurrency(1234.56) // 1234.56
 * parseBrazilianCurrency("") // 0
 * parseBrazilianCurrency(null) // 0
 */
export const parseBrazilianCurrency = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  // Remove TUDO que não for número, vírgula ou ponto antes de processar
  const cleanValue = value
    .replace(/[^\d.,-]/g, '')  // Remove tudo exceto dígitos, vírgula, ponto e hífen
    .replace(/\s/g, '')         // Remove espaços (redundante mas seguro)
    .replace(/\./g, '')         // Remove pontos de milhar
    .replace(',', '.');         // Troca vírgula decimal por ponto

  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * @deprecated Use parseBrazilianCurrency instead
 * Alias para manter compatibilidade com código existente
 */
export function parseToNumeric(value: string | number | null | undefined): number {
  return parseBrazilianCurrency(value);
}

/**
 * Formats a number to Brazilian currency format (R$ 1.234,56)
 * 
 * @param value - Number to format
 * @returns Formatted string in PT-BR format
 * 
 * @example
 * formatCurrency(1234.56) // "1.234,56"
 * formatCurrency(1000) // "1.000,00"
 * formatCurrency(0) // "0,00"
 */
export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) {
    return '0,00';
  }

  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats a number to Brazilian currency with symbol (R$ 1.234,56)
 * 
 * @param value - Number to format
 * @param symbol - Currency symbol (default: "R$")
 * @returns Formatted string with currency symbol
 * 
 * @example
 * formatCurrencyWithSymbol(1234.56) // "R$ 1.234,56"
 * formatCurrencyWithSymbol(1234.56, "€") // "€ 1.234,56"
 */
export function formatCurrencyWithSymbol(value: number, symbol: string = 'R$'): string {
  return `${symbol} ${formatCurrency(value)}`;
}

/**
 * Validates that a value is a valid positive amount
 * 
 * @param value - Value to validate
 * @returns True if value is a positive number
 * 
 * @example
 * isValidAmount(1234.56) // true
 * isValidAmount(0) // false
 * isValidAmount(-100) // false
 * isValidAmount(NaN) // false
 */
export function isValidAmount(value: number | undefined | null): boolean {
  return value !== undefined && value !== null && !isNaN(value) && value > 0;
}
