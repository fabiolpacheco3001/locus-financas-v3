import { useCallback, useEffect, useState } from 'react';
import { TransactionKind } from '@/types/finance';

interface TransactionPreferences {
  lastKind: TransactionKind;
  lastAccountId: string | null;
  lastCategoryId: string | null;
  lastSubcategoryId: string | null;
  lastFromAccountId: string | null;
  lastToAccountId: string | null;
}

const STORAGE_KEY_PREFIX = 'transaction_prefs_';

const defaultPreferences: TransactionPreferences = {
  lastKind: 'EXPENSE',
  lastAccountId: null,
  lastCategoryId: null,
  lastSubcategoryId: null,
  lastFromAccountId: null,
  lastToAccountId: null,
};

interface SavePreferencesParams {
  kind: TransactionKind;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
}

export function useTransactionPreferences(memberId: string | undefined) {
  const [preferences, setPreferences] = useState<TransactionPreferences>(defaultPreferences);

  const storageKey = memberId ? `${STORAGE_KEY_PREFIX}${memberId}` : null;

  // Load preferences from localStorage when memberId changes
  useEffect(() => {
    if (!storageKey) return;
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<TransactionPreferences>;
        // Merge with defaults to handle missing fields from old stored data
        setPreferences({ ...defaultPreferences, ...parsed });
      }
    } catch (error) {
      console.error('Error loading transaction preferences:', error);
    }
  }, [storageKey]);

  // Save preferences to localStorage
  const savePreferences = useCallback((params: SavePreferencesParams) => {
    if (!storageKey) return;
    
    const { kind, accountId, toAccountId, categoryId, subcategoryId } = params;
    
    setPreferences(prev => {
      const newPrefs: TransactionPreferences = { ...prev };
      
      // Always save kind
      newPrefs.lastKind = kind;
      
      if (kind === 'TRANSFER') {
        // For transfers, save from/to accounts
        newPrefs.lastFromAccountId = accountId;
        newPrefs.lastToAccountId = toAccountId ?? null;
      } else {
        // For income/expense, save account
        newPrefs.lastAccountId = accountId;
      }
      
      if (kind === 'EXPENSE') {
        // Only save category/subcategory for expenses
        newPrefs.lastCategoryId = categoryId ?? null;
        newPrefs.lastSubcategoryId = subcategoryId ?? null;
      }
      
      try {
        localStorage.setItem(storageKey, JSON.stringify(newPrefs));
      } catch (error) {
        console.error('Error saving transaction preferences:', error);
      }
      
      return newPrefs;
    });
  }, [storageKey]);

  return {
    lastKind: preferences.lastKind,
    lastAccountId: preferences.lastAccountId,
    lastCategoryId: preferences.lastCategoryId,
    lastSubcategoryId: preferences.lastSubcategoryId,
    lastFromAccountId: preferences.lastFromAccountId,
    lastToAccountId: preferences.lastToAccountId,
    savePreferences,
  };
}
