-- =========================================
-- PATCH: Harden member_identities (definitivo)
-- Objetivo: impedir hijack de household + eliminar superfície de enumeração/email
-- =========================================

-- 1) Add household_id column to member_identities (denormalization for faster RLS)
ALTER TABLE public.member_identities 
  ADD COLUMN IF NOT EXISTS household_id uuid;

-- 2) Populate household_id from members table for existing records
UPDATE public.member_identities mi
SET household_id = m.household_id
FROM public.members m
WHERE mi.member_id = m.id
  AND mi.household_id IS NULL;

-- 3) Garantir RLS ligado
ALTER TABLE public.member_identities ENABLE ROW LEVEL SECURITY;

-- 4) Garantir que NÃO exista acesso direto do cliente
REVOKE ALL ON TABLE public.member_identities FROM anon, authenticated;

-- 5) Garantir unicidade por usuário (1 user -> 1 household)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'member_identities_user_id_unique'
  ) THEN
    ALTER TABLE public.member_identities
      ADD CONSTRAINT member_identities_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 6) Drop existing policies that might conflict
DROP POLICY IF EXISTS "member_identities_deny_all_select" ON public.member_identities;
DROP POLICY IF EXISTS "member_identities_deny_direct_insert" ON public.member_identities;
DROP POLICY IF EXISTS "member_identities_select_none" ON public.member_identities;
DROP POLICY IF EXISTS "member_identities_insert_own" ON public.member_identities;
DROP POLICY IF EXISTS "member_identities_update_own" ON public.member_identities;
DROP POLICY IF EXISTS mi_deny_update ON public.member_identities;
DROP POLICY IF EXISTS mi_deny_delete ON public.member_identities;

-- 7) Políticas explícitas NEGANDO todas operações diretas
CREATE POLICY mi_deny_select
ON public.member_identities
FOR SELECT
TO authenticated
USING (false);

CREATE POLICY mi_deny_insert
ON public.member_identities
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY mi_deny_update
ON public.member_identities
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY mi_deny_delete
ON public.member_identities
FOR DELETE
TO authenticated
USING (false);

-- 8) RPC para ler contexto do usuário (sem expor tabela)
CREATE OR REPLACE FUNCTION public.get_user_context()
RETURNS TABLE (
  household_id uuid,
  member_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mi.household_id, mi.member_id
  FROM public.member_identities mi
  WHERE mi.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_context() FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_context() TO authenticated;

-- 9) RPC para obter household_id (compatibilidade com código legado)
CREATE OR REPLACE FUNCTION public.get_user_household_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mi.household_id
  FROM public.member_identities mi
  WHERE mi.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_household_id() FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_household_id() TO authenticated;

-- 10) RPC segura para criar vínculo (somente na fase de onboarding)
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.member_identities WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'identity_already_exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.households h WHERE h.id = p_household_id) THEN
    RAISE EXCEPTION 'household_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = p_member_id
      AND m.household_id = p_household_id
  ) THEN
    RAISE EXCEPTION 'member_not_found_or_mismatch';
  END IF;

  INSERT INTO public.member_identities (user_id, household_id, member_id)
  VALUES (auth.uid(), p_household_id, p_member_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_member_identity(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.create_member_identity(uuid, uuid) TO authenticated;