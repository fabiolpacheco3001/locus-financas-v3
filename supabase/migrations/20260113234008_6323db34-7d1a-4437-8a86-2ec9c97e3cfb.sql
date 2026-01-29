-- Step 1: Remove duplicate budgets, keeping only the most recent one per combination
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY household_id, year, month, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000')
      ORDER BY updated_at DESC, created_at DESC
    ) as rn
  FROM public.budgets
)
DELETE FROM public.budgets
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Step 2: Create unique index for the combination (handles NULL subcategory_id properly)
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_unique_combination 
ON public.budgets (household_id, year, month, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'));