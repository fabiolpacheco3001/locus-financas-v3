-- ============================================================
-- PATCH: Secure member_identities - add get_my_identity() RPC
-- ============================================================

-- 1) Create get_my_identity() - returns caller's member_id + household_id only
CREATE OR REPLACE FUNCTION public.get_my_identity()
RETURNS TABLE(
  member_id uuid,
  household_id uuid,
  name text,
  role text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS member_id,
    m.household_id,
    m.name,
    m.role::text
  FROM public.member_identities mi
  JOIN public.members m ON m.id = mi.member_id
  WHERE mi.user_id = auth.uid()
  LIMIT 1;
END;
$$;

-- 2) Grant execute on the new function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_identity() TO authenticated;