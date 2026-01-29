import { supabase } from '@/integrations/supabase/client';

export interface HouseholdInvite {
  id: string;
  invitedEmail: string | null;
  role: string | null;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
}

export interface CreateInviteOptions {
  email?: string;
  role?: 'ADMIN' | 'MEMBER';
  daysValid?: number;
}

/**
 * Create a new household invite (admin only).
 * Returns the invite token and expiration date.
 * 
 * The new RPC signature requires household_id which we get from user context.
 */
export async function createHouseholdInvite(
  options: CreateInviteOptions = {}
): Promise<{ token: string; expiresAt: string; inviteId: string } | null> {
  // New RPC signature: (p_invited_email, p_role, p_expires_in_days)
  const { data, error } = await supabase.rpc('create_household_invite', {
    p_invited_email: options.email || null,
    p_role: options.role || 'MEMBER',
    p_expires_in_days: options.daysValid || 7
  });
  
  if (error) {
    console.error('Failed to create invite:', error.message);
    return null;
  }

  // RPC returns table with invite_id, token, expires_at
  if (data && data.length > 0) {
    const result = data[0];
    return {
      inviteId: result.invite_id,
      token: result.token,
      expiresAt: result.expires_at
    };
  }

  console.error('No data returned from create_household_invite');
  return null;
}

/**
 * Accept a household invite using a token (link flow).
 * Creates a new member and identity link for the current user.
 */
export async function acceptHouseholdInvite(
  token: string
): Promise<{ 
  success: boolean; 
  householdId?: string; 
  error?: string 
}> {
  const { data, error } = await supabase.rpc('accept_household_invite', {
    p_token: token
  });
  
  if (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }

  if (!data) {
    return { success: false, error: 'invite_processing_failed' };
  }

  return {
    success: true,
    householdId: data as string
  };
}

/**
 * Accept a household invite by ID (inbox flow - no token needed).
 * The invite must be addressed to the current user's email.
 */
export async function acceptHouseholdInviteById(
  inviteId: string
): Promise<{ 
  success: boolean; 
  householdId?: string; 
  error?: string 
}> {
  const { data, error } = await supabase.rpc('accept_household_invite_by_id', {
    p_invite_id: inviteId
  });
  
  if (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }

  if (!data) {
    return { success: false, error: 'invite_processing_failed' };
  }

  return {
    success: true,
    householdId: data as string
  };
}

/**
 * Get pending invites for the current user (via email).
 * Uses RPC to securely fetch invites addressed to the user's email.
 */
export async function getMyPendingInvites(): Promise<{
  id: string;
  householdId: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}[]> {
  const { data, error } = await supabase.rpc('get_my_pending_invites');
  
  if (error || !data) {
    console.error('Failed to get pending invites:', error?.message);
    return [];
  }

  return data.map((inv: { id: string; household_id: string; role: string; expires_at: string; created_at: string }) => ({
    id: inv.id,
    householdId: inv.household_id,
    role: inv.role,
    expiresAt: inv.expires_at,
    createdAt: inv.created_at,
  }));
}

/**
 * Get all invites for the current household (admin only).
 * Uses RPC to avoid direct table access (RLS blocks all direct access).
 */
export async function getHouseholdInvites(householdId: string): Promise<HouseholdInvite[]> {
  const { data, error } = await supabase.rpc('list_household_invites', {
    p_household_id: householdId
  });
  
  if (error || !data) {
    console.error('Failed to list invites:', error?.message);
    return [];
  }

  return data.map((invite) => ({
    id: invite.id,
    invitedEmail: invite.invited_email,
    role: invite.role,
    expiresAt: invite.expires_at,
    createdAt: invite.created_at,
    acceptedAt: invite.accepted_at
  }));
}

/**
 * Delete an invite (admin only).
 * Uses RPC to avoid direct table access.
 */
export async function deleteHouseholdInvite(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_household_invite', {
    p_invite_id: id
  });
  
  if (error) {
    console.error('Failed to delete invite:', error.message);
    return false;
  }
  
  return data === true;
}

/**
 * Build invite URL for sharing.
 */
export function buildInviteUrl(token: string): string {
  return `${window.location.origin}/join?token=${encodeURIComponent(token)}`;
}
