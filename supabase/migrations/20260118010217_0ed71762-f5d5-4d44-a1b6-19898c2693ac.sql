-- 1. Drop the insecure view
DROP VIEW IF EXISTS public.members_visible;

-- 2. Create secure RPC to get members (replaces the view)
CREATE OR REPLACE FUNCTION public.get_members_visible()
RETURNS TABLE (
  id uuid,
  household_id uuid,
  user_id uuid,
  name text,
  email text,
  role text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id uuid;
  v_is_admin boolean;
BEGIN
  -- Get user's household
  SELECT m.household_id INTO v_household_id
  FROM public.members m
  WHERE m.user_id = auth.uid()
  LIMIT 1;
  
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid() AND m.role = 'ADMIN'
  ) INTO v_is_admin;
  
  -- Return members with email masked for non-admins
  RETURN QUERY
  SELECT 
    m.id,
    m.household_id,
    m.user_id,
    m.name,
    CASE 
      WHEN v_is_admin OR m.user_id = auth.uid() THEN m.email
      ELSE NULL
    END as email,
    m.role::text,
    m.created_at,
    m.updated_at
  FROM public.members m
  WHERE m.household_id = v_household_id
  ORDER BY m.name;
END;
$$;

-- 3. Drop the old can_view_member_email function (no longer needed)
DROP FUNCTION IF EXISTS public.can_view_member_email(uuid);