-- Create user_stats table for gamification
CREATE TABLE public.user_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL UNIQUE,
  current_level integer NOT NULL DEFAULT 1,
  current_xp integer NOT NULL DEFAULT 0,
  total_xp integer NOT NULL DEFAULT 0,
  streak_days integer NOT NULL DEFAULT 0,
  last_activity_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their household stats"
ON public.user_stats FOR SELECT
USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert their household stats"
ON public.user_stats FOR INSERT
WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update their household stats"
ON public.user_stats FOR UPDATE
USING (household_id = get_user_household_id());

-- Create trigger for updated_at
CREATE TRIGGER update_user_stats_updated_at
BEFORE UPDATE ON public.user_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();