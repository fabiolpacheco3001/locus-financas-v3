/**
 * File Provider
 * 
 * Handles CSV and OFX file imports.
 * Uses PapaParse for CSV parsing and custom OFX parser.
 */

import Papa from 'papaparse';
import type { 
  TransactionProvider, 
  RawTransactionData, 
  MappedTransaction,
  ColumnMapping,
  FileParseResult
} from '../types';
import { parse, isValid, format } from 'date-fns';

export class FileProvider implements TransactionProvider {
  name = 'file';
  type = 'file' as const;
  
  private parsedTransactions: RawTransactionData[] = [];
  private headers: string[] = [];
  private columnMapping: ColumnMapping | null = null;
  
  isAvailable(): boolean {
    return true;
  }
  
  async getTransactions(): Promise<RawTransactionData[]> {
    return this.parsedTransactions;
  }
  
  /**
   * Set column mapping for file import
   */
  setColumnMapping(mapping: ColumnMapping): void {
    this.columnMapping = mapping;
  }
  
  /**
   * Get detected headers from the last parsed file
   */
  getHeaders(): string[] {
    return this.headers;
  }
  
  /**
   * Parse a file and return results
   */
  async parseFile(file: File): Promise<FileParseResult> {
    const extension = file.name.toLowerCase().split('.').pop();
    
    if (extension === 'ofx' || extension === 'qfx') {
      return this.parseOFX(file);
    } else if (extension === 'csv' || extension === 'txt') {
      return this.parseCSV(file);
    }
    
    return {
      success: false,
      transactions: [],
      errors: ['Formato de arquivo não suportado. Use CSV ou OFX.'],
      headers: [],
      fileType: 'unknown',
      totalRows: 0
    };
  }
  
  /**
   * Parse CSV file using PapaParse
   */
  private async parseCSV(file: File): Promise<FileParseResult> {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (results) => {
          const headers = results.meta.fields || [];
          this.headers = headers;
          
          const errors: string[] = [];
          const transactions: RawTransactionData[] = [];
          
          // If no mapping set, return just headers for mapping UI
          if (!this.columnMapping) {
            resolve({
              success: true,
              transactions: [],
              errors: [],
              headers,
              fileType: 'csv',
              totalRows: results.data.length
            });
            return;
          }
          
          // Map rows using column mapping
          results.data.forEach((row: Record<string, string>, index: number) => {
            try {
              const dateStr = row[this.columnMapping!.date];
              const description = row[this.columnMapping!.description] || '';
              const amountStr = row[this.columnMapping!.amount];
              
              if (!dateStr || !amountStr) {
                errors.push(`Linha ${index + 2}: Data ou valor ausente`);
                return;
              }
              
              const parsedDate = this.parseDate(dateStr);
              if (!parsedDate) {
                errors.push(`Linha ${index + 2}: Data inválida "${dateStr}"`);
                return;
              }
              
              const amount = this.parseAmount(amountStr);
              if (isNaN(amount)) {
                errors.push(`Linha ${index + 2}: Valor inválido "${amountStr}"`);
                return;
              }
              
              // Determine type if column exists
              let type: 'credit' | 'debit' | undefined;
              if (this.columnMapping!.type && row[this.columnMapping!.type]) {
                const typeValue = row[this.columnMapping!.type].toLowerCase();
                if (typeValue.includes('credit') || typeValue.includes('crédito') || typeValue.includes('entrada')) {
                  type = 'credit';
                } else if (typeValue.includes('debit') || typeValue.includes('débito') || typeValue.includes('saída')) {
                  type = 'debit';
                }
              }
              
              transactions.push({
                date: format(parsedDate, 'yyyy-MM-dd'),
                description: description.trim(),
                amount,
                type: type || (amount < 0 ? 'debit' : 'credit'),
                category: this.columnMapping!.category ? row[this.columnMapping!.category] : undefined
              });
            } catch (e) {
              errors.push(`Linha ${index + 2}: Erro ao processar`);
            }
          });
          
          this.parsedTransactions = transactions;
          
          resolve({
            success: errors.length === 0,
            transactions,
            errors,
            headers,
            fileType: 'csv',
            totalRows: results.data.length
          });
        },
        error: (error) => {
          resolve({
            success: false,
            transactions: [],
            errors: [error.message],
            headers: [],
            fileType: 'csv',
            totalRows: 0
          });
        }
      });
    });
  }
  
  /**
   * Parse OFX/QFX file (simplified parser for bank statements)
   */
  private async parseOFX(file: File): Promise<FileParseResult> {
    try {
      const text = await file.text();
      const transactions: RawTransactionData[] = [];
      const errors: string[] = [];
      
      // Simple OFX parser - extracts STMTTRN blocks
      const transactionBlocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g) || [];
      
      transactionBlocks.forEach((block, index) => {
        try {
          const dtPosted = this.extractOFXTag(block, 'DTPOSTED');
          const trnAmt = this.extractOFXTag(block, 'TRNAMT');
          const name = this.extractOFXTag(block, 'NAME') || this.extractOFXTag(block, 'MEMO') || '';
          const memo = this.extractOFXTag(block, 'MEMO') || '';
          const trnType = this.extractOFXTag(block, 'TRNTYPE');
          
          if (!dtPosted || !trnAmt) {
            errors.push(`Transação ${index + 1}: Dados incompletos`);
            return;
          }
          
          // Parse OFX date format: YYYYMMDD or YYYYMMDDHHMMSS
          const year = dtPosted.substring(0, 4);
          const month = dtPosted.substring(4, 6);
          const day = dtPosted.substring(6, 8);
          const dateStr = `${year}-${month}-${day}`;
          
          const amount = parseFloat(trnAmt);
          if (isNaN(amount)) {
            errors.push(`Transação ${index + 1}: Valor inválido`);
            return;
          }
          
          transactions.push({
            date: dateStr,
            description: (name || memo).trim(),
            amount,
            type: amount < 0 || trnType === 'DEBIT' ? 'debit' : 'credit',
            memo: memo !== name ? memo : undefined
          });
        } catch {
          errors.push(`Transação ${index + 1}: Erro ao processar`);
        }
      });
      
      this.parsedTransactions = transactions;
      
      return {
        success: errors.length === 0 && transactions.length > 0,
        transactions,
        errors: transactions.length === 0 && errors.length === 0 
          ? ['Nenhuma transação encontrada no arquivo OFX'] 
          : errors,
        headers: ['date', 'description', 'amount', 'type'],
        fileType: 'ofx',
        totalRows: transactions.length
      };
    } catch (e) {
      return {
        success: false,
        transactions: [],
        errors: ['Erro ao ler arquivo OFX'],
        headers: [],
        fileType: 'ofx',
        totalRows: 0
      };
    }
  }
  
  /**
   * Extract a tag value from OFX block
   */
  private extractOFXTag(block: string, tag: string): string | null {
    // OFX uses <TAG>value or <TAG>value<TAG>
    const regex = new RegExp(`<${tag}>([^<\\n]+)`, 'i');
    const match = block.match(regex);
    return match ? match[1].trim() : null;
  }
  
  /**
   * Parse date string in various formats
   */
  private parseDate(dateStr: string): Date | null {
    const formats = [
      'yyyy-MM-dd',
      'dd/MM/yyyy',
      'MM/dd/yyyy',
      'dd-MM-yyyy',
      'dd.MM.yyyy',
      'yyyy/MM/dd',
    ];
    
    for (const fmt of formats) {
      const parsed = parse(dateStr, fmt, new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    }
    
    // Try native Date parsing as fallback
    const native = new Date(dateStr);
    if (isValid(native)) {
      return native;
    }
    
    return null;
  }
  
  /**
   * Parse amount string (handles Brazilian and US formats)
   */
  private parseAmount(amountStr: string): number {
    // Remove currency symbols and spaces
    let cleaned = amountStr.replace(/[R$€£\s]/g, '').trim();
    
    // Brazilian format: 1.234,56 -> 1234.56
    // US format: 1,234.56 -> 1234.56
    
    // Check if Brazilian format (comma as decimal separator)
    if (cleaned.includes(',') && cleaned.includes('.')) {
      // Has both - determine which is decimal
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      
      if (lastComma > lastDot) {
        // Brazilian: 1.234,56
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // US: 1,234.56
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      // Only comma - could be decimal separator
      // Check if 2 digits after comma (likely decimal)
      const parts = cleaned.split(',');
      if (parts[1] && parts[1].length <= 2) {
        cleaned = cleaned.replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    }
    
    return parseFloat(cleaned);
  }
  
  mapToSchema(raw: RawTransactionData, accountId: string): MappedTransaction {
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
  
  /**
   * Clear parsed data
   */
  clear(): void {
    this.parsedTransactions = [];
    this.headers = [];
    this.columnMapping = null;
  }
}

// Singleton instance
export const fileProvider = new FileProvider();
