import { supabase } from '@/integrations/supabase/client';

export interface UserIdentity {
  userId: string;
  householdId: string;
  email: string | null;
  createdAt: string;
}

export interface UserContext {
  householdId: string;
  memberId: string;
}

/**
 * Get the current user's email from the Supabase session.
 * This is the secure way to get email - never query member_identities directly.
 */
export async function getEffectiveUserEmail(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.email ?? null;
}

/**
 * Get the current user's email synchronously from a session object.
 * Use this when you already have a session reference.
 */
export function getEmailFromSession(session: { user?: { email?: string | null } } | null): string | null {
  return session?.user?.email ?? null;
}

/**
 * Get the current user's identity (user_id, household_id, email) via secure RPC.
 * Email comes from JWT, not from the database.
 * This avoids direct table access and respects RLS.
 */
export async function getMyIdentity(): Promise<UserIdentity | null> {
  const { data, error } = await supabase.rpc('get_my_identity');
  
  if (error || !data || data.length === 0) {
    return null;
  }

  const identity = data[0];
  return {
    userId: identity.user_id,
    householdId: identity.household_id,
    email: identity.email,
    createdAt: identity.created_at
  };
}

/**
 * Get the user's context (household_id, member_id) via secure RPC.
 * Use this when you need both household and member IDs.
 */
export async function getUserContext(): Promise<UserContext | null> {
  const { data, error } = await supabase.rpc('get_user_context');
  
  if (error || !data || data.length === 0) {
    return null;
  }

  const context = data[0];
  return {
    householdId: context.household_id,
    memberId: context.member_id
  };
}

/**
 * Get household ID for the current user via RPC.
 * Uses the optimized get_user_household_id RPC.
 */
export async function getMyHouseholdId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_user_household_id');
  
  if (error || !data) {
    return null;
  }
  
  return data;
}

/**
 * Create a member identity link (only for onboarding).
 * This securely links the current user to a household/member.
 */
export async function createMemberIdentity(
  householdId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('create_member_identity', {
    p_household_id: householdId,
    p_member_id: memberId
  });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}
