/**
 * Open Finance Webhook Listener
 * 
 * Receives callbacks from Open Finance providers (Pluggy/Belvo style)
 * and updates the connection status in our database.
 * 
 * Events handled:
 * - connection.authorized: Bank authorized the connection
 * - connection.synced: Data sync completed
 * - connection.revoked: User revoked access
 * - connection.error: Connection error occurred
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Webhook payload types
interface WebhookPayload {
  event: 'connection.authorized' | 'connection.synced' | 'connection.revoked' | 'connection.error';
  connection_id: string;
  external_connection_id: string;
  timestamp: string;
  data?: {
    accounts_count?: number;
    transactions_count?: number;
    error_message?: string;
  };
}

// Status mapping
const eventToStatus: Record<string, string> = {
  'connection.authorized': 'authorized',
  'connection.synced': 'active',
  'connection.revoked': 'revoked',
  'connection.error': 'error',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Validate webhook secret (in production, this would be a real secret)
    const webhookSecret = req.headers.get('x-webhook-secret');
    const expectedSecret = Deno.env.get('OPEN_FINANCE_WEBHOOK_SECRET') || 'mock-webhook-secret';
    
    if (webhookSecret !== expectedSecret) {
      console.warn('Invalid webhook secret received');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the webhook payload
    const payload: WebhookPayload = await req.json();
    console.log('Received webhook:', JSON.stringify(payload));

    // Validate required fields
    if (!payload.event || !payload.external_connection_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: event, external_connection_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the connection by external ID
    const { data: connection, error: findError } = await supabase
      .from('open_finance_connections')
      .select('id, household_id, status')
      .eq('external_connection_id', payload.external_connection_id)
      .single();

    if (findError || !connection) {
      console.error('Connection not found:', payload.external_connection_id);
      return new Response(
        JSON.stringify({ error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine new status
    const newStatus = eventToStatus[payload.event];
    if (!newStatus) {
      console.warn('Unknown event type:', payload.event);
      return new Response(
        JSON.stringify({ error: 'Unknown event type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Add sync timestamp for synced events
    if (payload.event === 'connection.synced') {
      updateData.last_sync_at = new Date().toISOString();
    }

    // Update the connection status
    const { error: updateError } = await supabase
      .from('open_finance_connections')
      .update(updateData)
      .eq('id', connection.id);

    if (updateError) {
      console.error('Failed to update connection:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update connection' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Connection ${connection.id} updated to status: ${newStatus}`);

    // If synced, trigger notification to the household
    if (payload.event === 'connection.synced' && payload.data) {
      // In a real implementation, this would:
      // 1. Trigger a sync of transactions from the provider
      // 2. Create a notification for the user
      // 3. Invalidate any relevant caches
      console.log(`Sync complete: ${payload.data.accounts_count} accounts, ${payload.data.transactions_count} transactions`);
    }

    // Return success
    return new Response(
      JSON.stringify({ 
        success: true, 
        connection_id: connection.id,
        new_status: newStatus,
        message: `Connection updated successfully`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook processing error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
