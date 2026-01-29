-- 1) Drop the existing broad SELECT policy that allows any household member to see all members
DROP POLICY IF EXISTS "Users can view members in their household" ON public.members;

-- 2) Create policy: users can SELECT only their own row
CREATE POLICY "members_select_self"
ON public.members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3) Create policy: admins can SELECT all members in their household
CREATE POLICY "members_select_admin"
ON public.members
FOR SELECT
TO authenticated
USING (
  household_id = get_user_household_id() 
  AND is_household_admin()
);

-- 4) Update RPC to also mask user_id for non-admins (not just email)
CREATE OR REPLACE FUNCTION public.get_members_visible()
RETURNS TABLE(
  id uuid,
  household_id uuid,
  user_id uuid,
  name text,
  email text,
  role text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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
  
  -- Return members with email AND user_id masked for non-admins (except own row)
  RETURN QUERY
  SELECT 
    m.id,
    m.household_id,
    CASE 
      WHEN v_is_admin OR m.user_id = auth.uid() THEN m.user_id
      ELSE NULL
    END as user_id,
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

-- 5) Ensure grants (authenticated can execute, anon cannot)
REVOKE ALL ON FUNCTION public.get_members_visible() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_members_visible() TO authenticated;