-- Enums
CREATE TYPE public.account_type AS ENUM ('BANK', 'CASH', 'CARD');
CREATE TYPE public.transaction_kind AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');
CREATE TYPE public.member_role AS ENUM ('ADMIN', 'MEMBER');

-- Households (Famílias)
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Members (Membros da família)
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  role member_role NOT NULL DEFAULT 'MEMBER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Accounts (Contas bancárias, dinheiro, cartões)
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type account_type NOT NULL,
  initial_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categories (Categorias)
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  is_budget_excluded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subcategories (Subcategorias)
CREATE TABLE public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions (Transações)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_account_id UUID REFERENCES public.accounts(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  kind transaction_kind NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budgets (Orçamentos mensais)
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  planned_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(household_id, category_id, subcategory_id, year, month)
);

-- Enable RLS on all tables
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Function to get user's household_id
CREATE OR REPLACE FUNCTION public.get_user_household_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.members WHERE user_id = auth.uid() LIMIT 1
$$;

-- RLS Policies for households
CREATE POLICY "Users can view their household"
  ON public.households FOR SELECT
  USING (id = public.get_user_household_id());

CREATE POLICY "Users can update their household"
  ON public.households FOR UPDATE
  USING (id = public.get_user_household_id());

-- RLS Policies for members
CREATE POLICY "Users can view members in their household"
  ON public.members FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Admins can insert members"
  ON public.members FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY "Admins can update members"
  ON public.members FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Admins can delete members"
  ON public.members FOR DELETE
  USING (household_id = public.get_user_household_id());

-- RLS Policies for accounts
CREATE POLICY "Users can view accounts in their household"
  ON public.accounts FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can insert accounts"
  ON public.accounts FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY "Users can update accounts"
  ON public.accounts FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can delete accounts"
  ON public.accounts FOR DELETE
  USING (household_id = public.get_user_household_id());

-- RLS Policies for categories
CREATE POLICY "Users can view categories in their household"
  ON public.categories FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can insert categories"
  ON public.categories FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY "Users can update categories"
  ON public.categories FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can delete categories"
  ON public.categories FOR DELETE
  USING (household_id = public.get_user_household_id());

-- RLS Policies for subcategories (via category)
CREATE POLICY "Users can view subcategories"
  ON public.subcategories FOR SELECT
  USING (category_id IN (SELECT id FROM public.categories WHERE household_id = public.get_user_household_id()));

CREATE POLICY "Users can insert subcategories"
  ON public.subcategories FOR INSERT
  WITH CHECK (category_id IN (SELECT id FROM public.categories WHERE household_id = public.get_user_household_id()));

CREATE POLICY "Users can update subcategories"
  ON public.subcategories FOR UPDATE
  USING (category_id IN (SELECT id FROM public.categories WHERE household_id = public.get_user_household_id()));

CREATE POLICY "Users can delete subcategories"
  ON public.subcategories FOR DELETE
  USING (category_id IN (SELECT id FROM public.categories WHERE household_id = public.get_user_household_id()));

-- RLS Policies for transactions
CREATE POLICY "Users can view transactions in their household"
  ON public.transactions FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY "Users can update transactions"
  ON public.transactions FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can delete transactions"
  ON public.transactions FOR DELETE
  USING (household_id = public.get_user_household_id());

-- RLS Policies for budgets
CREATE POLICY "Users can view budgets in their household"
  ON public.budgets FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can insert budgets"
  ON public.budgets FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY "Users can update budgets"
  ON public.budgets FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can delete budgets"
  ON public.budgets FOR DELETE
  USING (household_id = public.get_user_household_id());

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON public.households FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subcategories_updated_at BEFORE UPDATE ON public.subcategories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for better performance
CREATE INDEX idx_members_household ON public.members(household_id);
CREATE INDEX idx_members_user ON public.members(user_id);
CREATE INDEX idx_accounts_household ON public.accounts(household_id);
CREATE INDEX idx_categories_household ON public.categories(household_id);
CREATE INDEX idx_subcategories_category ON public.subcategories(category_id);
CREATE INDEX idx_transactions_household ON public.transactions(household_id);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transactions_account ON public.transactions(account_id);
CREATE INDEX idx_transactions_category ON public.transactions(category_id);
CREATE INDEX idx_budgets_household_period ON public.budgets(household_id, year, month);