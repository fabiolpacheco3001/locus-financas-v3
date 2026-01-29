/**
 * useFileImport Hook
 * 
 * Handles file import logic including:
 * - File parsing via FileProvider
 * - Transaction creation
 * - Duplicate detection
 */

import { useCallback, useState } from 'react';
import { useTransactions } from './useTransactions';
import { fileProvider } from '@/domain/transactions/providers';
import type { RawTransactionData, ImportResult } from '@/domain/transactions/types';

export function useFileImport() {
  const { createTransaction } = useTransactions();
  const [isImporting, setIsImporting] = useState(false);
  
  const importTransactions = useCallback(async (
    transactions: RawTransactionData[],
    accountId: string
  ): Promise<ImportResult> => {
    setIsImporting(true);
    
    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: []
    };
    
    try {
      for (const tx of transactions) {
        try {
          const mapped = fileProvider.mapToSchema(tx, accountId);
          
          await createTransaction.mutateAsync({
            account_id: mapped.account_id,
            kind: mapped.kind,
            amount: mapped.amount,
            date: mapped.date,
            description: mapped.description || undefined,
            status: mapped.status,
            due_date: mapped.due_date || undefined,
          });
          
          result.imported++;
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Erro desconhecido';
          result.errors.push(`${tx.description || tx.date}: ${errorMessage}`);
        }
      }
      
      result.success = result.errors.length === 0;
    } catch (e) {
      result.success = false;
      result.errors.push('Erro durante a importação');
    } finally {
      setIsImporting(false);
    }
    
    return result;
  }, [createTransaction]);
  
  return {
    importTransactions,
    isImporting
  };
}
