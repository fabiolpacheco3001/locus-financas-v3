-- =========================================
-- SECURITY FIX: Column-Level Security & Membership Verification
-- =========================================

-- 1. Enable RLS (Standard)
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- 2. TOTAL PERMISSION RESET (Fixes "Token Theft")
-- Remove full read access from authenticated users
REVOKE SELECT ON TABLE public.household_invites FROM authenticated;

-- 3. SURGICAL GRANT (Column-Level Security)
-- Grant read permission ONLY for non-sensitive columns.
-- Note: 'token_hash' is NOT in this list - making it impossible to read via API.
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

-- 4. CLEANUP OLD POLICIES
DROP POLICY IF EXISTS "creators_only_select" ON public.household_invites;
DROP POLICY IF EXISTS "no_direct_select_access" ON public.household_invites;
DROP POLICY IF EXISTS "creators_can_view_own_invites" ON public.household_invites;
DROP POLICY IF EXISTS "admin_view_invites" ON public.household_invites;
DROP POLICY IF EXISTS "strict_admin_view_invites" ON public.household_invites;

-- 5. NEW POLICY WITH MEMBERSHIP VERIFICATION (Fixes "Harvesting")
-- Rule: You can see the invite IF:
-- (You created the invite) AND (You are still an Admin member of that household)
-- NOTE: Using member_identities + members join since user_id is in member_identities
CREATE POLICY "strict_admin_view_invites"
ON public.household_invites
FOR SELECT
TO authenticated
USING (
    created_by_user_id = auth.uid()
    AND EXISTS (
        SELECT 1 
        FROM public.member_identities mi
        JOIN public.members m ON m.id = mi.member_id
        WHERE mi.user_id = auth.uid()
        AND m.household_id = household_invites.household_id
        AND m.role = 'ADMIN'
    )
);

-- 6. MAINTAIN WRITE POLICIES (Standard)
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

DROP POLICY IF EXISTS "invites_are_immutable" ON public.household_invites;
CREATE POLICY "invites_are_immutable" 
ON public.household_invites 
FOR UPDATE 
TO authenticated 
USING (false) 
WITH CHECK (false);