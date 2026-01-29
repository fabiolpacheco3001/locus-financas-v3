import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

import { supabase } from '@/integrations/supabase/client';
import { 
  createHouseholdInvite, 
  acceptHouseholdInvite,
  getHouseholdInvites,
  deleteHouseholdInvite,
  buildInviteUrl 
} from '@/lib/householdInvites';

describe('householdInvites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createHouseholdInvite', () => {
    it('returns invite_id, token and expiry on success', async () => {
      // RPC returns table with invite_id, token, expires_at
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [{ invite_id: 'inv-123', token: 'abc123def456', expires_at: '2026-01-27T00:00:00Z' }],
        error: null
      } as any);

      const result = await createHouseholdInvite({ email: 'test@example.com' });
      
      expect(supabase.rpc).toHaveBeenCalledWith('create_household_invite', {
        p_invited_email: 'test@example.com',
        p_role: 'MEMBER',
        p_expires_in_days: 7
      });
      expect(result).not.toBeNull();
      expect(result?.token).toBe('abc123def456');
      expect(result?.inviteId).toBe('inv-123');
      expect(result?.expiresAt).toBe('2026-01-27T00:00:00Z');
    });

    it('returns null on error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'ADMIN_REQUIRED' }
      } as any);

      const result = await createHouseholdInvite({ email: 'test@example.com' });
      expect(result).toBeNull();
    });
  });

  describe('acceptHouseholdInvite', () => {
    it('returns success with household ID', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 'hh-123-uuid',
        error: null
      } as any);

      const result = await acceptHouseholdInvite('valid-token');
      
      expect(supabase.rpc).toHaveBeenCalledWith('accept_household_invite', {
        p_token: 'valid-token'
      });
      expect(result).toEqual({
        success: true,
        householdId: 'hh-123-uuid'
      });
    });

    it('returns error on RPC failure', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'identity_already_exists' }
      } as any);

      const result = await acceptHouseholdInvite('token');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('identity_already_exists');
    });

    it('handles empty data', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null
      } as any);

      const result = await acceptHouseholdInvite('token');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('acceptHouseholdInviteById', () => {
    it('returns success with household ID', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 'hh-123-uuid',
        error: null
      } as any);

      const { acceptHouseholdInviteById } = await import('@/lib/householdInvites');
      const result = await acceptHouseholdInviteById('invite-id-123');
      
      expect(supabase.rpc).toHaveBeenCalledWith('accept_household_invite_by_id', {
        p_invite_id: 'invite-id-123'
      });
      expect(result).toEqual({
        success: true,
        householdId: 'hh-123-uuid'
      });
    });

    it('returns error on RPC failure', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'invite_email_mismatch' }
      } as any);

      const { acceptHouseholdInviteById } = await import('@/lib/householdInvites');
      const result = await acceptHouseholdInviteById('invite-id');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('invite_email_mismatch');
    });
  });

  describe('getMyPendingInvites', () => {
    it('returns pending invites via RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          { id: 'inv-1', household_id: 'hh-1', role: 'MEMBER', expires_at: '2026-01-27T00:00:00Z', created_at: '2026-01-20T00:00:00Z' }
        ],
        error: null
      } as any);

      const { getMyPendingInvites } = await import('@/lib/householdInvites');
      const result = await getMyPendingInvites();
      
      expect(supabase.rpc).toHaveBeenCalledWith('get_my_pending_invites');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'inv-1',
        householdId: 'hh-1',
        role: 'MEMBER',
        expiresAt: '2026-01-27T00:00:00Z',
        createdAt: '2026-01-20T00:00:00Z'
      });
    });

    it('returns empty array on error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'error' }
      } as any);

      const { getMyPendingInvites } = await import('@/lib/householdInvites');
      const result = await getMyPendingInvites();
      expect(result).toEqual([]);
    });
  });

  describe('getHouseholdInvites', () => {
    it('returns invites list via RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          { id: 'inv-1', invited_email: 'user1@test.com', role: 'MEMBER', expires_at: '2026-01-27T00:00:00Z', accepted_at: null, created_at: '2026-01-20T00:00:00Z' },
          { id: 'inv-2', invited_email: 'user2@test.com', role: 'ADMIN', expires_at: '2026-01-28T00:00:00Z', accepted_at: '2026-01-21T00:00:00Z', created_at: '2026-01-19T00:00:00Z' }
        ],
        error: null
      } as any);

      const result = await getHouseholdInvites('hh-123');
      
      expect(supabase.rpc).toHaveBeenCalledWith('list_household_invites', {
        p_household_id: 'hh-123'
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'inv-1',
        invitedEmail: 'user1@test.com',
        role: 'MEMBER',
        expiresAt: '2026-01-27T00:00:00Z',
        createdAt: '2026-01-20T00:00:00Z',
        acceptedAt: null
      });
    });

    it('returns empty array on error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'not_allowed' }
      } as any);

      const result = await getHouseholdInvites('hh-123');
      expect(result).toEqual([]);
    });
  });

  describe('deleteHouseholdInvite', () => {
    it('returns true on success', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null
      } as any);

      const result = await deleteHouseholdInvite('inv-123');
      
      expect(supabase.rpc).toHaveBeenCalledWith('delete_household_invite', {
        p_invite_id: 'inv-123'
      });
      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'not_allowed' }
      } as any);

      const result = await deleteHouseholdInvite('inv-123');
      expect(result).toBe(false);
    });

    it('returns false when RPC returns false', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: false,
        error: null
      } as any);

      const result = await deleteHouseholdInvite('inv-123');
      expect(result).toBe(false);
    });
  });

  describe('buildInviteUrl', () => {
    it('builds correct URL with encoded token', () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://example.com' },
        writable: true
      });

      const url = buildInviteUrl('abc123');
      expect(url).toBe('https://example.com/join?token=abc123');

      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true
      });
    });

    it('encodes special characters in token', () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://example.com' },
        writable: true
      });

      const url = buildInviteUrl('token+with/special=chars');
      expect(url).toContain('token%2Bwith%2Fspecial%3Dchars');

      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true
      });
    });
  });
});
