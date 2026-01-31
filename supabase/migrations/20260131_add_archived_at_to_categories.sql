-- ============================================
-- Migration: Add archived_at to categories and subcategories
-- Sincroniza schema com TypeScript types
-- Atualiza políticas RLS para filtrar categorias arquivadas por padrão
-- ============================================

-- 1. Garantir que archived_at existe nas tabelas (usando IF NOT EXISTS para idempotência)
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE NULL;

ALTER TABLE public.subcategories 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE NULL;

-- 2. Criar índices para performance (usando IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_categories_archived_at 
ON public.categories(archived_at) 
WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subcategories_archived_at 
ON public.subcategories(archived_at) 
WHERE archived_at IS NOT NULL;

-- 3. Atualizar políticas RLS para filtrar categorias arquivadas por padrão
-- Remove políticas antigas
DROP POLICY IF EXISTS "Users can view categories in their household" ON public.categories;
DROP POLICY IF EXISTS "Users can view subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Users can view active categories in their household" ON public.categories;
DROP POLICY IF EXISTS "Users can view active subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Users can view archived categories in their household" ON public.categories;
DROP POLICY IF EXISTS "Users can view archived subcategories" ON public.subcategories;

-- Cria política que permite visualizar todas as categorias do household (ativas e arquivadas)
-- O filtro de archived_at IS NULL deve ser aplicado explicitamente nas queries quando necessário
-- QUALIDADE: Mantém compatibilidade com código existente que filtra client-side
-- SEGURANÇA: Mantém validação de household_id intacta
CREATE POLICY "Users can view categories in their household"
ON public.categories FOR SELECT
USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can view subcategories"
ON public.subcategories FOR SELECT
USING (
  category_id IN (
    SELECT id 
    FROM public.categories 
    WHERE household_id = public.get_user_household_id()
  )
);

-- NOTA: Para filtrar categorias arquivadas por padrão nas queries, use:
-- .from('categories').select('*').eq('household_id', householdId).is('archived_at', null)
-- As políticas RLS garantem acesso apenas ao próprio household, mas não filtram archived_at automaticamente
-- para permitir que o código tenha controle sobre quando mostrar arquivadas (ex: página de restauração)

-- 4. Garantir que trigger de cascade existe (caso não exista)
CREATE OR REPLACE FUNCTION public.cascade_archive_subcategories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando categoria é arquivada, arquiva todas as suas subcategorias
  IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN
    UPDATE public.subcategories 
    SET archived_at = NEW.archived_at
    WHERE category_id = NEW.id AND archived_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_cascade_archive_subcategories ON public.categories;
CREATE TRIGGER trigger_cascade_archive_subcategories
AFTER UPDATE ON public.categories
FOR EACH ROW
WHEN (NEW.archived_at IS DISTINCT FROM OLD.archived_at)
EXECUTE FUNCTION public.cascade_archive_subcategories();

-- 5. Comentários de documentação
COMMENT ON COLUMN public.categories.archived_at IS 'Timestamp quando a categoria foi arquivada. NULL significa ativa. Use .is(''archived_at'', null) nas queries para filtrar apenas categorias ativas.';
COMMENT ON COLUMN public.subcategories.archived_at IS 'Timestamp quando a subcategoria foi arquivada. NULL significa ativa. Use .is(''archived_at'', null) nas queries para filtrar apenas subcategorias ativas.';
