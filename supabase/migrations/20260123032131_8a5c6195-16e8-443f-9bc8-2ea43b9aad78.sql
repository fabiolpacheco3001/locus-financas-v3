-- Add is_essential column to categories for smart expense classification
-- Defines whether a category is essential (Mercado, Saúde) or lifestyle (Lazer)
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS is_essential boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.categories.is_essential IS 'Defines if category is essential (true) or lifestyle/discretionary (false). Used for automatic expense classification.';