-- 1) RLS ON
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- 2) Remover policies SELECT amplas existentes
DROP POLICY IF EXISTS "members_select" ON public.members;
DROP POLICY IF EXISTS "members_select_same_household" ON public.members;
DROP POLICY IF EXISTS "Members can view members in same household" ON public.members;
DROP POLICY IF EXISTS "members_select_self" ON public.members;
DROP POLICY IF EXISTS "members_select_admin" ON public.members;

-- 3) Helper admin com 2 parâmetros
CREATE OR REPLACE FUNCTION public.is_household_admin(p_user uuid, p_household uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.household_id = p_household
      AND m.user_id = p_user
      AND m.role = 'ADMIN'
  );
$$;

-- 4) SELECT: self
CREATE POLICY members_select_self
ON public.members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 5) SELECT: admin vê tudo do household
CREATE POLICY members_select_admin
ON public.members
FOR SELECT
TO authenticated
USING (public.is_household_admin(auth.uid(), household_id));

-- 6) RPC segura com parâmetro p_household_id
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

  RETURN QUERY
  SELECT
    m.id,
    m.household_id,
    m.name,
    m.role::text,
    CASE
      WHEN v_is_admin OR m.user_id = auth.uid() THEN m.email
      ELSE NULL
    END AS email,
    CASE
      WHEN v_is_admin OR m.user_id = auth.uid() THEN m.user_id
      ELSE NULL
    END AS user_id
  FROM public.members m
  WHERE m.household_id = p_household_id
  ORDER BY m.created_at;
END;
$$;

-- Revoke/Grant
REVOKE ALL ON FUNCTION public.get_members_visible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_members_visible(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_members_visible(uuid) TO authenticated;