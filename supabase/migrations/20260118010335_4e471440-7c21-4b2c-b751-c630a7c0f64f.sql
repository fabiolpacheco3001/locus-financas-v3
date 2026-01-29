-- Fix 1: Restrict household creation during signup (prevent abuse)
DROP POLICY IF EXISTS "Users can insert household during signup" ON public.households;
CREATE POLICY "Users can insert household during signup" 
ON public.households 
FOR INSERT 
WITH CHECK (
  -- User must not already belong to a household
  NOT EXISTS (SELECT 1 FROM public.members WHERE user_id = auth.uid())
);

-- Fix 2: Restrict first member creation to MEMBER role only (prevent admin self-grant)
DROP POLICY IF EXISTS "Allow first member creation during signup" ON public.members;
CREATE POLICY "Allow first member creation during signup" 
ON public.members 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() 
  AND role = 'MEMBER'
  AND NOT EXISTS (SELECT 1 FROM public.members WHERE user_id = auth.uid())
);