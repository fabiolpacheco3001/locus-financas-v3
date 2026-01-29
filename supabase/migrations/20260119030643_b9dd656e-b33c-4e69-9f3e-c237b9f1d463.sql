-- 1) Drop email column from members table
ALTER TABLE public.members DROP COLUMN IF EXISTS email;

-- 2) Update RPC to get email from JWT for logged-in user only
CREATE OR REPLACE FUNCTION public.get_members_visible(p_household_id uuid)
RETURNS TABLE (
  id uuid,
  household_id uuid,
  name text,
  role text,
  email text,
  user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_caller_email text;
BEGIN
  -- Validate caller is member of household
  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.household_id = p_household_id
      AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  v_is_admin := public.is_household_admin(auth.uid(), p_household_id);
  
  -- Get caller's email from JWT
  v_caller_email := auth.jwt() ->> 'email';

  RETURN QUERY
  SELECT
    m.id,
    m.household_id,
    m.name,
    m.role::text,
    -- Email: only show for own row (from JWT)
    CASE
      WHEN m.user_id = auth.uid() THEN v_caller_email
      ELSE NULL
    END AS email,
    -- user_id: admin or self can see
    CASE
      WHEN v_is_admin OR m.user_id = auth.uid() THEN m.user_id
      ELSE NULL
    END AS user_id
  FROM public.members m
  WHERE m.household_id = p_household_id
  ORDER BY m.created_at;
END;
$$;

-- 3) Update create_household_with_admin to not require email
CREATE OR REPLACE FUNCTION public.create_household_with_admin(
  p_household_name text,
  p_user_id uuid,
  p_member_name text,
  p_member_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_household_id UUID;
BEGIN
  -- Create household
  INSERT INTO public.households (name) 
  VALUES (p_household_name) 
  RETURNING id INTO v_household_id;

  -- Create admin member (email is no longer stored)
  INSERT INTO public.members (household_id, user_id, name, role)
  VALUES (v_household_id, p_user_id, p_member_name, 'ADMIN');

  -- Seed initial data
  PERFORM public.seed_household_data(v_household_id);

  RETURN v_household_id;
END;
$$;