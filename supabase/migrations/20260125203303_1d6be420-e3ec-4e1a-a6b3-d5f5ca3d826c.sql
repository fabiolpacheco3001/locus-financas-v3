-- PART 1: CRITICAL SECURITY FIX for household_invites
-- Drop existing SELECT policies that may be too permissive
DROP POLICY IF EXISTS "view_invites_by_id_secure" ON public.household_invites;
DROP POLICY IF EXISTS "Users can view their invites" ON public.household_invites;
DROP POLICY IF EXISTS "Creators can view their invites" ON public.household_invites;

-- Create strict SELECT policy: ONLY sender OR recipient can see the invite
-- Sender: created_by_user_id = auth.uid()
-- Recipient: invited_email_lower = jwt_email_lower()
CREATE POLICY "strict_invite_visibility"
ON public.household_invites
FOR SELECT
USING (
  (created_by_user_id = auth.uid())
  OR 
  (invited_email_lower IS NOT NULL AND invited_email_lower = jwt_email_lower())
);

-- Ensure INSERT, UPDATE, DELETE policies remain strict
-- INSERT: Only authenticated users can create invites for themselves
DROP POLICY IF EXISTS "creators_only_insert" ON public.household_invites;
CREATE POLICY "creators_only_insert"
ON public.household_invites
FOR INSERT
WITH CHECK (created_by_user_id = auth.uid());

-- UPDATE: Invites are immutable (no updates allowed)
DROP POLICY IF EXISTS "invites_are_immutable" ON public.household_invites;
CREATE POLICY "invites_are_immutable"
ON public.household_invites
FOR UPDATE
USING (false)
WITH CHECK (false);

-- DELETE: Only creator can delete their own invites
DROP POLICY IF EXISTS "creators_only_delete" ON public.household_invites;
CREATE POLICY "creators_only_delete"
ON public.household_invites
FOR DELETE
USING (created_by_user_id = auth.uid());