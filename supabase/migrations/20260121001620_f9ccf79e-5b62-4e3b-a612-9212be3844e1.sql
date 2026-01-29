-- =========================================
-- SECURITY FIX: Explicit RLS Policies for Scanner Compliance
-- =========================================

-- =============================================
-- 1. FIX: household_invites - Explicit RLS Policies
-- =============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "invites_delete_none" ON public.household_invites;
DROP POLICY IF EXISTS "invites_select_creator" ON public.household_invites;
DROP POLICY IF EXISTS "invites_insert_none" ON public.household_invites;
DROP POLICY IF EXISTS "invites_update_none" ON public.household_invites;
DROP POLICY IF EXISTS "creators_can_view_own_invites" ON public.household_invites;
DROP POLICY IF EXISTS "no_modifications_via_api" ON public.household_invites;

-- Ensure RLS is enabled
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites FORCE ROW LEVEL SECURITY;

-- Policy: Creators can view their own invites
CREATE POLICY "creators_can_view_own_invites"
ON public.household_invites
FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

-- Policy: Block all INSERT via direct API (force RPC usage)
CREATE POLICY "block_direct_insert"
ON public.household_invites
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE(current_setting('app.household_invites_insert', true), '') = 'true'
  AND created_by_user_id = auth.uid()
);

-- Policy: Block all UPDATE via direct API (force RPC usage)
CREATE POLICY "block_direct_update"
ON public.household_invites
FOR UPDATE
TO authenticated
USING (
  COALESCE(current_setting('app.household_invites_update', true), '') = 'true'
)
WITH CHECK (
  COALESCE(current_setting('app.household_invites_update', true), '') = 'true'
);

-- Policy: Block all DELETE via direct API
CREATE POLICY "block_direct_delete"
ON public.household_invites
FOR DELETE
TO authenticated
USING (
  COALESCE(current_setting('app.household_invites_delete', true), '') = 'true'
);

-- =============================================
-- 2. FIX: member_identities - RESTRICTIVE Policy
-- =============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "member_identities_admin_delete" ON public.member_identities;
DROP POLICY IF EXISTS "mi_insert_none" ON public.member_identities;
DROP POLICY IF EXISTS "member_identities_select_own" ON public.member_identities;
DROP POLICY IF EXISTS "member_identities_insert_via_rpc" ON public.member_identities;
DROP POLICY IF EXISTS "member_identities_update_block" ON public.member_identities;
DROP POLICY IF EXISTS "restrict_access_to_own_identity" ON public.member_identities;
DROP POLICY IF EXISTS "users_can_manage_own_identity" ON public.member_identities;
DROP POLICY IF EXISTS "member_identities_delete_block" ON public.member_identities;

-- Ensure RLS is enabled
ALTER TABLE public.member_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_identities FORCE ROW LEVEL SECURITY;

-- RESTRICTIVE policy: Master filter - only own identity or same household for admins
CREATE POLICY "restrict_to_own_or_household"
ON public.member_identities
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  user_id = auth.uid() 
  OR household_id = public.get_user_household_id()
);

-- Permissive SELECT: Users can view their own identity
CREATE POLICY "select_own_identity"
ON public.member_identities
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Permissive INSERT: Only via RPC (flag-gated)
CREATE POLICY "insert_via_rpc_only"
ON public.member_identities
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND COALESCE(current_setting('app.member_identities_insert', true), '') = 'true'
);

-- Permissive UPDATE: Block all updates
CREATE POLICY "block_all_updates"
ON public.member_identities
FOR UPDATE
TO authenticated
USING (false);

-- Permissive DELETE: Admins can delete other members (not themselves)
CREATE POLICY "admin_delete_members"
ON public.member_identities
FOR DELETE
TO authenticated
USING (
  household_id = public.get_user_household_id()
  AND public.is_household_admin()
  AND user_id <> auth.uid()
);