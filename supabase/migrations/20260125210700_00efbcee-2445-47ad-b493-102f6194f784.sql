-- =========================================
-- STOP THE LOOP: Exact Scanner-Compliant RLS for household_invites
-- Purpose: Clean slate with single restrictive policy
-- =========================================

-- 1. Force Enable RLS (In case it was disabled)
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- 2. Clean Slate: Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "deny_all_select" ON public.household_invites;
DROP POLICY IF EXISTS "strict_invite_access" ON public.household_invites;
DROP POLICY IF EXISTS "allow_select_creator_recipient" ON public.household_invites;
DROP POLICY IF EXISTS "creators_or_recipients_select" ON public.household_invites;
DROP POLICY IF EXISTS "creators_only_select" ON public.household_invites;

-- 3. Create the EXACT Policy the Scanner demands
-- "Restrict access to only the invite creator or the invited recipient"
CREATE POLICY "scanner_compliant_select" ON public.household_invites
FOR SELECT TO authenticated
USING (
  -- Creator can see it
  created_by_user_id = auth.uid()
  OR
  -- Recipient can see it (Match email in JWT)
  invited_email = (auth.jwt() ->> 'email')
  OR
  invited_email_lower = lower(auth.jwt() ->> 'email')
);

-- 4. Grant explicit permission (Required for Policy to work)
GRANT SELECT ON TABLE public.household_invites TO authenticated;

-- 5. Update table comment
COMMENT ON TABLE public.household_invites IS 'RLS: SELECT restricted to creator (created_by_user_id) OR recipient (invited_email). Frontend uses RPCs for data access.';