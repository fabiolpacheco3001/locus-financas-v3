/**
 * Transaction Provider Types
 * 
 * Abstraction layer for different transaction data sources:
 * - ManualProvider: Direct user input
 * - FileProvider: CSV/OFX file imports
 * - OpenFinanceProvider: (Future) Bank API integration
 */

import type { TransactionKind, ExpenseType, TransactionStatus } from '@/types/finance';

/**
 * Raw transaction data before mapping to Locus schema
 */
export interface RawTransactionData {
  date: string;
  description: string;
  amount: number;
  type?: 'credit' | 'debit'; // From bank files
  category?: string;
  memo?: string;
  reference?: string;
}

/**
 * Mapped transaction ready for Locus database
 */
export interface MappedTransaction {
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  member_id?: string | null;
  kind: TransactionKind;
  amount: number;
  date: string;
  description?: string | null;
  status?: TransactionStatus;
  expense_type?: ExpenseType | null;
  due_date?: string | null;
  payment_method?: string | null;
}

/**
 * Column mapping configuration for file imports
 */
export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  type?: string; // Optional: credit/debit indicator
  category?: string; // Optional: category from file
}

/**
 * File parse result
 */
export interface FileParseResult {
  success: boolean;
  transactions: RawTransactionData[];
  errors: string[];
  headers: string[];
  fileType: 'csv' | 'ofx' | 'unknown';
  totalRows: number;
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Transaction Provider Interface
 * All data sources implement this contract
 */
export interface TransactionProvider {
  name: string;
  type: 'manual' | 'file' | 'open_finance';
  
  /**
   * Check if provider is available/enabled
   */
  isAvailable(): boolean;
  
  /**
   * Get raw transactions from this source
   */
  getTransactions(): Promise<RawTransactionData[]>;
  
  /**
   * Map raw data to Locus schema
   */
  mapToSchema(raw: RawTransactionData, accountId: string): MappedTransaction;
}

/**
 * Provider registry for managing multiple sources
 */
export interface ProviderRegistry {
  providers: Map<string, TransactionProvider>;
  
  register(provider: TransactionProvider): void;
  get(name: string): TransactionProvider | undefined;
  getActive(): TransactionProvider[];
}
