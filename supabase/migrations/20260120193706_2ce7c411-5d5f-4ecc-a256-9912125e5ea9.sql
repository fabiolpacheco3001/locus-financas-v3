-- PATCH: Secure member_identities creation (bootstrap + invite only)

-- 1) Create household_invites table for invite tokens
CREATE TABLE IF NOT EXISTS public.household_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMP WITH TIME ZONE,
  used_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on household_invites
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites FORCE ROW LEVEL SECURITY;

-- RLS policies for household_invites
CREATE POLICY "hi_select_own_household"
ON public.household_invites
FOR SELECT
TO authenticated
USING (household_id = get_user_household_id());

CREATE POLICY "hi_insert_admin_only"
ON public.household_invites
FOR INSERT
TO authenticated
WITH CHECK (
  household_id = get_user_household_id()
  AND is_household_admin()
);

CREATE POLICY "hi_delete_admin_only"
ON public.household_invites
FOR DELETE
TO authenticated
USING (
  household_id = get_user_household_id()
  AND is_household_admin()
);

-- No update allowed (immutable tokens)
CREATE POLICY "hi_update_none"
ON public.household_invites
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- 2) Update create_member_identity to only allow bootstrap (empty household)
CREATE OR REPLACE FUNCTION public.create_member_identity(p_household_id uuid, p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- All checks passed - create the identity
  INSERT INTO public.member_identities (user_id, household_id, member_id)
  VALUES (auth.uid(), p_household_id, p_member_id);
END;
$$;

-- 3) Create accept_household_invite function for joining existing households
CREATE OR REPLACE FUNCTION public.accept_household_invite(p_token text)
RETURNS TABLE(household_id uuid, member_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- 4) Create function to generate invite (admin only, enforced by RLS on table)
CREATE OR REPLACE FUNCTION public.create_household_invite()
RETURNS TABLE(token text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_household_id UUID;
  v_member_id UUID;
  v_token TEXT;
  v_expires TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get caller's context
  SELECT mi.household_id, mi.member_id INTO v_household_id, v_member_id
  FROM public.member_identities mi
  WHERE mi.user_id = auth.uid();

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'not_in_household';
  END IF;

  -- Must be admin
  IF NOT public.is_household_admin() THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  -- Generate invite
  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + interval '7 days';

  INSERT INTO public.household_invites (household_id, token, created_by, expires_at)
  VALUES (v_household_id, v_token, v_member_id, v_expires);

  RETURN QUERY SELECT v_token, v_expires;
END;
$$;

-- 5) Update mi_insert_own policy to be more restrictive (deny direct inserts)
DROP POLICY IF EXISTS "mi_insert_own" ON public.member_identities;

CREATE POLICY "mi_insert_own"
ON public.member_identities
FOR INSERT
TO authenticated
WITH CHECK (
  -- Only allow through RPC (SECURITY DEFINER functions bypass RLS)
  -- Direct inserts are blocked by requiring conditions that can't be met
  false
);