-- =========================================
-- PATCH: Secure household_invites RLS + accept by ID
-- =========================================

-- 0) Ensure pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Helper: email from JWT (lowercase) - simpler version
CREATE OR REPLACE FUNCTION public.jwt_email_lower()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower((auth.jwt() ->> 'email')::text);
$$;

-- 2) Ensure RLS is enabled
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- 3) Drop conflicting policies
DROP POLICY IF EXISTS "invites_select_none" ON public.household_invites;
DROP POLICY IF EXISTS "invites_select_creator" ON public.household_invites;
DROP POLICY IF EXISTS "invites_select_invited_email" ON public.household_invites;
DROP POLICY IF EXISTS "invites_insert_none" ON public.household_invites;
DROP POLICY IF EXISTS "invites_update_none" ON public.household_invites;
DROP POLICY IF EXISTS "invites_delete_none" ON public.household_invites;
DROP POLICY IF EXISTS "household_invites_insert_via_rpc" ON public.household_invites;
DROP POLICY IF EXISTS "household_invites_update_via_rpc" ON public.household_invites;
DROP POLICY IF EXISTS "household_invites_delete_via_rpc" ON public.household_invites;

-- 4) Policy: creator can see invites they created
CREATE POLICY "invites_select_creator"
ON public.household_invites
FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

-- 5) Policy: invitee can see ONLY invites for THEIR email (pending and valid)
CREATE POLICY "invites_select_invited_email"
ON public.household_invites
FOR SELECT
TO authenticated
USING (
  invited_email_lower IS NOT NULL
  AND public.jwt_email_lower() IS NOT NULL
  AND invited_email_lower = public.jwt_email_lower()
  AND accepted_at IS NULL
  AND (expires_at IS NULL OR expires_at > now())
);

-- 6) Block direct INSERT/UPDATE/DELETE (only via RPC with context flags)
CREATE POLICY "invites_insert_none"
ON public.household_invites
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow via RPC only when context flag is set
  COALESCE(current_setting('app.household_invites_insert', true), '') = 'true'
  AND created_by_user_id = auth.uid()
);

CREATE POLICY "invites_update_none"
ON public.household_invites
FOR UPDATE
TO authenticated
USING (
  COALESCE(current_setting('app.household_invites_update', true), '') = 'true'
)
WITH CHECK (
  COALESCE(current_setting('app.household_invites_update', true), '') = 'true'
);

CREATE POLICY "invites_delete_none"
ON public.household_invites
FOR DELETE
TO authenticated
USING (
  COALESCE(current_setting('app.household_invites_delete', true), '') = 'true'
);

-- 7) Drop old accept function if exists (different signature)
DROP FUNCTION IF EXISTS public.accept_household_invite_by_id(uuid);

-- 8) RPC: accept invite by ID (inbox flow - no token needed)
CREATE OR REPLACE FUNCTION public.accept_household_invite_by_id(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_invite record;
  v_member_id uuid;
BEGIN
  -- Get caller's email from JWT
  v_email := public.jwt_email_lower();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'missing_email_claim';
  END IF;

  -- Check if user already has an identity
  IF EXISTS (SELECT 1 FROM public.member_identities WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'identity_already_exists';
  END IF;

  -- Lock and validate invite
  SELECT * INTO v_invite
  FROM public.household_invites
  WHERE id = p_invite_id
    AND invited_email_lower IS NOT NULL
    AND invited_email_lower = v_email
    AND accepted_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_invite';
  END IF;

  -- Create member
  INSERT INTO public.members (household_id, name, role)
  VALUES (
    v_invite.household_id,
    COALESCE(split_part(v_invite.invited_email, '@', 1), 'Novo Membro'),
    COALESCE(v_invite.role, 'MEMBER')::member_role
  )
  RETURNING id INTO v_member_id;

  -- Mark invite as accepted
  PERFORM set_config('app.household_invites_update', 'true', true);
  UPDATE public.household_invites
  SET accepted_at = now(),
      accepted_by_user_id = auth.uid()
  WHERE id = p_invite_id;

  -- Create member identity link
  PERFORM set_config('app.member_identities_insert', 'true', true);
  INSERT INTO public.member_identities (user_id, household_id, member_id)
  VALUES (auth.uid(), v_invite.household_id, v_member_id);

  RETURN v_invite.household_id;
END;
$$;

-- 9) Grant execute permission
GRANT EXECUTE ON FUNCTION public.accept_household_invite_by_id(uuid) TO authenticated;