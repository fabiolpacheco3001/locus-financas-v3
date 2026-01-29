import { describe, it, expect } from 'vitest';
import { sanitizeInviteToken } from '@/lib/sanitizeInviteToken';

describe('sanitizeInviteToken', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeInviteToken('')).toBe('');
  });

  it('returns empty string for null-like input', () => {
    expect(sanitizeInviteToken(undefined as any)).toBe('');
    expect(sanitizeInviteToken(null as any)).toBe('');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeInviteToken('  abc123  ')).toBe('abc123');
    expect(sanitizeInviteToken('\n\tabc123\n\t')).toBe('abc123');
  });

  it('removes internal spaces', () => {
    expect(sanitizeInviteToken('abc 123 def')).toBe('abc123def');
    expect(sanitizeInviteToken('abc  123  def')).toBe('abc123def');
  });

  it('removes internal newlines and tabs', () => {
    expect(sanitizeInviteToken('abc\n123\tdef')).toBe('abc123def');
  });

  it('handles tokens with mixed whitespace', () => {
    expect(sanitizeInviteToken('  abc\n 123 \t def  ')).toBe('abc123def');
  });

  it('preserves valid token characters', () => {
    const validToken = 'a1b2c3d4e5f6g7h8i9j0klmnopqrstuvwxyz';
    expect(sanitizeInviteToken(validToken)).toBe(validToken);
  });

  it('handles hex tokens correctly', () => {
    const hexToken = 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';
    expect(sanitizeInviteToken(hexToken)).toBe(hexToken);
    expect(sanitizeInviteToken(`  ${hexToken}  `)).toBe(hexToken);
  });
});
