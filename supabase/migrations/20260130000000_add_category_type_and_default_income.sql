-- Migration: Add type column to categories and create default income category
-- Fixes issue where INCOME transactions fail due to missing category_id
-- Generated: 2026-01-30

-- 1. Adicionar a coluna que falta (padrão 'expense' para não quebrar as atuais)
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'expense';

-- 2. Garantir que a coluna is_essential seja preenchida automaticamente (se estiver nula)
-- (Opcional, mas bom para segurança)
ALTER TABLE public.categories 
ALTER COLUMN is_essential SET DEFAULT false;

-- 3. Atualizar categorias existentes sem type para 'expense' (segurança)
UPDATE public.categories 
SET type = 'expense' 
WHERE type IS NULL;

-- 4. CRIAR A CATEGORIA DE RECEITA (Agora que a coluna type existe!)
-- Cria para cada household que não tenha uma categoria de receita ainda
INSERT INTO public.categories (name, type, icon, is_essential, is_budget_excluded, household_id)
SELECT DISTINCT
  'Receita Padrão', 
  'income', 
  'wallet', 
  false, 
  false,
  h.id
FROM public.households h
WHERE NOT EXISTS (
    SELECT 1 
    FROM public.categories c 
    WHERE c.household_id = h.id 
    AND c.type = 'income' 
    LIMIT 1
);

-- 5. Adicionar comentário para documentação
COMMENT ON COLUMN public.categories.type IS 'Tipo da categoria: expense (despesa) ou income (receita). Padrão: expense';

-- 6. Criar índice para melhor performance em queries por tipo
CREATE INDEX IF NOT EXISTS idx_categories_type 
ON public.categories(type) 
WHERE type IS NOT NULL;
