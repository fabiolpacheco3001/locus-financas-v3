-- PATCH: Hardening member_identities - INSERT only via secure RPCs
-- Goal: Eliminate overly permissive INSERT by requiring app.identity_write context flag

BEGIN;

-- 1) Drop existing INSERT policy
DROP POLICY IF EXISTS "mi_insert_own" ON public.member_identities;

-- 2) Create new INSERT policy that requires context flag from secure RPCs
-- Only bootstrap (empty household) or invite (valid token) paths set this flag
CREATE POLICY "mi_insert_rpc_only"
ON public.member_identities
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND current_setting('app.identity_write', true) IN ('bootstrap', 'invite')
);

-- 3) Ensure UPDATE/DELETE policies explicitly deny all operations (already exists but re-assert)
DROP POLICY IF EXISTS "mi_update_none" ON public.member_identities;
DROP POLICY IF EXISTS "mi_delete_none" ON public.member_identities;

CREATE POLICY "mi_update_none"
ON public.member_identities
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "mi_delete_none"
ON public.member_identities
FOR DELETE
TO authenticated
USING (false);

-- 4) Ensure FORCE RLS is enabled (belt and suspenders)
ALTER TABLE public.member_identities FORCE ROW LEVEL SECURITY;

COMMIT;