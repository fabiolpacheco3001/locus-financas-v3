-- ============================================================
-- PHASE 1: Create get_account_balance function (Single Source of Truth)
-- This function calculates the balance for a single account based on:
-- initial_balance + INCOME - EXPENSE + transfers_in - transfers_out
-- Only considers confirmed transactions with cancelled_at IS NULL
-- Uses due_date for EXPENSE (with fallback to date) for cutoff logic
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_account_balance(p_account_id uuid)
RETURNS numeric AS $$
DECLARE
  v_initial_balance numeric;
  v_total_income numeric;
  v_total_expense numeric;
  v_transfers_in numeric;
  v_transfers_out numeric;
  v_cutoff_date date;
  v_household_id uuid;
BEGIN
  -- Security: Verify the account belongs to the user's household
  SELECT a.household_id, COALESCE(a.initial_balance, 0)
  INTO v_household_id, v_initial_balance
  FROM public.accounts a
  WHERE a.id = p_account_id;
  
  IF v_household_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Only allow access to accounts in user's household
  IF v_household_id != get_user_household_id() THEN
    RAISE EXCEPTION 'Access denied to account';
  END IF;
  
  -- Calculate cutoff: end of current month (to include all of "today" while excluding future months)
  v_cutoff_date := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
  
  -- Calculate total income for this account
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_total_income
  FROM public.transactions t
  WHERE t.account_id = p_account_id
    AND t.kind = 'INCOME'
    AND t.status = 'confirmed'
    AND t.cancelled_at IS NULL
    AND t.date <= v_cutoff_date;
  
  -- Calculate total expense for this account (using due_date with fallback to date)
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_total_expense
  FROM public.transactions t
  WHERE t.account_id = p_account_id
    AND t.kind = 'EXPENSE'
    AND t.status = 'confirmed'
    AND t.cancelled_at IS NULL
    AND COALESCE(t.due_date, t.date) <= v_cutoff_date;
  
  -- Calculate transfers OUT from this account
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_transfers_out
  FROM public.transactions t
  WHERE t.account_id = p_account_id
    AND t.kind = 'TRANSFER'
    AND t.status = 'confirmed'
    AND t.cancelled_at IS NULL
    AND t.date <= v_cutoff_date;
  
  -- Calculate transfers IN to this account
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_transfers_in
  FROM public.transactions t
  WHERE t.to_account_id = p_account_id
    AND t.kind = 'TRANSFER'
    AND t.status = 'confirmed'
    AND t.cancelled_at IS NULL
    AND t.date <= v_cutoff_date;
  
  -- Return calculated balance
  RETURN v_initial_balance + v_total_income - v_total_expense + v_transfers_in - v_transfers_out;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_account_balance(uuid) TO authenticated;

-- ============================================================
-- PHASE 2: Create get_accounts_with_balances function
-- Returns all accounts for the user's household with calculated balances
-- This is used by useAccounts hook to get all balances in a single call
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_accounts_with_balances()
RETURNS TABLE (
  id uuid,
  household_id uuid,
  name text,
  type public.account_type,
  initial_balance numeric,
  current_balance numeric,
  is_active boolean,
  is_primary boolean,
  is_reserve boolean,
  created_at timestamptz,
  updated_at timestamptz,
  calculated_balance numeric,
  transaction_count bigint
) AS $$
DECLARE
  v_household_id uuid;
  v_cutoff_date date;
BEGIN
  v_household_id := get_user_household_id();
  
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Calculate cutoff: end of current month
  v_cutoff_date := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
  
  RETURN QUERY
  WITH account_transactions AS (
    SELECT 
      t.account_id,
      t.to_account_id,
      t.kind,
      t.amount,
      t.date,
      COALESCE(t.due_date, t.date) AS effective_date
    FROM public.transactions t
    WHERE t.household_id = v_household_id
      AND t.status = 'confirmed'
      AND t.cancelled_at IS NULL
  ),
  account_stats AS (
    SELECT 
      a.id AS account_id,
      COALESCE(a.initial_balance, 0) AS initial_balance,
      -- Income (uses date)
      COALESCE(SUM(CASE 
        WHEN at.kind = 'INCOME' AND at.account_id = a.id AND at.date <= v_cutoff_date 
        THEN at.amount ELSE 0 
      END), 0) AS total_income,
      -- Expense (uses effective_date = due_date or date)
      COALESCE(SUM(CASE 
        WHEN at.kind = 'EXPENSE' AND at.account_id = a.id AND at.effective_date <= v_cutoff_date 
        THEN at.amount ELSE 0 
      END), 0) AS total_expense,
      -- Transfers out
      COALESCE(SUM(CASE 
        WHEN at.kind = 'TRANSFER' AND at.account_id = a.id AND at.date <= v_cutoff_date 
        THEN at.amount ELSE 0 
      END), 0) AS transfers_out,
      -- Transfers in
      COALESCE(SUM(CASE 
        WHEN at.kind = 'TRANSFER' AND at.to_account_id = a.id AND at.date <= v_cutoff_date 
        THEN at.amount ELSE 0 
      END), 0) AS transfers_in,
      -- Transaction count
      COUNT(CASE 
        WHEN (at.account_id = a.id OR at.to_account_id = a.id)
        THEN 1 
      END) AS tx_count
    FROM public.accounts a
    LEFT JOIN account_transactions at ON at.account_id = a.id OR at.to_account_id = a.id
    WHERE a.household_id = v_household_id
    GROUP BY a.id, a.initial_balance
  )
  SELECT 
    a.id,
    a.household_id,
    a.name,
    a.type,
    a.initial_balance,
    a.current_balance,
    a.is_active,
    a.is_primary,
    a.is_reserve,
    a.created_at,
    a.updated_at,
    (COALESCE(s.initial_balance, 0) + s.total_income - s.total_expense + s.transfers_in - s.transfers_out)::numeric AS calculated_balance,
    COALESCE(s.tx_count, 0)::bigint AS transaction_count
  FROM public.accounts a
  LEFT JOIN account_stats s ON s.account_id = a.id
  WHERE a.household_id = v_household_id
  ORDER BY a.type, a.name;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_accounts_with_balances() TO authenticated;

-- ============================================================
-- PHASE 3: Update force_update_account_balance to use get_account_balance
-- Now it internally calculates the balance using the SSoT function
-- ============================================================

CREATE OR REPLACE FUNCTION public.force_update_account_balance(p_account_id uuid, p_new_balance numeric DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_household_id uuid;
  v_calculated_balance numeric;
BEGIN
  -- Get account's household
  SELECT household_id INTO v_household_id
  FROM public.accounts
  WHERE id = p_account_id;
  
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  
  -- Verify access
  IF v_household_id != get_user_household_id() THEN
    RAISE EXCEPTION 'Access denied to account';
  END IF;
  
  -- If no balance provided, calculate it using the SSoT function
  IF p_new_balance IS NULL THEN
    v_calculated_balance := get_account_balance(p_account_id);
  ELSE
    v_calculated_balance := p_new_balance;
  END IF;
  
  -- Update the account's current_balance
  UPDATE public.accounts
  SET current_balance = v_calculated_balance,
      updated_at = now()
  WHERE id = p_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the function is granted to authenticated users
GRANT EXECUTE ON FUNCTION public.force_update_account_balance(uuid, numeric) TO authenticated;

-- ============================================================
-- PHASE 4: Create sync_all_account_balances for batch reconciliation
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_all_account_balances()
RETURNS TABLE (
  account_id uuid,
  account_name text,
  old_balance numeric,
  new_balance numeric,
  difference numeric
) AS $$
DECLARE
  v_household_id uuid;
  v_account record;
  v_new_balance numeric;
BEGIN
  v_household_id := get_user_household_id();
  
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;
  
  FOR v_account IN 
    SELECT a.id, a.name, a.current_balance
    FROM public.accounts a
    WHERE a.household_id = v_household_id
  LOOP
    -- Get calculated balance using SSoT function
    v_new_balance := get_account_balance(v_account.id);
    
    -- Update if different
    IF ABS(v_new_balance - COALESCE(v_account.current_balance, 0)) > 0.001 THEN
      UPDATE public.accounts
      SET current_balance = v_new_balance,
          updated_at = now()
      WHERE id = v_account.id;
    END IF;
    
    -- Return the result
    account_id := v_account.id;
    account_name := v_account.name;
    old_balance := COALESCE(v_account.current_balance, 0);
    new_balance := v_new_balance;
    difference := v_new_balance - COALESCE(v_account.current_balance, 0);
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.sync_all_account_balances() TO authenticated;