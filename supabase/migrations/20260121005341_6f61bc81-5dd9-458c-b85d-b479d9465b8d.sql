-- =========================================
-- SECURITY REFINEMENT: Restore Recipient Access (Safe Mode)
-- =========================================

-- 1. Remove restrictive previous policies
DROP POLICY IF EXISTS "strict_admin_view_invites" ON public.household_invites;
DROP POLICY IF EXISTS "creators_only_select" ON public.household_invites;
DROP POLICY IF EXISTS "view_invites_creator_or_recipient" ON public.household_invites;

-- 2. Create Balanced Policy (Creator OR Recipient)
-- Allows viewing if:
-- A) You created the invite.
-- B) The invite was sent to YOUR current email.
CREATE POLICY "view_invites_creator_or_recipient"
ON public.household_invites
FOR SELECT
TO authenticated
USING (
    created_by_user_id = auth.uid()
    OR
    invited_email_lower = public.jwt_email_lower()
);

-- 3. REINFORCEMENT: Ensure Column Security (VERY IMPORTANT)
-- Reaffirm that even with the policy above, 'token_hash' is INVISIBLE via API.
-- This prevents the access reopening from generating "Token Theft" error.
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
    -- Note: token_hash is INTENTIONALLY EXCLUDED
) ON TABLE public.household_invites TO authenticated;