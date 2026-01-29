-- =========================================
-- SECURITY COMPLIANCE FIX: Replace deny_all_select with Standard RLS
-- Purpose: Satisfy security linter while maintaining RPC-based access pattern
-- =========================================

-- 1. Drop the overly restrictive deny_all_select policy
DROP POLICY IF EXISTS "deny_all_select" ON public.household_invites;

-- 2. Create compliant RLS policy allowing sender OR recipient access
-- This satisfies the security scanner requirement
-- Frontend still uses RPCs for actual data access (get_my_pending_invites, list_household_invites)
CREATE POLICY "creators_or_recipients_select" ON public.household_invites
FOR SELECT
USING (
  created_by_user_id = auth.uid()
  OR invited_email_lower = jwt_email_lower()
);

-- 3. Re-grant SELECT permission (was revoked in previous migration)
GRANT SELECT ON TABLE public.household_invites TO authenticated;

-- 4. Update table comment
COMMENT ON TABLE public.household_invites IS 'SECURITY: RLS restricts access to sender (created_by_user_id) or recipient (invited_email_lower). Frontend uses RPCs for controlled access patterns.';