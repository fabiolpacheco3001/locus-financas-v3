export type AccountType = 'BANK' | 'CASH' | 'CARD';
export type TransactionKind = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type MemberRole = 'ADMIN' | 'MEMBER';

export interface Household {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  household_id: string;
  user_id?: string | null; // Only visible for self via RPC, not stored in members table
  name: string;
  email?: string | null; // Only visible for self via RPC (from JWT)
  role: MemberRole;
  is_you?: boolean; // Returned by get_members_visible RPC
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  household_id: string;
  name: string;
  type: AccountType;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  is_primary: boolean;
  is_reserve: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  icon: string | null;
  is_budget_excluded: boolean;
  is_essential: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  type?: 'income' | 'expense' | string;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TransactionStatus = 'confirmed' | 'planned' | 'cancelled';
export type ExpenseType = 'fixed' | 'variable';

export interface Transaction {
  id: string;
  household_id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  member_id: string | null;
  kind: TransactionKind;
  amount: number;
  date: string;
  description: string | null;
  status: TransactionStatus;
  confirmed_at: string | null;
  confirmed_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  expense_type: ExpenseType | null;
  due_date: string | null;
  installment_group_id: string | null;
  installment_number: number | null;
  installment_total: number | null;
  payment_method: string | null;
  credit_card_id: string | null;
  invoice_month: string | null;
  created_at: string;
  updated_at: string;
  account?: Account;
  to_account?: Account;
  category?: Category;
  subcategory?: Subcategory;
  member?: Member;
  confirmed_by_member?: Member;
  cancelled_by_member?: Member;
}

export interface Budget {
  id: string;
  household_id: string;
  category_id: string;
  subcategory_id: string | null;
  year: number;
  month: number;
  planned_amount: number;
  is_manual: boolean;
  recurring_budget_id: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
  subcategory?: Subcategory;
}

export interface RecurringBudget {
  id: string;
  household_id: string;
  category_id: string;
  subcategory_id: string | null;
  amount: number;
  frequency: 'monthly';
  start_month: string; // YYYY-MM
  end_month: string | null; // YYYY-MM or null
  created_at: string;
  updated_at: string;
  category?: Category;
  subcategory?: Subcategory;
}

export interface MonthlyStats {
  income: number;
  expenses: number;
  balance: number;
  topCategories: { name: string; amount: number; percentage: number }[];
}
