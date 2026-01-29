-- 0) Pré-requisitos básicos
ALTER TABLE IF EXISTS public.member_identities ENABLE ROW LEVEL SECURITY;

-- 1) Remover PII (email) da tabela de mapeamento (evita harvest)
ALTER TABLE public.member_identities
  DROP COLUMN IF EXISTS email;

-- 2) Garantir unicidade por usuário (1 user -> 1 household link)
DO $$
BEGIN
  -- cria unique index se não existir
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'member_identities'
      AND indexname = 'member_identities_user_id_uniq'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX member_identities_user_id_uniq ON public.member_identities(user_id)';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- 3) Limpar policies antigas (inclusive deny-all) - FIXED: policyname instead of polname
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_identities'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.member_identities;', r.policyname);
  END LOOP;
END $$;

-- 4) Privilégios: manter mínimo necessário
REVOKE ALL ON TABLE public.member_identities FROM anon, authenticated;
GRANT SELECT ON TABLE public.member_identities TO authenticated;

-- 5) Policies seguras

-- 5.1) Usuário só enxerga o próprio vínculo
CREATE POLICY member_identities_select_own
ON public.member_identities
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 5.2) INSERT: somente bootstrap seguro (impede "me vincular a um household existente")
CREATE POLICY member_identities_insert_bootstrap_only
ON public.member_identities
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.member_identities mi
    WHERE mi.user_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.member_identities mi2
    WHERE mi2.household_id = member_identities.household_id
  )
);

-- 5.3) UPDATE/DELETE: proibidos (evita hijack)
CREATE POLICY member_identities_deny_update
ON public.member_identities
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY member_identities_deny_delete
ON public.member_identities
FOR DELETE
TO authenticated
USING (false);