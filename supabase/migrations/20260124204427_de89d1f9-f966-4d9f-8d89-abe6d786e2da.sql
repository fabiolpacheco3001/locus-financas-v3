-- Create Open Finance Connections table
CREATE TABLE public.open_finance_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  bank_id TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  bank_logo TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'active', 'expired', 'revoked', 'error')),
  permissions TEXT[] NOT NULL DEFAULT ARRAY['ACCOUNTS_READ', 'BALANCES_READ', 'TRANSACTIONS_READ'],
  last_sync_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '365 days'),
  external_connection_id TEXT,
  privacy_accepted BOOLEAN NOT NULL DEFAULT false,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for household lookups
CREATE INDEX idx_open_finance_connections_household ON public.open_finance_connections(household_id);

-- Add index for webhook lookups by external ID
CREATE INDEX idx_open_finance_connections_external ON public.open_finance_connections(external_connection_id) WHERE external_connection_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.open_finance_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access connections for their household
CREATE POLICY "Users can view their household connections"
ON public.open_finance_connections
FOR SELECT
USING (
  household_id IN (
    SELECT m.household_id FROM public.members m
    INNER JOIN public.member_identities mi ON mi.member_id = m.id
    WHERE mi.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create connections for their household"
ON public.open_finance_connections
FOR INSERT
WITH CHECK (
  household_id IN (
    SELECT m.household_id FROM public.members m
    INNER JOIN public.member_identities mi ON mi.member_id = m.id
    WHERE mi.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their household connections"
ON public.open_finance_connections
FOR UPDATE
USING (
  household_id IN (
    SELECT m.household_id FROM public.members m
    INNER JOIN public.member_identities mi ON mi.member_id = m.id
    WHERE mi.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their household connections"
ON public.open_finance_connections
FOR DELETE
USING (
  household_id IN (
    SELECT m.household_id FROM public.members m
    INNER JOIN public.member_identities mi ON mi.member_id = m.id
    WHERE mi.user_id = auth.uid()
  )
);

-- Trigger to update updated_at
CREATE TRIGGER update_open_finance_connections_updated_at
  BEFORE UPDATE ON public.open_finance_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();