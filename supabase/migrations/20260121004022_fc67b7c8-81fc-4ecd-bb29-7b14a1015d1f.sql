-- =========================================
-- FIX: Restore table grants for RLS to work
-- =========================================

-- Grant permissions to authenticated role so RLS policies can be evaluated
GRANT SELECT, INSERT, DELETE ON TABLE public.household_invites TO authenticated;

-- Keep anon locked out (no access at all)
REVOKE ALL ON TABLE public.household_invites FROM anon;