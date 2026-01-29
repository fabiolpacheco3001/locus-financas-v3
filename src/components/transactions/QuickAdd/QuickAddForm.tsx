/**
 * Quick Add Form
 * 
 * Optimized manual entry with keyboard shortcuts:
 * - Enter to save
 * - Tab to next field
 * - -/+ prefix for expense/income
 * - Auto-focus and rapid entry flow
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Plus, Minus, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { parseQuickAddInput, type QuickAddData } from '@/domain/transactions/providers';
import type { Account, Category } from '@/types/finance';

interface QuickAddFormProps {
  accounts: Account[];
  categories: Category[];
  defaultAccountId?: string;
  onSubmit: (data: {
    amount: number;
    description: string;
    accountId: string;
    categoryId?: string;
    kind: 'INCOME' | 'EXPENSE';
    date: string;
  }) => Promise<void>;
  disabled?: boolean;
}

export function QuickAddForm({
  accounts,
  categories,
  defaultAccountId,
  onSubmit,
  disabled = false
}: QuickAddFormProps) {
  const { t } = useTranslation();
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isExpense, setIsExpense] = useState(true);
  const [accountId, setAccountId] = useState(defaultAccountId || '');
  const [categoryId, setCategoryId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const amountRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  
  // Set default account when available
  useEffect(() => {
    if (!accountId && defaultAccountId) {
      setAccountId(defaultAccountId);
    } else if (!accountId && accounts.length > 0) {
      const primary = accounts.find(a => a.is_primary && a.is_active);
      if (primary) setAccountId(primary.id);
    }
  }, [accounts, defaultAccountId, accountId]);
  
  const activeAccounts = accounts.filter(a => a.is_active && a.type !== 'CARD');
  const activeCategories = categories.filter(c => !c.archived_at);
  
  const handleAmountKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      descriptionRef.current?.focus();
    } else if (e.key === '-') {
      setIsExpense(true);
    } else if (e.key === '+') {
      setIsExpense(false);
    }
  }, []);
  
  const handleDescriptionKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, []);
  
  const handleQuickInput = useCallback((input: string) => {
    const parsed = parseQuickAddInput(input);
    if (parsed.amount) {
      setAmount(parsed.amount);
      if (parsed.isExpense !== undefined) {
        setIsExpense(parsed.isExpense);
      }
      if (parsed.description) {
        setDescription(parsed.description);
      }
    }
  }, []);
  
  const handleSubmit = useCallback(async () => {
    if (!amount || !accountId || isSubmitting) return;
    
    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error(t('quickAdd.errors.invalidAmount', 'Valor inválido'));
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await onSubmit({
        amount: numericAmount,
        description: description.trim(),
        accountId,
        categoryId: categoryId || undefined,
        kind: isExpense ? 'EXPENSE' : 'INCOME',
        date: format(new Date(), 'yyyy-MM-dd')
      });
      
      // Clear form for next entry
      setAmount('');
      setDescription('');
      setCategoryId('');
      amountRef.current?.focus();
      
      toast.success(
        isExpense 
          ? t('quickAdd.success.expense', 'Despesa registrada!') 
          : t('quickAdd.success.income', 'Receita registrada!')
      );
    } catch (error) {
      toast.error(t('quickAdd.errors.failed', 'Erro ao salvar transação'));
    } finally {
      setIsSubmitting(false);
    }
  }, [amount, description, accountId, categoryId, isExpense, isSubmitting, onSubmit, t]);
  
  const toggleKind = useCallback(() => {
    setIsExpense(prev => !prev);
  }, []);
  
  return (
    <div 
      className="p-4 rounded-lg border bg-card shadow-sm"
      data-testid="quick-add-form"
    >
      {/* Header with kind toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t('quickAdd.title', 'Entrada rápida')}
        </h3>
        
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
          <button
            type="button"
            onClick={() => setIsExpense(true)}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              isExpense 
                ? "bg-destructive text-destructive-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="quick-add-expense"
          >
            <Minus className="h-4 w-4" />
            {t('transactions.expense', 'Despesa')}
          </button>
          <button
            type="button"
            onClick={() => setIsExpense(false)}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              !isExpense 
                ? "bg-success text-success-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="quick-add-income"
          >
            <Plus className="h-4 w-4" />
            {t('transactions.income', 'Receita')}
          </button>
        </div>
      </div>
      
      {/* Input row */}
      <div className="flex gap-2 mb-3">
        {/* Amount */}
        <div className="relative w-32 flex-shrink-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            R$
          </span>
          <Input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={handleAmountKeyDown}
            placeholder="0,00"
            className="pl-9 text-lg font-semibold"
            disabled={disabled || isSubmitting}
            autoFocus
            data-testid="quick-add-amount"
          />
        </div>
        
        {/* Description */}
        <Input
          ref={descriptionRef}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleDescriptionKeyDown}
          placeholder={t('quickAdd.descriptionPlaceholder', 'Descrição (Enter para salvar)')}
          className="flex-1"
          disabled={disabled || isSubmitting}
          data-testid="quick-add-description"
        />
        
        {/* Submit button */}
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!amount || !accountId || disabled || isSubmitting}
          className="flex-shrink-0"
          data-testid="quick-add-submit"
        >
          {isSubmitting ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Optional fields row */}
      <div className="flex gap-2">
        {/* Account */}
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger 
            className="flex-1 h-9 text-sm"
            data-testid="quick-add-account"
          >
            <SelectValue placeholder={t('quickAdd.selectAccount', 'Conta')} />
          </SelectTrigger>
          <SelectContent>
            {activeAccounts.map(account => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Category */}
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger 
            className="flex-1 h-9 text-sm"
            data-testid="quick-add-category"
          >
            <SelectValue placeholder={t('quickAdd.selectCategory', 'Categoria (opcional)')} />
          </SelectTrigger>
          <SelectContent>
            {activeCategories.map(category => (
              <SelectItem key={category.id} value={category.id}>
                {category.icon && <span className="mr-2">{category.icon}</span>}
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Keyboard hint */}
      <div className="mt-3 text-xs text-muted-foreground text-center">
        <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">Tab</kbd>
        {' '}{t('quickAdd.hint.tab', 'próximo campo')}{' • '}
        <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">Enter</kbd>
        {' '}{t('quickAdd.hint.enter', 'salvar')}
      </div>
    </div>
  );
}
