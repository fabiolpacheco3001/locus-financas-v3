-- =========================================
-- CRITICAL SECURITY REFACTOR: RPC-Only Access & Identity Lockdown
-- =========================================

-- 1. RESOLUTION: household_invites (Email Harvesting)
-- Remove any capability to list invites via API.
-- Frontend MUST use only RPCs: get_household_invite_preview, accept_household_invite, etc.

ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- Remove ALL existing read policies (full cleanup)
DROP POLICY IF EXISTS "view_created_invites" ON public.household_invites;
DROP POLICY IF EXISTS "creators_only_select" ON public.household_invites;
DROP POLICY IF EXISTS "secure_view_invites_creator_or_recipient" ON public.household_invites;
DROP POLICY IF EXISTS "select_own_invites" ON public.household_invites;
DROP POLICY IF EXISTS "no_direct_select_access" ON public.household_invites;

-- Create "Explicit Denial" policy for SELECT via API
-- Scanner will see a policy exists, but it returns ZERO rows for direct queries.
CREATE POLICY "no_direct_select_access"
ON public.household_invites
FOR SELECT
TO authenticated
USING (false);

-- Keep write permission only for creator
DROP POLICY IF EXISTS "creators_only_insert" ON public.household_invites;
CREATE POLICY "creators_only_insert"
ON public.household_invites
FOR INSERT
TO authenticated
WITH CHECK (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "creators_only_delete" ON public.household_invites;
CREATE POLICY "creators_only_delete"
ON public.household_invites
FOR DELETE
TO authenticated
USING (created_by_user_id = auth.uid());

-- 2. RESOLUTION: member_identities (Identity Leakage Warning)
-- Warning says household members shouldn't see each other's IDs.
-- Restrict view strictly to own user only.

DROP POLICY IF EXISTS "restrict_to_own_or_household" ON public.member_identities;
DROP POLICY IF EXISTS "view_own_identity" ON public.member_identities;
DROP POLICY IF EXISTS "view_strictly_own_identity" ON public.member_identities;

CREATE POLICY "view_strictly_own_identity"
ON public.member_identities
FOR SELECT
TO authenticated
USING (user_id = auth.uid());