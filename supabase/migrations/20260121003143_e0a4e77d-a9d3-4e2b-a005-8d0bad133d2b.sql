-- =========================================
-- FINAL SECURITY FIX: Dual-Condition RLS (Creator OR Recipient)
-- =========================================

-- 1. Ensure RLS is enabled
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing SELECT/INSERT/DELETE policies to avoid conflicts
DROP POLICY IF EXISTS "view_created_invites" ON public.household_invites;
DROP POLICY IF EXISTS "creators_can_view_own_invites" ON public.household_invites;
DROP POLICY IF EXISTS "invites_select_policy" ON public.household_invites;
DROP POLICY IF EXISTS "select_own_invites" ON public.household_invites;
DROP POLICY IF EXISTS "secure_view_invites_creator_or_recipient" ON public.household_invites;
DROP POLICY IF EXISTS "create_invites" ON public.household_invites;
DROP POLICY IF EXISTS "create_invites_secure" ON public.household_invites;
DROP POLICY IF EXISTS "delete_invites" ON public.household_invites;
DROP POLICY IF EXISTS "delete_invites_secure" ON public.household_invites;
DROP POLICY IF EXISTS "delete_own_invites" ON public.household_invites;

-- 3. CREATE THE DEFINITIVE SELECT POLICY (Creator OR Recipient)
-- Allows SELECT if:
-- A) User is the invite creator (created_by_user_id)
-- B) OR the invite's email matches the logged-in user's email (case-insensitive)
CREATE POLICY "secure_view_invites_creator_or_recipient"
ON public.household_invites
FOR SELECT
TO authenticated
USING (
  created_by_user_id = auth.uid() 
  OR 
  invited_email_lower = public.jwt_email_lower()
);

-- 4. Keep write policies restricted to creator only
CREATE POLICY "create_invites_secure"
ON public.household_invites
FOR INSERT
TO authenticated
WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "delete_invites_secure"
ON public.household_invites
FOR DELETE
TO authenticated
USING (created_by_user_id = auth.uid());