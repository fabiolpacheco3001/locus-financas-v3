-- Create a function to check if current user can see a member's email
CREATE OR REPLACE FUNCTION public.can_view_member_email(p_member_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- User is an admin
    public.is_household_admin()
    OR 
    -- User is viewing their own email
    (p_member_user_id IS NOT NULL AND p_member_user_id = auth.uid())
$$;

-- Create view with email privacy
CREATE OR REPLACE VIEW public.members_visible
WITH (security_invoker = on)
AS
SELECT 
  id,
  household_id,
  user_id,
  name,
  CASE 
    WHEN public.can_view_member_email(user_id) THEN email
    ELSE NULL
  END AS email,
  role,
  created_at,
  updated_at
FROM public.members;