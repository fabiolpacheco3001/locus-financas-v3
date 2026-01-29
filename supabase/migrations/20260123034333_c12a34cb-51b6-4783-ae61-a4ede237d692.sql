-- Create RPC function for transaction prediction based on description
CREATE OR REPLACE FUNCTION public.predict_transaction_details(p_description text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_household_id uuid;
  v_result jsonb;
BEGIN
  -- Get user's household
  v_household_id := public.get_user_household_id();
  
  IF v_household_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Search for best match based on description similarity
  -- Priority: frequency count DESC, then most recent date DESC
  SELECT jsonb_build_object(
    'category_id', t.category_id,
    'subcategory_id', t.subcategory_id,
    'account_id', t.account_id,
    'payment_method', t.payment_method,
    'description', t.description,
    'member_id', t.member_id,
    'match_count', cnt.match_count
  ) INTO v_result
  FROM (
    -- Subquery to get frequency count for each unique description pattern
    SELECT 
      description,
      category_id,
      subcategory_id,
      account_id,
      payment_method,
      member_id,
      MAX(date) as last_used,
      COUNT(*) as match_count
    FROM public.transactions
    WHERE household_id = v_household_id
      AND cancelled_at IS NULL
      AND status IN ('planned', 'confirmed')
      AND description IS NOT NULL
      AND description <> ''
      AND description ILIKE '%' || p_description || '%'
    GROUP BY description, category_id, subcategory_id, account_id, payment_method, member_id
  ) t
  JOIN (
    -- Get the max count to prioritize most frequent
    SELECT description, COUNT(*) as match_count
    FROM public.transactions
    WHERE household_id = v_household_id
      AND cancelled_at IS NULL
      AND status IN ('planned', 'confirmed')
      AND description IS NOT NULL
      AND description ILIKE '%' || p_description || '%'
    GROUP BY description
  ) cnt ON cnt.description = t.description
  ORDER BY 
    -- Exact match first
    CASE WHEN lower(t.description) = lower(p_description) THEN 0 ELSE 1 END,
    -- Then starts with
    CASE WHEN lower(t.description) LIKE lower(p_description) || '%' THEN 0 ELSE 1 END,
    -- Then by frequency
    cnt.match_count DESC,
    -- Then by recency
    t.last_used DESC
  LIMIT 1;
  
  RETURN v_result;
END;
$$;