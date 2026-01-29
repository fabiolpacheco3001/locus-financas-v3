-- Change reference_id from UUID to TEXT to allow flexible grouping keys
ALTER TABLE public.notifications 
ALTER COLUMN reference_id TYPE TEXT;