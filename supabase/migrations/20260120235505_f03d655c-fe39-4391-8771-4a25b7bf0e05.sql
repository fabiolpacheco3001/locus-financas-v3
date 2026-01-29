-- =========================================
-- SECURITY FIX: Remove insecure SELECT policies from household_invites
-- The frontend already uses SECURITY DEFINER RPCs for all invite access.
-- This migration removes policies that could allow email harvesting.
-- =========================================

-- 1) Drop the insecure policies that allow access based on token header or email matching
DROP POLICY IF EXISTS invites_select_by_token ON public.household_invites;
DROP POLICY IF EXISTS invites_select_invited_email ON public.household_invites;

-- 2) Ensure we keep ONLY the creator-based policy for admins to list their created invites
-- This policy already exists: invites_select_creator (created_by_user_id = auth.uid())
-- We'll recreate it to ensure it's using the correct column

DROP POLICY IF EXISTS invites_select_creator ON public.household_invites;

CREATE POLICY invites_select_creator
ON public.household_invites
FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

-- 3) Update the get_household_invite_preview function to be more secure
-- It should NOT expose invited_email to prevent enumeration
-- Returns only: household_id, expires_at, is_valid

CREATE OR REPLACE FUNCTION public.get_household_invite_preview(p_token text)
RETURNS TABLE(household_id uuid, expires_at timestamp with time zone, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_row public.household_invites%rowtype;
BEGIN
  -- Validate token format
  IF p_token IS NULL OR length(trim(p_token)) < 20 THEN
    household_id := NULL;
    expires_at := NULL;
    is_valid := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  v_hash := public.hash_invite_token(p_token);

  SELECT *
  INTO v_row
  FROM public.household_invites
  WHERE token_hash = v_hash
  LIMIT 1;

  IF NOT FOUND THEN
    household_id := NULL;
    expires_at := NULL;
    is_valid := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  household_id := v_row.household_id;
  expires_at := v_row.expires_at;

  -- Check validity: not accepted AND not expired
  is_valid := (v_row.accepted_at IS NULL)
             AND (v_row.expires_at IS NULL OR v_row.expires_at > now());

  RETURN NEXT;
END;
$$;

-- 4) Ensure hash function is secure with search_path
CREATE OR REPLACE FUNCTION public.hash_invite_token(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(extensions.digest(trim(p_token), 'sha256'), 'hex');
$$;