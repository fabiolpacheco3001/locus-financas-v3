-- Function to check if user is admin in their household
CREATE OR REPLACE FUNCTION public.is_household_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members 
    WHERE user_id = auth.uid() 
    AND role = 'ADMIN'
  )
$$;

-- Drop existing member policies that don't check admin role
DROP POLICY IF EXISTS "Admins can insert members" ON public.members;
DROP POLICY IF EXISTS "Admins can update members" ON public.members;
DROP POLICY IF EXISTS "Admins can delete members" ON public.members;

-- Create new policies with proper admin role checks
CREATE POLICY "Admins can insert members"
  ON public.members FOR INSERT
  WITH CHECK (
    household_id = public.get_user_household_id() 
    AND public.is_household_admin()
  );

CREATE POLICY "Admins can update members"
  ON public.members FOR UPDATE
  USING (
    household_id = public.get_user_household_id() 
    AND public.is_household_admin()
  );

CREATE POLICY "Admins can delete members"
  ON public.members FOR DELETE
  USING (
    household_id = public.get_user_household_id() 
    AND public.is_household_admin()
  );

-- Allow first member (during signup) to be inserted
CREATE POLICY "Allow first member creation during signup"
  ON public.members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.members WHERE user_id = auth.uid())
  );

-- Seed function to populate initial data for a new household
CREATE OR REPLACE FUNCTION public.seed_household_data(p_household_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id UUID;
BEGIN
  -- Create default bank accounts
  INSERT INTO public.accounts (household_id, name, type) VALUES
    (p_household_id, 'Banco XP', 'BANK'),
    (p_household_id, 'Banco Nubank', 'BANK'),
    (p_household_id, 'Banco Will', 'BANK'),
    (p_household_id, 'Banco C6', 'BANK'),
    (p_household_id, 'Banco Inter', 'BANK');

  -- Create default card accounts
  INSERT INTO public.accounts (household_id, name, type) VALUES
    (p_household_id, 'Cartão Nubank Pessoal', 'CARD'),
    (p_household_id, 'Cartão Nubank Empresarial', 'CARD'),
    (p_household_id, 'Cartão XP', 'CARD'),
    (p_household_id, 'Willcard', 'CARD');

  -- Moradia
  INSERT INTO public.categories (household_id, name) VALUES (p_household_id, 'Moradia') RETURNING id INTO v_category_id;
  INSERT INTO public.subcategories (category_id, name) VALUES
    (v_category_id, 'Aluguel'),
    (v_category_id, 'Condomínio'),
    (v_category_id, 'Energia'),
    (v_category_id, 'Gás');

  -- Alimentação
  INSERT INTO public.categories (household_id, name) VALUES (p_household_id, 'Alimentação') RETURNING id INTO v_category_id;
  INSERT INTO public.subcategories (category_id, name) VALUES
    (v_category_id, 'Supermercado'),
    (v_category_id, 'Feira'),
    (v_category_id, 'Padaria'),
    (v_category_id, 'Mercadinho');

  -- Educação
  INSERT INTO public.categories (household_id, name) VALUES (p_household_id, 'Educação') RETURNING id INTO v_category_id;
  INSERT INTO public.subcategories (category_id, name) VALUES
    (v_category_id, 'Mensalidade - Natália'),
    (v_category_id, 'Material - Natália'),
    (v_category_id, 'Mensalidade - Théo'),
    (v_category_id, 'Material - Théo'),
    (v_category_id, 'Transporte escolar'),
    (v_category_id, 'Material escolar'),
    (v_category_id, 'Uniforme');

  -- Transporte
  INSERT INTO public.categories (household_id, name) VALUES (p_household_id, 'Transporte') RETURNING id INTO v_category_id;
  INSERT INTO public.subcategories (category_id, name) VALUES
    (v_category_id, 'Uber'),
    (v_category_id, 'Gasolina'),
    (v_category_id, 'Localiza');

  -- Categorias sem subcategorias
  INSERT INTO public.categories (household_id, name) VALUES
    (p_household_id, 'Família e Apoios'),
    (p_household_id, 'Saúde e Seguros');

  -- Conectividade e Ferramentas
  INSERT INTO public.categories (household_id, name) VALUES (p_household_id, 'Conectividade e Ferramentas') RETURNING id INTO v_category_id;
  INSERT INTO public.subcategories (category_id, name) VALUES
    (v_category_id, 'Internet'),
    (v_category_id, 'iCloud'),
    (v_category_id, 'Office 365'),
    (v_category_id, 'ChatGPT'),
    (v_category_id, 'Google One');

  -- Mais categorias sem subcategorias
  INSERT INTO public.categories (household_id, name) VALUES
    (p_household_id, 'Assinaturas e Entretenimento'),
    (p_household_id, 'Bem-estar e Esportes'),
    (p_household_id, 'Lazer'),
    (p_household_id, 'Dívidas e Parcelamentos'),
    (p_household_id, 'Manutenção e Obras'),
    (p_household_id, 'Trabalho/Negócio (MEI)');

  -- Bancos e Cartões (excluída do orçamento)
  INSERT INTO public.categories (household_id, name, is_budget_excluded) 
  VALUES (p_household_id, 'Bancos e Cartões', true);

END;
$$;

-- Function to create household with admin member and seed data
CREATE OR REPLACE FUNCTION public.create_household_with_admin(
  p_household_name TEXT,
  p_user_id UUID,
  p_member_name TEXT,
  p_member_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id UUID;
BEGIN
  -- Create household
  INSERT INTO public.households (name) 
  VALUES (p_household_name) 
  RETURNING id INTO v_household_id;

  -- Create admin member
  INSERT INTO public.members (household_id, user_id, name, email, role)
  VALUES (v_household_id, p_user_id, p_member_name, p_member_email, 'ADMIN');

  -- Seed initial data
  PERFORM public.seed_household_data(v_household_id);

  RETURN v_household_id;
END;
$$;

-- Allow insert on households for authenticated users creating their first household
DROP POLICY IF EXISTS "Users can update their household" ON public.households;

CREATE POLICY "Users can insert household during signup"
  ON public.households FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their household"
  ON public.households FOR UPDATE
  USING (id = public.get_user_household_id());