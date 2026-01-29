-- Create risk events table
CREATE TABLE public.risk_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('MONTH_AT_RISK', 'PAYMENT_DELAYED', 'RISK_REDUCED', 'MONTH_RECOVERED')),
  reference_month text NOT NULL, -- YYYY-MM format
  reference_id uuid NULL, -- Optional: transaction_id, account_id, etc.
  reference_type text NULL, -- 'transaction', 'account', 'simulation'
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view risk events in their household"
ON public.risk_events
FOR SELECT
USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert risk events"
ON public.risk_events
FOR INSERT
WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can delete risk events"
ON public.risk_events
FOR DELETE
USING (household_id = get_user_household_id());

-- Create indexes
CREATE INDEX idx_risk_events_household ON public.risk_events(household_id);
CREATE INDEX idx_risk_events_type ON public.risk_events(event_type);
CREATE INDEX idx_risk_events_month ON public.risk_events(reference_month);
CREATE INDEX idx_risk_events_created ON public.risk_events(created_at DESC);