/**
 * Manual Provider
 * 
 * Handles direct user input for transactions.
 * This is the primary method for entering transactions.
 */

import type { 
  TransactionProvider, 
  RawTransactionData, 
  MappedTransaction 
} from '../types';
import { format } from 'date-fns';

export class ManualProvider implements TransactionProvider {
  name = 'manual';
  type = 'manual' as const;
  
  private pendingTransactions: RawTransactionData[] = [];
  
  isAvailable(): boolean {
    // Manual entry is always available
    return true;
  }
  
  async getTransactions(): Promise<RawTransactionData[]> {
    return this.pendingTransactions;
  }
  
  /**
   * Add a transaction from user input
   */
  addTransaction(data: RawTransactionData): void {
    this.pendingTransactions.push(data);
  }
  
  /**
   * Clear pending transactions after successful save
   */
  clearPending(): void {
    this.pendingTransactions = [];
  }
  
  mapToSchema(raw: RawTransactionData, accountId: string): MappedTransaction {
    // Determine kind based on amount or type
    const isExpense = raw.type === 'debit' || raw.amount < 0;
    
    return {
      account_id: accountId,
      kind: isExpense ? 'EXPENSE' : 'INCOME',
      amount: Math.abs(raw.amount),
      date: raw.date,
      description: raw.description || null,
      status: 'confirmed',
      due_date: raw.date,
    };
  }
}

/**
 * Quick Add data structure for optimized manual entry
 */
export interface QuickAddData {
  amount: string;
  description: string;
  accountId: string;
  categoryId?: string;
  isExpense: boolean;
  date: string;
}

/**
 * Parse quick add input with keyboard shortcuts
 */
export function parseQuickAddInput(input: string): Partial<QuickAddData> {
  const result: Partial<QuickAddData> = {};
  
  // Pattern: "100 mercado" or "-50 uber" or "+200 salário"
  const match = input.match(/^([+-]?\d+(?:[.,]\d{2})?)\s*(.*)$/);
  
  if (match) {
    const amountStr = match[1].replace(',', '.');
    const amount = parseFloat(amountStr);
    
    result.amount = Math.abs(amount).toString();
    result.isExpense = !match[1].startsWith('+') && amount >= 0 ? true : amount < 0;
    result.description = match[2].trim() || undefined;
    result.date = format(new Date(), 'yyyy-MM-dd');
  }
  
  return result;
}

// Singleton instance
export const manualProvider = new ManualProvider();
