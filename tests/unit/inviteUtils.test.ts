import { describe, it, expect, vi } from 'vitest';
import { normalizeToken, buildInviteLink, isValidTokenFormat, copyToClipboard } from '@/lib/inviteUtils';

describe('inviteUtils', () => {
  describe('normalizeToken', () => {
    it('trims whitespace', () => {
      expect(normalizeToken('  abc123  ')).toBe('abc123');
    });

    it('removes newlines and tabs', () => {
      expect(normalizeToken('abc\n123\t456')).toBe('abc123456');
    });

    it('removes quotes and angle brackets', () => {
      expect(normalizeToken('"abc123"')).toBe('abc123');
      expect(normalizeToken('<abc123>')).toBe('abc123');
    });

    it('returns empty string for falsy input', () => {
      expect(normalizeToken('')).toBe('');
    });
  });

  describe('buildInviteLink', () => {
    it('builds correct URL with token', () => {
      const link = buildInviteLink('abc123');
      expect(link).toContain('/join?token=abc123');
    });

    it('encodes special characters', () => {
      const link = buildInviteLink('abc+123');
      expect(link).toContain('abc%2B123');
    });

    it('returns empty string for empty token', () => {
      expect(buildInviteLink('')).toBe('');
    });

    it('uses custom base path', () => {
      const link = buildInviteLink('abc123', '/invite');
      expect(link).toContain('/invite?token=abc123');
    });
  });

  describe('isValidTokenFormat', () => {
    it('returns true for valid hex token', () => {
      expect(isValidTokenFormat('abcdef1234567890abcdef')).toBe(true);
    });

    it('returns false for short token', () => {
      expect(isValidTokenFormat('abc123')).toBe(false);
    });

    it('returns false for non-hex characters', () => {
      expect(isValidTokenFormat('abcdefghijklmnopqrst')).toBe(false);
    });
  });

  describe('copyToClipboard', () => {
    it('returns false for empty text', async () => {
      const result = await copyToClipboard('');
      expect(result).toBe(false);
    });

    it('uses navigator.clipboard when available', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText }
      });

      const result = await copyToClipboard('test');
      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('test');
    });
  });
});
