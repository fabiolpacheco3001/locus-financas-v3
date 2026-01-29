import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn()
    },
    rpc: vi.fn()
  }
}));

import { supabase } from '@/integrations/supabase/client';
import { 
  getEffectiveUserEmail, 
  getEmailFromSession, 
  getMyIdentity,
  getMyHouseholdId,
  getUserContext,
  createMemberIdentity
} from '@/lib/identityHelpers';

describe('identityHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEffectiveUserEmail', () => {
    it('returns email from active session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { email: 'test@example.com' }
          } as any
        },
        error: null
      });

      const email = await getEffectiveUserEmail();
      expect(email).toBe('test@example.com');
    });

    it('returns null when no session exists', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const email = await getEffectiveUserEmail();
      expect(email).toBeNull();
    });

    it('returns null when session has no user', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: null } as any },
        error: null
      });

      const email = await getEffectiveUserEmail();
      expect(email).toBeNull();
    });
  });

  describe('getEmailFromSession', () => {
    it('extracts email from session object', () => {
      const session = { user: { email: 'user@test.com' } };
      expect(getEmailFromSession(session)).toBe('user@test.com');
    });

    it('returns null for null session', () => {
      expect(getEmailFromSession(null)).toBeNull();
    });

    it('returns null for session without email', () => {
      const session = { user: { email: null } };
      expect(getEmailFromSession(session)).toBeNull();
    });
  });

  describe('getMyIdentity', () => {
    it('returns identity from RPC call', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [{
          user_id: 'user-123',
          household_id: 'hh-456',
          email: 'test@example.com',
          created_at: '2025-01-01T00:00:00Z'
        }],
        error: null
      } as any);

      const identity = await getMyIdentity();
      
      expect(supabase.rpc).toHaveBeenCalledWith('get_my_identity');
      expect(identity).toEqual({
        userId: 'user-123',
        householdId: 'hh-456',
        email: 'test@example.com',
        createdAt: '2025-01-01T00:00:00Z'
      });
    });

    it('returns null when RPC returns empty array', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [],
        error: null
      } as any);

      const identity = await getMyIdentity();
      expect(identity).toBeNull();
    });

    it('returns null when RPC errors', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Not authenticated' }
      } as any);

      const identity = await getMyIdentity();
      expect(identity).toBeNull();
    });
  });

  describe('getUserContext', () => {
    it('returns context from RPC call', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [{
          household_id: 'hh-456',
          member_id: 'member-789'
        }],
        error: null
      } as any);

      const context = await getUserContext();
      
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_context');
      expect(context).toEqual({
        householdId: 'hh-456',
        memberId: 'member-789'
      });
    });

    it('returns null when RPC returns empty array', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [],
        error: null
      } as any);

      const context = await getUserContext();
      expect(context).toBeNull();
    });

    it('returns null when RPC errors', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Not authenticated' }
      } as any);

      const context = await getUserContext();
      expect(context).toBeNull();
    });
  });

  describe('getMyHouseholdId', () => {
    it('returns household ID from RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 'hh-789',
        error: null
      } as any);

      const householdId = await getMyHouseholdId();
      
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_household_id');
      expect(householdId).toBe('hh-789');
    });

    it('returns null when no identity found', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null
      } as any);

      const householdId = await getMyHouseholdId();
      expect(householdId).toBeNull();
    });

    it('returns null when RPC errors', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Not authenticated' }
      } as any);

      const householdId = await getMyHouseholdId();
      expect(householdId).toBeNull();
    });
  });

  describe('createMemberIdentity', () => {
    it('returns success when RPC succeeds (bootstrap)', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null
      } as any);

      const result = await createMemberIdentity('hh-123', 'member-456');
      
      expect(supabase.rpc).toHaveBeenCalledWith('create_member_identity', {
        p_household_id: 'hh-123',
        p_member_id: 'member-456'
      });
      expect(result).toEqual({ success: true });
    });

    it('returns error when identity already exists', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'identity_already_exists' }
      } as any);

      const result = await createMemberIdentity('hh-123', 'member-456');
      
      expect(result).toEqual({ 
        success: false, 
        error: 'identity_already_exists' 
      });
    });

    it('returns error when household not found', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'household_not_found' }
      } as any);

      const result = await createMemberIdentity('hh-invalid', 'member-456');
      
      expect(result).toEqual({ 
        success: false, 
        error: 'household_not_found' 
      });
    });

    it('returns error when household requires invite (not empty)', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'household_requires_invite' }
      } as any);

      const result = await createMemberIdentity('hh-existing', 'member-789');
      
      expect(result).toEqual({ 
        success: false, 
        error: 'household_requires_invite' 
      });
    });
  });
});
