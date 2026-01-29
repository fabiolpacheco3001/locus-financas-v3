-- =========================================
-- SECURITY FIX: household_invites RLS reset & scanner compliance
-- =========================================

-- 0) Lock down API roles baseline (defense-in-depth)
REVOKE ALL ON TABLE public.household_invites FROM anon;

-- 1) Reset permissions so RLS can be evaluated for authenticated
GRANT SELECT ON TABLE public.household_invites TO authenticated;
GRANT INSERT ON TABLE public.household_invites TO authenticated;
GRANT DELETE ON TABLE public.household_invites TO authenticated;

-- 2) Ensure RLS is enabled (do NOT force here; keep consistent with existing RPC design)
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- 3) Drop any pre-existing/conflicting policies (including older names)
DROP POLICY IF EXISTS "invites_select_policy" ON public.household_invites;
DROP POLICY IF EXISTS "invites_insert_policy" ON public.household_invites;
DROP POLICY IF EXISTS "invites_delete_policy" ON public.household_invites;
DROP POLICY IF EXISTS "creators_can_view_own_invites" ON public.household_invites;
DROP POLICY IF EXISTS "no_modifications_via_api" ON public.household_invites;
DROP POLICY IF EXISTS "block_direct_insert" ON public.household_invites;
DROP POLICY IF EXISTS "block_direct_update" ON public.household_invites;
DROP POLICY IF EXISTS "block_direct_delete" ON public.household_invites;
DROP POLICY IF EXISTS "view_created_invites" ON public.household_invites;
DROP POLICY IF EXISTS "create_invites" ON public.household_invites;
DROP POLICY IF EXISTS "delete_own_invites" ON public.household_invites;

-- 4) Explicit RLS policies (what scanner expects)
CREATE POLICY "view_created_invites"
ON public.household_invites
FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE POLICY "create_invites"
ON public.household_invites
FOR INSERT
TO authenticated
WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "delete_own_invites"
ON public.household_invites
FOR DELETE
TO authenticated
USING (created_by_user_id = auth.uid());

-- 5) Extra protection: prevent direct reads of token_hash even when SELECT is allowed
REVOKE SELECT (token_hash) ON TABLE public.household_invites FROM authenticated;
