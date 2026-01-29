-- =============================================
-- SECURITY FIX: Restrict direct SELECT on members table
-- Force all reads through secure RPC get_members_visible()
-- =============================================

-- Drop overly permissive SELECT policies
DROP POLICY IF EXISTS "members_select_admin" ON public.members;
DROP POLICY IF EXISTS "members_select_self" ON public.members;

-- Create single restrictive SELECT policy: users can ONLY see their own row
-- This is needed for AuthContext to fetch the current user's member info
CREATE POLICY "members_select_own_only"
  ON public.members
  FOR SELECT
  USING (user_id = auth.uid());

-- Note: INSERT/UPDATE/DELETE policies already exist and are correct:
-- - "Admins can insert members" 
-- - "Admins can update members"
-- - "Admins can delete members"
-- - "Allow first member creation during signup"

-- Update get_members_visible function to be more secure
-- Now returns user_id only for self, email from JWT only for self
CREATE OR REPLACE FUNCTION public.get_members_visible(p_household_id uuid)
RETURNS TABLE(
  id uuid,
  household_id uuid,
  name text,
  role text,
  email text,
  user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_caller_email text;
  v_caller_household uuid;
BEGIN
  -- Get caller's household to validate access
  SELECT m.household_id INTO v_caller_household
  FROM public.members m
  WHERE m.user_id = auth.uid()
  LIMIT 1;
  
  -- Validate caller is member of the requested household
  IF v_caller_household IS NULL OR v_caller_household != p_household_id THEN
    RAISE EXCEPTION 'Access denied: not a member of this household';
  END IF;

  -- Check if caller is admin
  v_is_admin := public.is_household_admin(auth.uid(), p_household_id);
  
  -- Get caller's email from JWT (never from database)
  v_caller_email := auth.jwt() ->> 'email';

  RETURN QUERY
  SELECT
    m.id,
    m.household_id,
    m.name,
    m.role::text,
    -- Email: ONLY show for own row (from JWT), never for others
    CASE
      WHEN m.user_id = auth.uid() THEN v_caller_email
      ELSE NULL
    END AS email,
    -- user_id: ONLY show for own row, never for others (even admins)
    CASE
      WHEN m.user_id = auth.uid() THEN m.user_id
      ELSE NULL
    END AS user_id
  FROM public.members m
  WHERE m.household_id = p_household_id
  ORDER BY m.created_at;
END;
$$;

-- Also update the parameterless version for consistency
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
SET search_path = public
AS $$
DECLARE
  v_household_id uuid;
  v_caller_email text;
BEGIN
  -- Get user's household
  SELECT m.household_id INTO v_household_id
  FROM public.members m
  WHERE m.user_id = auth.uid()
  LIMIT 1;
  
  IF v_household_id IS NULL THEN
    RETURN; -- Return empty if no household
  END IF;
  
  -- Get caller's email from JWT
  v_caller_email := auth.jwt() ->> 'email';
  
  -- Return members with email/user_id ONLY visible for own row
  RETURN QUERY
  SELECT 
    m.id,
    m.household_id,
    -- user_id: only visible for self
    CASE 
      WHEN m.user_id = auth.uid() THEN m.user_id
      ELSE NULL
    END as user_id,
    m.name,
    -- email: only visible for self (from JWT)
    CASE 
      WHEN m.user_id = auth.uid() THEN v_caller_email
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