-- =========================================
-- SECURITY PATCH: Blindar member_identities
-- =========================================

-- 1) Remover coluna email (dado já existe no Supabase Auth)
ALTER TABLE public.member_identities DROP COLUMN IF EXISTS email;

-- 2) Remover policies existentes que permitem acesso direto
DROP POLICY IF EXISTS member_identities_select_self ON public.member_identities;
DROP POLICY IF EXISTS member_identities_insert_self ON public.member_identities;

-- 3) Criar policy que NEGA todo SELECT direto (somente SECURITY DEFINER pode acessar)
CREATE POLICY member_identities_deny_all_select
ON public.member_identities
FOR SELECT
TO authenticated, anon
USING (false);

-- 4) Manter INSERT via SECURITY DEFINER function (create_household_with_admin)
-- Não criar policy de INSERT direto - inserções são feitas via RPC
CREATE POLICY member_identities_deny_direct_insert
ON public.member_identities
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

-- 5) Garantir que funções essenciais são SECURITY DEFINER
-- (já são, mas vamos recriar para garantir consistência)

CREATE OR REPLACE FUNCTION public.get_user_household_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.household_id
  FROM public.member_identities mi
  JOIN public.members m ON m.id = mi.member_id
  WHERE mi.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_household_admin(p_user uuid, p_household uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.member_identities mi
    JOIN public.members m ON m.id = mi.member_id
    WHERE mi.user_id = p_user
      AND m.household_id = p_household
      AND m.role = 'ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_household_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.member_identities mi
    JOIN public.members m ON m.id = mi.member_id
    WHERE mi.user_id = auth.uid()
      AND m.role = 'ADMIN'
  );
$$;

-- 6) Atualizar get_members_visible para não depender de email em member_identities
CREATE OR REPLACE FUNCTION public.get_members_visible(p_household_id uuid)
RETURNS TABLE (
  id uuid,
  household_id uuid,
  name text,
  role text,
  email text,
  user_id uuid,
  is_you boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household uuid;
  v_caller_email text;
BEGIN
  v_household := public.get_user_household_id();
  IF v_household IS NULL OR v_household <> p_household_id THEN
    RAISE EXCEPTION 'Access denied: not a member of this household';
  END IF;
  
  -- Email comes from JWT only for the caller's own row
  v_caller_email := auth.jwt() ->> 'email';

  RETURN QUERY
  SELECT
    m.id,
    m.household_id,
    m.name,
    m.role::text,
    CASE
      WHEN mi.user_id = auth.uid() THEN v_caller_email
      ELSE NULL
    END AS email,
    CASE
      WHEN mi.user_id = auth.uid() THEN mi.user_id
      ELSE NULL
    END AS user_id,
    (mi.user_id = auth.uid()) AS is_you,
    m.created_at,
    m.updated_at
  FROM public.members m
  LEFT JOIN public.member_identities mi ON mi.member_id = m.id
  WHERE m.household_id = p_household_id
  ORDER BY m.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_members_visible()
RETURNS TABLE (
  id uuid,
  household_id uuid,
  name text,
  role text,
  email text,
  user_id uuid,
  is_you boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household uuid;
  v_caller_email text;
BEGIN
  v_household := public.get_user_household_id();
  IF v_household IS NULL THEN
    RETURN;
  END IF;
  
  -- Email comes from JWT only for the caller's own row
  v_caller_email := auth.jwt() ->> 'email';
  
  RETURN QUERY
  SELECT
    m.id,
    m.household_id,
    m.name,
    m.role::text,
    CASE
      WHEN mi.user_id = auth.uid() THEN v_caller_email
      ELSE NULL
    END AS email,
    CASE
      WHEN mi.user_id = auth.uid() THEN mi.user_id
      ELSE NULL
    END AS user_id,
    (mi.user_id = auth.uid()) AS is_you,
    m.created_at,
    m.updated_at
  FROM public.members m
  LEFT JOIN public.member_identities mi ON mi.member_id = m.id
  WHERE m.household_id = v_household
  ORDER BY m.name;
END;
$$;

-- 7) Atualizar create_household_with_admin para não inserir email
CREATE OR REPLACE FUNCTION public.create_household_with_admin(
  p_household_name text,
  p_user_id uuid,
  p_member_name text,
  p_member_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id uuid;
  v_member_id uuid;
BEGIN
  -- Create household
  INSERT INTO public.households (name) 
  VALUES (p_household_name) 
  RETURNING id INTO v_household_id;

  -- Create admin member
  INSERT INTO public.members (household_id, name, role)
  VALUES (v_household_id, p_member_name, 'ADMIN')
  RETURNING id INTO v_member_id;
  
  -- Create identity record (only user_id, no email)
  INSERT INTO public.member_identities (member_id, user_id)
  VALUES (v_member_id, p_user_id);

  -- Seed initial data
  PERFORM public.seed_household_data(v_household_id);

  RETURN v_household_id;
END;
$$;