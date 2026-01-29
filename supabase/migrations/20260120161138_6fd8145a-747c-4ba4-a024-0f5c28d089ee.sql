-- 1) Remover coluna email da member_identities, se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='member_identities' AND column_name='email'
  ) THEN
    ALTER TABLE public.member_identities DROP COLUMN email;
  END IF;
END $$;

-- 2) Bloquear acesso direto do client à tabela (mesmo que RLS exista)
REVOKE ALL ON TABLE public.member_identities FROM anon;
REVOKE ALL ON TABLE public.member_identities FROM authenticated;

-- (Opcional) garantir que service_role mantém acesso
GRANT ALL ON TABLE public.member_identities TO service_role;

-- 3) Garantir funções utilitárias como SECURITY DEFINER
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