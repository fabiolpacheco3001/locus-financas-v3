-- ============================================================
-- PATCH: Secure member_identities - email_hash + RLS + RPC
-- ============================================================

-- Drop existing get_my_identity function (different signature)
DROP FUNCTION IF EXISTS public.get_my_identity();

-- 5) RPC seguro para leitura do "meu" identity (email vem do JWT, não do banco)
CREATE OR REPLACE FUNCTION public.get_my_identity()
RETURNS TABLE (
  user_id uuid,
  household_id uuid,
  email text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mi.user_id,
    m.household_id,
    (auth.jwt() ->> 'email')::text AS email,
    mi.created_at
  FROM public.member_identities mi
  JOIN public.members m ON m.id = mi.member_id
  WHERE mi.user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_identity() TO authenticated;