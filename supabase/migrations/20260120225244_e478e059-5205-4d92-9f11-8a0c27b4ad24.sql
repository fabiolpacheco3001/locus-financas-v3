-- =========================================
-- PATCH: Secure invite inbox with email-based visibility
-- - jwt_email_lower() helper function
-- - RLS policies for invited email visibility
-- - New accept_household_invite_by_id RPC for inbox flow
-- =========================================

-- 1) Helper function: get email from JWT (lowercase)
CREATE OR REPLACE FUNCTION public.jwt_email_lower()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower((auth.jwt() ->> 'email')::text);
$$;

-- 2) Ensure token column is dropped/nulled (if exists) - safety measure
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'household_invites' AND column_name = 'token'
  ) THEN
    -- Null out any remaining plain-text tokens
    UPDATE public.household_invites SET token = NULL WHERE token IS NOT NULL;
    -- Drop the column for security
    ALTER TABLE public.household_invites DROP COLUMN IF EXISTS token;
  END IF;
END $$;

-- 3) Drop old policies and create new secure ones
DROP POLICY IF EXISTS "household_invites_select_creator" ON public.household_invites;
DROP POLICY IF EXISTS "household_invites_select_invited_email" ON public.household_invites;
DROP POLICY IF EXISTS "invites_select_creator" ON public.household_invites;
DROP POLICY IF EXISTS "invites_select_invited_email" ON public.household_invites;
DROP POLICY IF EXISTS "household_invites_insert_via_rpc" ON public.household_invites;
DROP POLICY IF EXISTS "household_invites_update_via_rpc" ON public.household_invites;
DROP POLICY IF EXISTS "household_invites_delete_via_rpc" ON public.household_invites;

-- SELECT policy: creator can see invites they created
CREATE POLICY "invites_select_creator"
ON public.household_invites
FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

-- SELECT policy: invitee can see pending invites addressed to their email
CREATE POLICY "invites_select_invited_email"
ON public.household_invites
FOR SELECT
TO authenticated
USING (
  invited_email_lower = public.jwt_email_lower()
  AND accepted_at IS NULL
  AND (expires_at IS NULL OR expires_at > now())
);

-- INSERT/UPDATE/DELETE: only via RPC (context flags)
CREATE POLICY "household_invites_insert_via_rpc"
ON public.household_invites
FOR INSERT
TO authenticated
WITH CHECK (
  created_by_user_id = auth.uid()
  AND coalesce(current_setting('app.household_invites_insert', true), '') = 'true'
);

CREATE POLICY "household_invites_update_via_rpc"
ON public.household_invites
FOR UPDATE
TO authenticated
USING (
  coalesce(current_setting('app.household_invites_update', true), '') = 'true'
)
WITH CHECK (
  coalesce(current_setting('app.household_invites_update', true), '') = 'true'
);

CREATE POLICY "household_invites_delete_via_rpc"
ON public.household_invites
FOR DELETE
TO authenticated
USING (
  coalesce(current_setting('app.household_invites_delete', true), '') = 'true'
);

-- 4) RPC: accept invite by ID (for inbox flow - no token needed)
CREATE OR REPLACE FUNCTION public.accept_household_invite_by_id(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_member_id uuid;
  v_email text;
BEGIN
  -- Validate authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Check if user already has an identity
  IF EXISTS (SELECT 1 FROM public.member_identities WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'identity_already_exists';
  END IF;

  -- Get caller's email from JWT
  v_email := public.jwt_email_lower();

  -- Find the invite
  SELECT * INTO v_invite
  FROM public.household_invites hi
  WHERE hi.id = p_invite_id
  LIMIT 1;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  -- Validate expiration
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  -- Validate not already accepted
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_already_used';
  END IF;

  -- Validate email match (required for inbox flow)
  IF v_invite.invited_email_lower IS NULL OR v_email <> v_invite.invited_email_lower THEN
    RAISE EXCEPTION 'invite_email_mismatch';
  END IF;

  -- Create member
  INSERT INTO public.members (household_id, name, role)
  VALUES (
    v_invite.household_id,
    coalesce(split_part(v_invite.invited_email, '@', 1), 'Novo Membro'),
    coalesce(v_invite.role, 'MEMBER')::member_role
  )
  RETURNING id INTO v_member_id;

  -- Mark invite as accepted
  PERFORM set_config('app.household_invites_update', 'true', true);
  UPDATE public.household_invites
  SET accepted_at = now(),
      accepted_by_user_id = auth.uid()
  WHERE id = v_invite.id;

  -- Create member identity link
  PERFORM set_config('app.member_identities_insert', 'true', true);
  INSERT INTO public.member_identities (user_id, household_id, member_id)
  VALUES (auth.uid(), v_invite.household_id, v_member_id);

  RETURN v_invite.household_id;
END $$;

-- 5) RPC: get pending invites for current user (via email)
CREATE OR REPLACE FUNCTION public.get_my_pending_invites()
RETURNS TABLE (
  id uuid,
  household_id uuid,
  role text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    hi.id,
    hi.household_id,
    hi.role,
    hi.expires_at,
    hi.created_at
  FROM public.household_invites hi
  WHERE hi.invited_email_lower = public.jwt_email_lower()
    AND hi.accepted_at IS NULL
    AND (hi.expires_at IS NULL OR hi.expires_at > now())
  ORDER BY hi.created_at DESC;
$$;