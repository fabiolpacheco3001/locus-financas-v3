-- Fix security warnings: Set search_path for all new functions

ALTER FUNCTION public.get_account_balance(uuid) SET search_path = public;
ALTER FUNCTION public.get_accounts_with_balances() SET search_path = public;
ALTER FUNCTION public.force_update_account_balance(uuid, numeric) SET search_path = public;
ALTER FUNCTION public.sync_all_account_balances() SET search_path = public;