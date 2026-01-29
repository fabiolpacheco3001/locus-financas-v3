-- =========================================
-- TOTAL RPC LOCKDOWN: Zero Direct Access to household_invites
-- =========================================

-- 1. Drop ALL existing SELECT policies (clean slate)
DROP POLICY IF EXISTS "strict_invite_visibility" ON public.household_invites;
DROP POLICY IF EXISTS "view_invites_by_id_secure" ON public.household_invites;
DROP POLICY IF EXISTS "view_invites_creator_or_recipient" ON public.household_invites;
DROP POLICY IF EXISTS "Users can view their own invites" ON public.household_invites;
DROP POLICY IF EXISTS "Users can view invites sent to them" ON public.household_invites;

-- 2. Create a blanket DENY ALL SELECT policy
-- This ensures NO direct queries can succeed, even if GRANT exists
CREATE POLICY "deny_all_select" ON public.household_invites
FOR SELECT USING (false);

-- 3. Revoke SELECT grants from all roles (belt and suspenders)
REVOKE SELECT ON TABLE public.household_invites FROM authenticated;
REVOKE SELECT ON TABLE public.household_invites FROM anon;

-- 4. Ensure all RPC functions have SECURITY DEFINER (already set, but explicit)
-- This allows RPCs to bypass RLS while users cannot
ALTER FUNCTION public.get_my_pending_invites() SECURITY DEFINER;
ALTER FUNCTION public.list_household_invites(uuid) SECURITY DEFINER;
ALTER FUNCTION public.create_household_invite(text, text, integer) SECURITY DEFINER;
ALTER FUNCTION public.accept_household_invite(text) SECURITY DEFINER;
ALTER FUNCTION public.accept_household_invite_by_id(uuid) SECURITY DEFINER;
ALTER FUNCTION public.delete_household_invite(uuid) SECURITY DEFINER;
ALTER FUNCTION public.get_household_invite_preview(text) SECURITY DEFINER;

-- 5. Add documentation comment
COMMENT ON TABLE public.household_invites IS 'SECURITY LOCKED: Zero direct access. All operations MUST use RPCs (get_my_pending_invites, list_household_invites, create_household_invite, accept_household_invite, delete_household_invite). Direct SELECT/UPDATE/INSERT blocked by RLS.';