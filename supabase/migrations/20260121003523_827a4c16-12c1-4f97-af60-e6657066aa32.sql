-- =========================================
-- SECURITY FIX: Privacy Lockdown & Immutability
-- =========================================

-- 1. Ensure RLS is enabled
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "secure_view_invites_creator_or_recipient" ON public.household_invites;
DROP POLICY IF EXISTS "view_created_invites" ON public.household_invites;
DROP POLICY IF EXISTS "select_own_invites" ON public.household_invites;
DROP POLICY IF EXISTS "creators_can_view_own_invites" ON public.household_invites;
DROP POLICY IF EXISTS "invites_update_policy" ON public.household_invites;
DROP POLICY IF EXISTS "create_invites_secure" ON public.household_invites;
DROP POLICY IF EXISTS "delete_invites_secure" ON public.household_invites;
DROP POLICY IF EXISTS "creators_only_select" ON public.household_invites;
DROP POLICY IF EXISTS "creators_only_insert" ON public.household_invites;
DROP POLICY IF EXISTS "creators_only_delete" ON public.household_invites;
DROP POLICY IF EXISTS "invites_are_immutable" ON public.household_invites;

-- 3. SELECT: Only creators can view invites (recipients use RPC)
CREATE POLICY "creators_only_select"
ON public.household_invites
FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

-- 4. UPDATE: Invites are immutable (no edits allowed)
CREATE POLICY "invites_are_immutable"
ON public.household_invites
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- 5. INSERT: Only creators can insert
CREATE POLICY "creators_only_insert"
ON public.household_invites
FOR INSERT
TO authenticated
WITH CHECK (created_by_user_id = auth.uid());

-- 6. DELETE: Only creators can delete
CREATE POLICY "creators_only_delete"
ON public.household_invites
FOR DELETE
TO authenticated
USING (created_by_user_id = auth.uid());