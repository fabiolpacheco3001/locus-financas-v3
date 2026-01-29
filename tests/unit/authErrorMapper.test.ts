import { describe, it, expect } from 'vitest';
import { mapAuthErrorToI18nKey } from '@/lib/authErrorMapper';

describe('mapAuthErrorToI18nKey', () => {
  describe('leaked password detection', () => {
    it('detects leaked password by code', () => {
      expect(mapAuthErrorToI18nKey({ code: 'password_leaked' })).toBe('auth.passwordLeaked');
      expect(mapAuthErrorToI18nKey({ code: 'hibp_password' })).toBe('auth.passwordLeaked');
    });

    it('detects leaked password by message pattern', () => {
      expect(mapAuthErrorToI18nKey({ message: 'Password has been leaked in a data breach' }))
        .toBe('auth.passwordLeaked');
      expect(mapAuthErrorToI18nKey({ message: 'This password was found in HIBP database' }))
        .toBe('auth.passwordLeaked');
      expect(mapAuthErrorToI18nKey({ message: 'Password is pwned' }))
        .toBe('auth.passwordLeaked');
    });
  });

  describe('weak password detection', () => {
    it('detects weak password by code', () => {
      expect(mapAuthErrorToI18nKey({ code: 'weak_password' })).toBe('auth.errors.passwordWeak');
      expect(mapAuthErrorToI18nKey({ code: 'password_policy' })).toBe('auth.errors.passwordWeak');
    });

    it('detects weak password by message pattern', () => {
      expect(mapAuthErrorToI18nKey({ message: 'Password is too weak' }))
        .toBe('auth.errors.passwordWeak');
      expect(mapAuthErrorToI18nKey({ message: 'Password must contain at least 8 characters' }))
        .toBe('auth.errors.passwordWeak');
      expect(mapAuthErrorToI18nKey({ message: 'Password should include uppercase letters' }))
        .toBe('auth.errors.passwordWeak');
    });
  });

  describe('invalid credentials detection', () => {
    it('detects invalid credentials by code', () => {
      expect(mapAuthErrorToI18nKey({ code: 'invalid_credentials' })).toBe('auth.errors.invalidCredentials');
      expect(mapAuthErrorToI18nKey({ code: 'invalid_grant' })).toBe('auth.errors.invalidCredentials');
      expect(mapAuthErrorToI18nKey({ code: 'invalid_login_credentials' })).toBe('auth.errors.invalidCredentials');
    });

    it('detects invalid credentials by message pattern', () => {
      expect(mapAuthErrorToI18nKey({ message: 'Invalid login credentials' }))
        .toBe('auth.errors.invalidCredentials');
      expect(mapAuthErrorToI18nKey({ message: 'Invalid email or password' }))
        .toBe('auth.errors.invalidCredentials');
      expect(mapAuthErrorToI18nKey({ message: 'User not found' }))
        .toBe('auth.errors.invalidCredentials');
    });
  });

  describe('email already in use detection', () => {
    it('detects email in use by code', () => {
      expect(mapAuthErrorToI18nKey({ code: 'user_already_exists' })).toBe('auth.errors.emailAlreadyInUse');
      expect(mapAuthErrorToI18nKey({ code: 'email_exists' })).toBe('auth.errors.emailAlreadyInUse');
    });

    it('detects email in use by message pattern', () => {
      expect(mapAuthErrorToI18nKey({ message: 'Email is already registered' }))
        .toBe('auth.errors.emailAlreadyInUse');
      expect(mapAuthErrorToI18nKey({ message: 'User already exists' }))
        .toBe('auth.errors.emailAlreadyInUse');
      expect(mapAuthErrorToI18nKey({ message: 'This email is already in use' }))
        .toBe('auth.errors.emailAlreadyInUse');
    });
  });

  describe('rate limiting detection', () => {
    it('detects rate limit by status 429', () => {
      expect(mapAuthErrorToI18nKey({ status: 429 })).toBe('auth.errors.rateLimit');
    });

    it('detects rate limit by code', () => {
      expect(mapAuthErrorToI18nKey({ code: 'over_request_rate_limit' })).toBe('auth.errors.rateLimit');
      expect(mapAuthErrorToI18nKey({ code: 'too_many_requests' })).toBe('auth.errors.rateLimit');
    });

    it('detects rate limit by message pattern', () => {
      expect(mapAuthErrorToI18nKey({ message: 'Too many requests' }))
        .toBe('auth.errors.rateLimit');
      expect(mapAuthErrorToI18nKey({ message: 'Rate limit exceeded' }))
        .toBe('auth.errors.rateLimit');
    });
  });

  describe('fallback to generic error', () => {
    it('returns generic error for unknown errors', () => {
      expect(mapAuthErrorToI18nKey({ message: 'Something went wrong' })).toBe('auth.errors.generic');
      expect(mapAuthErrorToI18nKey({})).toBe('auth.errors.generic');
      expect(mapAuthErrorToI18nKey(null)).toBe('auth.errors.generic');
      expect(mapAuthErrorToI18nKey(undefined)).toBe('auth.errors.generic');
    });

    it('handles string errors', () => {
      expect(mapAuthErrorToI18nKey('Unknown error')).toBe('auth.errors.generic');
    });
  });

  describe('priority order', () => {
    it('rate limit takes priority over other errors', () => {
      // Rate limit should win even if message contains other patterns
      expect(mapAuthErrorToI18nKey({ 
        status: 429, 
        message: 'Password is too weak' 
      })).toBe('auth.errors.rateLimit');
    });

    it('leaked password takes priority over weak password', () => {
      expect(mapAuthErrorToI18nKey({ 
        message: 'Password was found in a data breach and is too weak' 
      })).toBe('auth.passwordLeaked');
    });
  });
});
