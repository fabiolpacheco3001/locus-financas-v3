-- 1. REWRITE seed_household_data with exactly 12 categories
CREATE OR REPLACE FUNCTION public.seed_household_data(p_household_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert exactly 12 categories with icons and expense types
  -- All are EXPENSE categories by default (income would be tracked differently)
  
  INSERT INTO public.categories (household_id, name, icon, is_essential) VALUES
    (p_household_id, 'Moradia', 'Home', true),
    (p_household_id, 'Contas Fixas', 'Receipt', true),
    (p_household_id, 'Alimentação', 'ShoppingCart', true),
    (p_household_id, 'Restaurante', 'UtensilsCrossed', false),
    (p_household_id, 'Transporte', 'Car', true),
    (p_household_id, 'Saúde', 'Heart', true),
    (p_household_id, 'Seguros', 'Shield', true),
    (p_household_id, 'Assinaturas', 'Play', false),
    (p_household_id, 'Lazer', 'Gamepad2', false),
    (p_household_id, 'Educação', 'GraduationCap', true),
    (p_household_id, 'Investimentos', 'TrendingUp', false),
    (p_household_id, 'Outros', 'MoreHorizontal', false);

  -- Create a default bank account for convenience
  INSERT INTO public.accounts (household_id, name, type, is_primary) VALUES
    (p_household_id, 'Conta Principal', 'BANK', true);

END;
$function$;

-- 2. CREATE handle_new_user function for OAuth onboarding
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_household_id uuid;
  v_member_id uuid;
  v_user_name text;
  v_user_email text;
BEGIN
  -- Extract user info from the new auth.users row
  v_user_email := NEW.email;
  v_user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Check if this user already has an identity (prevents duplicate households)
  IF EXISTS (SELECT 1 FROM public.member_identities WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Create household
  INSERT INTO public.households (name)
  VALUES ('Família de ' || v_user_name)
  RETURNING id INTO v_household_id;

  -- Create admin member
  INSERT INTO public.members (household_id, name, role)
  VALUES (v_household_id, v_user_name, 'ADMIN')
  RETURNING id INTO v_member_id;

  -- Create member identity link
  INSERT INTO public.member_identities (member_id, user_id, household_id)
  VALUES (v_member_id, NEW.id, v_household_id);

  -- Seed the household with categories and default account
  PERFORM public.seed_household_data(v_household_id);

  RETURN NEW;
END;
$function$;

-- 3. CREATE TRIGGER on auth.users (for OAuth and any new signups)
-- First drop if exists to avoid errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. CLEANUP: Remove old junk categories from your household
-- Keep only the 12 requested categories
DELETE FROM public.categories 
WHERE household_id = '4f6baaae-e906-4f41-89f6-dccfd57f3f9c'
AND name NOT IN (
  'Moradia', 
  'Contas Fixas', 
  'Alimentação', 
  'Restaurante', 
  'Transporte', 
  'Saúde', 
  'Seguros', 
  'Assinaturas', 
  'Lazer', 
  'Educação', 
  'Investimentos', 
  'Outros'
);