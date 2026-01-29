import { describe, it, expect } from 'vitest';
import { maskEmail } from '@/lib/maskEmail';

describe('maskEmail', () => {
  it('should mask standard email correctly', () => {
    expect(maskEmail('john.doe@example.com')).toBe('jo***@example.com');
  });

  it('should mask email with short local part', () => {
    expect(maskEmail('ab@test.com')).toBe('ab***@test.com');
  });

  it('should mask email with single char local part', () => {
    expect(maskEmail('a@test.com')).toBe('a***@test.com');
  });

  it('should return empty string for null', () => {
    expect(maskEmail(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(maskEmail(undefined)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(maskEmail('')).toBe('');
  });

  it('should handle email without @ symbol', () => {
    expect(maskEmail('notanemail')).toBe('***');
  });

  it('should preserve domain correctly', () => {
    expect(maskEmail('user@subdomain.example.org')).toBe('us***@subdomain.example.org');
  });

  it('should handle numeric local part', () => {
    expect(maskEmail('12345@test.com')).toBe('12***@test.com');
  });
});
