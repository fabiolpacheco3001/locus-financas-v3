import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, addMonths, startOfMonth } from 'date-fns';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { useLocale } from '@/i18n/useLocale';
import { TransactionKind, ExpenseType } from '@/types/finance';

/**
 * Parse a month string (YYYY-MM) into a Date object in local time.
 * This avoids timezone issues that occur with new Date("YYYY-MM") or parse().
 * 
 * @param monthStr - String in format "YYYY-MM"
 * @param day - Day of month (defaults to 1)
 * @returns Date object in local timezone
 */
function parseMonthStringToDate(monthStr: string, day: number = 1): Date {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a Date object to a date-only string (YYYY-MM-DD).
 * This ensures no timezone shift when storing in the database.
 * 
 * @param date - Date object
 * @returns String in format "YYYY-MM-DD"
 */
function formatDateOnly(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export interface RecurringTransaction {
  id: string;
  household_id: string;
  kind: TransactionKind;
  amount: number;
  description: string | null;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  member_id: string | null;
  expense_type: ExpenseType | null;
  frequency: 'monthly';
  day_of_month: number;
  start_month: string;
  end_month: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateRecurringTransactionParams {
  kind: TransactionKind;
  amount: number;
  description?: string | null;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  member_id?: string | null;
  expense_type?: ExpenseType | null;
  day_of_month: number;
  start_month: string; // YYYY-MM
  end_month?: string | null; // YYYY-MM or null for indefinite
}

export function useRecurringTransactions() {
  const { householdId } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLocale();

  // Fetch all recurring transactions
  const { data: recurringTransactions = [], isLoading } = useQuery({
    queryKey: ['recurring-transactions', householdId],
    queryFn: async () => {
      if (!householdId) return [];

      const { data, error } = await supabase
        .from('recurring_transactions')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RecurringTransaction[];
    },
    enabled: !!householdId,
  });

  // Helper to calculate valid date string for a given month (handles months with fewer days)
  const getValidDateForMonth = (monthStr: string, dayOfMonth: number): string => {
    const [year, month] = monthStr.split('-').map(Number);
    // Get last day of the month by creating date on day 0 of next month
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    // Use the smaller of dayOfMonth or lastDayOfMonth
    const validDay = Math.min(dayOfMonth, lastDayOfMonth);
    // Create local date and format as date-only string
    const dateObj = new Date(year, month - 1, validDay);
    return formatDateOnly(dateObj);
  };

  // Helper to generate a single transaction for a month
  const createTransactionForMonth = async (
    recurring: RecurringTransaction,
    monthStr: string, // YYYY-MM
    householdIdLocal: string
  ) => {
    // Calculate valid date (handles Feb 30 → Feb 28/29, etc.)
    const transactionDate = getValidDateForMonth(monthStr, recurring.day_of_month);
    
    // Determine status based on kind and expense_type
    let status = 'confirmed';
    if (recurring.kind === 'INCOME') {
      status = 'planned'; // Recurring income starts as planned
    } else if (recurring.kind === 'EXPENSE' && recurring.expense_type === 'fixed') {
      status = 'planned'; // Fixed expenses start as planned
    }

    const transactionData: Record<string, unknown> = {
      household_id: householdIdLocal,
      account_id: recurring.account_id,
      kind: recurring.kind,
      amount: recurring.amount,
      date: transactionDate,
      due_date: transactionDate,
      description: recurring.description,
      status,
      recurring_transaction_id: recurring.id,
    };

    // Add optional fields based on kind
    if (recurring.kind === 'TRANSFER') {
      transactionData.to_account_id = recurring.to_account_id;
    }
    if (recurring.kind === 'EXPENSE') {
      transactionData.category_id = recurring.category_id;
      transactionData.subcategory_id = recurring.subcategory_id;
      transactionData.expense_type = recurring.expense_type || 'variable';
    }
    if (recurring.member_id) {
      transactionData.member_id = recurring.member_id;
    }

    // Use upsert-like behavior: ON CONFLICT DO NOTHING
    // The unique index idx_recurring_transaction_month_unique ensures idempotency
    const { error } = await supabase
      .from('transactions')
      .insert(transactionData as any);

    // Ignore duplicate key errors (23505) - this is expected for idempotency
    if (error && error.code !== '23505') {
      throw error;
    }
  };

  // Generate all months between start and end (or start + horizon if no end)
  const generateMonthsToCreate = (startMonth: string, endMonth: string | null): string[] => {
    const months: string[] = [];
    const HORIZON_MONTHS = 12; // Generate 12 months ahead if no end date
    
    // Use local timezone parsing to avoid timezone bugs
    const startDate = parseMonthStringToDate(startMonth);
    let endDate: Date;
    
    if (endMonth) {
      endDate = parseMonthStringToDate(endMonth);
    } else {
      // No end date: generate from start to start + 12 months
      endDate = addMonths(startDate, HORIZON_MONTHS - 1);
    }
    
    let currentDate = startDate;
    while (currentDate <= endDate) {
      months.push(format(currentDate, 'yyyy-MM'));
      currentDate = addMonths(currentDate, 1);
    }
    
    return months;
  };

  // Create a recurring transaction and generate all future transactions
  const createRecurringTransaction = useMutation({
    mutationFn: async (params: CreateRecurringTransactionParams) => {
      if (!householdId) throw new Error('No household');

      // Validate subcategory belongs to category (frontend safeguard)
      if (params.subcategory_id && params.category_id) {
        const { data: subcategory } = await supabase
          .from('subcategories')
          .select('category_id')
          .eq('id', params.subcategory_id)
          .maybeSingle();
        
        if (subcategory && subcategory.category_id !== params.category_id) {
          // Clear the invalid subcategory
          params.subcategory_id = null;
        }
      }

      const payload = {
        household_id: householdId,
        kind: params.kind,
        amount: params.amount,
        description: params.description || null,
        account_id: params.account_id,
        to_account_id: params.to_account_id || null,
        category_id: params.category_id || null,
        subcategory_id: params.subcategory_id || null,
        member_id: params.member_id || null,
        expense_type: params.expense_type || null,
        frequency: 'monthly' as const,
        day_of_month: params.day_of_month,
        start_month: params.start_month,
        end_month: params.end_month || null,
        is_active: true,
      };
      

      // 1. Create the recurring transaction template
      const { data: recurring, error: recurringError } = await supabase
        .from('recurring_transactions')
        .insert(payload)
        .select()
        .single();

      if (recurringError) {
        console.error('[Recurring Transaction Create Error]', { error: recurringError, payload });
        throw recurringError;
      }

      // 2. Generate all transactions for the defined period
      const monthsToCreate = generateMonthsToCreate(params.start_month, params.end_month || null);
      
      // Cast to RecurringTransaction for the helper
      const recurringWithDefaults: RecurringTransaction = {
        ...recurring,
        description: recurring.description || null,
        to_account_id: recurring.to_account_id || null,
        category_id: recurring.category_id || null,
        subcategory_id: recurring.subcategory_id || null,
        member_id: recurring.member_id || null,
        expense_type: recurring.expense_type as ExpenseType | null,
        frequency: 'monthly' as const,
      };

      // Create transactions for all months
      const errors: Error[] = [];
      let successCount = 0;
      for (const month of monthsToCreate) {
        try {
          await createTransactionForMonth(recurringWithDefaults, month, householdId);
          successCount++;
        } catch (err) {
          errors.push(err as Error);
        }
      }

      // If all insertions failed, rollback
      if (errors.length === monthsToCreate.length && errors.length > 0) {
        await supabase.from('recurring_transactions').delete().eq('id', recurring.id);
        throw errors[0];
      }

      // Return result with metadata for toast
      return {
        recurring,
        successCount,
        totalMonths: monthsToCreate.length,
        startMonth: params.start_month,
        endMonth: params.end_month || monthsToCreate[monthsToCreate.length - 1],
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      
      // Format months for display (YYYY-MM -> MMM/YYYY)
      // Use local date parsing to avoid timezone shift
      const formatMonthDisplay = (monthStr: string) => {
        const [year, month] = monthStr.split('-').map(Number);
        return format(new Date(year, month - 1, 1), 'MMM/yyyy');
      };
      
      const startDisplay = formatMonthDisplay(result.startMonth);
      const endDisplay = formatMonthDisplay(result.endMonth);
      
      toast.success(
        t('transactions.recurring.messages.createdWithDetails', {
          count: result.successCount,
          start: startDisplay,
          end: endDisplay,
        })
      );
    },
    onError: (error, variables) => {
      toast.error(getFriendlyErrorMessage(error, variables));
    },
  });

  // Delete (deactivate) a recurring transaction
  const deleteRecurringTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] });
      toast.success(t('transactions.recurring.messages.deleted'));
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    },
  });

  // Generate transactions for a specific month (lazy generation)
  // This is called when navigating to a new month - ensures transactions exist
  const generateTransactionsForMonth = useMutation({
    mutationFn: async (monthStr: string) => {
      if (!householdId) return;

      const [year, month] = monthStr.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);

      // Get all active recurring transactions
      const { data: recurrings, error: fetchError } = await supabase
        .from('recurring_transactions')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true);

      if (fetchError) throw fetchError;

      // Check each recurring transaction
      for (const recurring of (recurrings || [])) {
        // Parse start_month using local timezone
        const startMonthDate = parseMonthStringToDate(recurring.start_month);
        
        // Check if this month is >= start_month
        if (monthDate < startOfMonth(startMonthDate)) continue;
        
        // Check if end_month is set and this month is > end_month
        if (recurring.end_month) {
          const endMonthDate = parseMonthStringToDate(recurring.end_month);
          if (monthDate > startOfMonth(endMonthDate)) continue;
        }

        // Cast to RecurringTransaction for the helper
        const recurringCast: RecurringTransaction = {
          ...recurring,
          description: recurring.description || null,
          to_account_id: recurring.to_account_id || null,
          category_id: recurring.category_id || null,
          subcategory_id: recurring.subcategory_id || null,
          member_id: recurring.member_id || null,
          expense_type: recurring.expense_type as ExpenseType | null,
          frequency: 'monthly' as const,
        };

        // Use the helper - idempotency is handled by unique constraint
        try {
          await createTransactionForMonth(recurringCast, monthStr, householdId);
        } catch {
          // Silently ignore errors for individual transactions
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  return {
    recurringTransactions,
    isLoading,
    createRecurringTransaction,
    deleteRecurringTransaction,
    generateTransactionsForMonth,
  };
}
