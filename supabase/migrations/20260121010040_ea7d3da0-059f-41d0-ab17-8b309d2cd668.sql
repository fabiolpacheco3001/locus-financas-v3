-- =========================================
-- FINAL SECURITY FIX: ID-Based Access Only (No Emails)
-- =========================================

-- 1. Final Policy Cleanup
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creators_strict_view" ON public.household_invites;
DROP POLICY IF EXISTS "view_invites_creator_or_recipient" ON public.household_invites;
DROP POLICY IF EXISTS "select_household_invites" ON public.household_invites;
DROP POLICY IF EXISTS "view_invites_by_id_secure" ON public.household_invites;

-- 2. NEW HYBRID POLICY (ID-BASED)
-- Allows SELECT if:
-- A) User created the invite.
-- B) OR user HAS ALREADY ACCEPTED the invite (secure binding by ID, not email).
CREATE POLICY "view_invites_by_id_secure"
ON public.household_invites
FOR SELECT
TO authenticated
USING (
    created_by_user_id = auth.uid()
    OR
    accepted_by_user_id = auth.uid()
);

-- 3. MAINTAIN COLUMN SECURITY (Crucial)
-- Continue blocking access to 'token_hash' column to avoid "Token Theft" error.
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
    created_by_user_id,
    accepted_by_user_id
) ON TABLE public.household_invites TO authenticated;