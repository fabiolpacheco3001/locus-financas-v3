-- =========================================
-- FINAL SECURITY OVERHAUL: Enforce RPC-Only Mutations & Reads
-- =========================================

-- 1. FIX: member_identities (Manipulation Risk)
-- Block direct INSERT. Member addition must occur EXCLUSIVELY via RPC 'accept_household_invite'.
ALTER TABLE public.member_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_member_identity" ON public.member_identities;
DROP POLICY IF EXISTS "users_insert_own_identity" ON public.member_identities;
DROP POLICY IF EXISTS "insert_via_rpc_only" ON public.member_identities;
DROP POLICY IF EXISTS "enforce_rpc_insert_only" ON public.member_identities;

-- Create policy that blocks all direct inserts (RPC uses SECURITY DEFINER to bypass)
CREATE POLICY "enforce_rpc_insert_only"
ON public.member_identities
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND COALESCE(current_setting('app.member_identities_insert', true), '') = 'true'
);

-- 2. FIX: household_invites (Token Theft & Email Exposure)
-- Revert to STRICT creator access and use RPC for recipient flow.

-- A) Cleanup insecure policies
DROP POLICY IF EXISTS "view_invites_creator_or_recipient" ON public.household_invites;
DROP POLICY IF EXISTS "select_own_invites" ON public.household_invites;
DROP POLICY IF EXISTS "creators_strict_view" ON public.household_invites;

-- B) Strict Read Policy (Only Admin/Creator sees what they sent)
CREATE POLICY "creators_strict_view"
ON public.household_invites
FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

-- C) Column Security (Extra Layer)
-- Ensures that even if policy fails, 'token_hash' column is never sent via API.
REVOKE SELECT ON TABLE public.household_invites FROM authenticated;

GRANT SELECT (
    id, 
    household_id, 
    invited_email, 
    invited_email_lower,
    role, 
    created_at, 
    expires_at, 
    accepted_at,
    created_by_user_id
) ON TABLE public.household_invites TO authenticated;