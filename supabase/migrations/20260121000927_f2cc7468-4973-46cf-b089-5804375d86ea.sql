-- =========================================
-- CRITICAL SECURITY FIX: Zero Trust Database Hardening
-- =========================================

-- =============================================
-- 1. FIX: household_invites - REVOKE direct table access
-- This blocks all direct SELECT/INSERT/UPDATE/DELETE from API clients
-- RPCs with SECURITY DEFINER will still work (they run as owner)
-- =============================================

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.household_invites FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.household_invites FROM authenticated;

-- Verify token_hash is never exposed: since we revoked all access,
-- no direct query can reach the table. Only SECURITY DEFINER RPCs
-- that explicitly don't return token_hash can access data.

-- =============================================
-- 2. FIX: member_identities - Allow Admin DELETE for member management
-- Admins need to be able to remove members from their household
-- =============================================

-- First, drop the existing block-all DELETE policy
DROP POLICY IF EXISTS member_identities_delete_block ON public.member_identities;

-- Create a new policy that allows household admins to delete member identities
-- Uses is_household_admin function to avoid recursion
CREATE POLICY member_identities_admin_delete
ON public.member_identities
FOR DELETE
TO authenticated
USING (
  -- The identity being deleted must belong to the same household as the admin
  household_id = public.get_user_household_id()
  -- And the user must be an admin of that household
  AND public.is_household_admin()
  -- Prevent self-deletion (admin cannot remove their own identity)
  AND user_id <> auth.uid()
);

-- =============================================
-- 3. SAFETY: Ensure RLS policies on household_invites still exist
-- Even though we revoked direct access, keep RLS as defense-in-depth
-- =============================================

-- Verify RLS is enabled and forced
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites FORCE ROW LEVEL SECURITY;