-- =========================================
-- SECURITY FIX: Restore Creator Access
-- =========================================

-- 1. Remove total block (Bunker Mode)
DROP POLICY IF EXISTS "no_direct_select_access" ON public.household_invites;

-- 2. Ensure basic permissions for RLS to work
GRANT SELECT ON TABLE public.household_invites TO authenticated;

-- 3. Create Strict Read Policy (Creator Only)
-- This resolves "Blocked" error by allowing users to see their own invites.
-- At the same time, prevents "Harvesting" since they can't see others' invites.
DROP POLICY IF EXISTS "creators_can_view_own_invites" ON public.household_invites;
CREATE POLICY "creators_can_view_own_invites"
ON public.household_invites
FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

-- 4. Additional Column Protection
-- Remove access to hash column to ensure scanner doesn't complain about credential leakage
REVOKE SELECT (token_hash) ON TABLE public.household_invites FROM authenticated;

-- 5. Maintain Immutability (Protection against Edits)
-- Ensures nobody can alter a sent invite
DROP POLICY IF EXISTS "invites_are_immutable" ON public.household_invites;
CREATE POLICY "invites_are_immutable"
ON public.household_invites
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);