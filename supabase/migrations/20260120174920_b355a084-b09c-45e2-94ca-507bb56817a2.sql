-- Migration: Harden member_identities with proper RLS and constraints
-- Goal: Immutable identity linking with hijack prevention

-- 1. Drop all existing RLS policies on member_identities
DROP POLICY IF EXISTS "mi_deny_select" ON public.member_identities;
DROP POLICY IF EXISTS "mi_deny_insert" ON public.member_identities;
DROP POLICY IF EXISTS "mi_deny_update" ON public.member_identities;
DROP POLICY IF EXISTS "mi_deny_delete" ON public.member_identities;

-- 2. Ensure RLS is enabled
ALTER TABLE public.member_identities ENABLE ROW LEVEL SECURITY;

-- 3. Ensure UNIQUE constraint on user_id (1:1 relationship - one user, one identity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'member_identities_user_id_key' 
    AND conrelid = 'public.member_identities'::regclass
  ) THEN
    ALTER TABLE public.member_identities 
    ADD CONSTRAINT member_identities_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 4. Create index on user_id for faster lookups (if not auto-created by unique constraint)
CREATE INDEX IF NOT EXISTS idx_member_identities_user_id 
ON public.member_identities (user_id);

-- 5. Helper function: check if household already has linked identities
-- Prevents hijacking by blocking INSERT into households with existing members
CREATE OR REPLACE FUNCTION public.is_household_unlinked(p_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.member_identities
    WHERE household_id = p_household_id
  );
$$;

-- 6. Create new RLS policies

-- SELECT: User can only see their own identity record
CREATE POLICY "mi_select_own"
ON public.member_identities
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: User can only create their own identity AND only for unlinked households
-- This prevents hijacking - user cannot insert into a household that already has members
CREATE POLICY "mi_insert_own_unlinked"
ON public.member_identities
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND public.is_household_unlinked(household_id)
);

-- UPDATE: Completely blocked - identities are immutable
CREATE POLICY "mi_block_update"
ON public.member_identities
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- DELETE: Completely blocked - identities cannot be removed
CREATE POLICY "mi_block_delete"
ON public.member_identities
FOR DELETE
TO authenticated
USING (false);