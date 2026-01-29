-- =========================================================
-- A) member_identities: RLS + INSERT only via RPC context flag
-- =========================================================

ALTER TABLE public.member_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_identities FORCE ROW LEVEL SECURITY;

-- Minimal grants
REVOKE ALL ON TABLE public.member_identities FROM anon;
GRANT SELECT ON TABLE public.member_identities TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.member_identities FROM authenticated;

-- Remove old policies
DROP POLICY IF EXISTS "mi_insert_none" ON public.member_identities;
DROP POLICY IF EXISTS "mi_insert_own" ON public.member_identities;
DROP POLICY IF EXISTS "member_identities_insert_bootstrap_only" ON public.member_identities;
DROP POLICY IF EXISTS "mi_select_own" ON public.member_identities;
DROP POLICY IF EXISTS "mi_update_none" ON public.member_identities;
DROP POLICY IF EXISTS "mi_delete_none" ON public.member_identities;

-- SELECT own identity
CREATE POLICY "mi_select_own"
ON public.member_identities
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- UPDATE always blocked
CREATE POLICY "mi_update_none"
ON public.member_identities
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- DELETE always blocked
CREATE POLICY "mi_delete_none"
ON public.member_identities
FOR DELETE
TO authenticated
USING (false);

-- INSERT only via RPC context flag
CREATE POLICY "mi_insert_via_rpc_only"
ON public.member_identities
FOR INSERT
TO public
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (SELECT 1 FROM public.member_identities mi WHERE mi.user_id = auth.uid())
  AND current_setting('app.identity_write', true) IN ('bootstrap', 'invite')
);

-- Unique constraint on user_id
CREATE UNIQUE INDEX IF NOT EXISTS member_identities_user_id_uniq
  ON public.member_identities(user_id);

-- =========================================================
-- B) Update create_member_identity RPC to set context flag
-- =========================================================

CREATE OR REPLACE FUNCTION public.create_member_identity(
  p_household_id uuid,
  p_member_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- User must not already have an identity
  IF EXISTS (SELECT 1 FROM public.member_identities WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'identity_already_exists';
  END IF;

  -- Household must exist
  IF NOT EXISTS (SELECT 1 FROM public.households h WHERE h.id = p_household_id) THEN
    RAISE EXCEPTION 'household_not_found';
  END IF;

  -- Member must exist and belong to this household
  IF NOT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = p_member_id
      AND m.household_id = p_household_id
  ) THEN
    RAISE EXCEPTION 'member_not_found_or_mismatch';
  END IF;

  -- SECURITY: Only allow if household has NO existing identities (bootstrap only)
  IF EXISTS (
    SELECT 1
    FROM public.member_identities mi
    WHERE mi.household_id = p_household_id
  ) THEN
    RAISE EXCEPTION 'household_requires_invite';
  END IF;

  -- Set context flag to allow INSERT
  PERFORM set_config('app.identity_write', 'bootstrap', true);

  -- All checks passed - create the identity
  INSERT INTO public.member_identities (user_id, household_id, member_id)
  VALUES (auth.uid(), p_household_id, p_member_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_member_identity(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.create_member_identity(uuid, uuid) TO authenticated;

-- =========================================================
-- C) Update accept_household_invite RPC to set context flag
-- =========================================================

CREATE OR REPLACE FUNCTION public.accept_household_invite(p_token text)
RETURNS TABLE(household_id uuid, member_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_new_member_id UUID;
  v_user_email TEXT;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- User must not already have an identity
  IF EXISTS (SELECT 1 FROM public.member_identities WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'identity_already_exists';
  END IF;

  -- Find valid invite
  SELECT hi.* INTO v_invite
  FROM public.household_invites hi
  WHERE hi.token = p_token
    AND hi.used_at IS NULL
    AND hi.expires_at > now();

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'invite_invalid_or_expired';
  END IF;

  -- Get user email from JWT for member name
  v_user_email := auth.jwt() ->> 'email';

  -- Create member for this user
  INSERT INTO public.members (household_id, name, role)
  VALUES (v_invite.household_id, COALESCE(split_part(v_user_email, '@', 1), 'Novo Membro'), 'MEMBER')
  RETURNING id INTO v_new_member_id;

  -- Set context flag to allow INSERT
  PERFORM set_config('app.identity_write', 'invite', true);

  -- Create identity link
  INSERT INTO public.member_identities (user_id, household_id, member_id)
  VALUES (auth.uid(), v_invite.household_id, v_new_member_id);

  -- Mark invite as used
  UPDATE public.household_invites
  SET used_at = now(), used_by = auth.uid()
  WHERE id = v_invite.id;

  -- Return the new context
  RETURN QUERY SELECT v_invite.household_id, v_new_member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_household_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_household_invite(text) TO authenticated;