/**
 * Maps authentication errors to i18n keys for proper localized error messages.
 * Prioritizes structured error fields (code, status, message, name).
 */

type AuthError = {
  code?: string;
  status?: number;
  message?: string;
  name?: string;
  error_description?: string;
};

/**
 * Patterns to detect leaked/HIBP password errors
 */
const LEAKED_PASSWORD_PATTERNS = [
  /leaked/i,
  /hibp/i,
  /pwned/i,
  /have i been pwned/i,
  /data breach/i,
  /compromised/i,
];

const LEAKED_PASSWORD_CODES = [
  'password_leaked',
  'leaked_password',
  'hibp_password',
  'pwned_password',
];

/**
 * Patterns to detect weak/policy password errors
 */
const WEAK_PASSWORD_PATTERNS = [
  /weak/i,
  /password should/i,
  /password must/i,
  /password.*at least/i,
  /characters/i,
  /length/i,
  /special/i,
  /uppercase/i,
  /lowercase/i,
  /number/i,
  /digit/i,
  /symbol/i,
  /policy/i,
  /does not meet/i,
  /requirements/i,
  /too short/i,
  /too simple/i,
  /strength/i,
];

const WEAK_PASSWORD_CODES = [
  'weak_password',
  'password_policy',
  'password_too_weak',
  'password_strength',
  'invalid_password',
];

/**
 * Patterns to detect invalid credentials
 */
const INVALID_CREDENTIALS_PATTERNS = [
  /invalid.*credentials/i,
  /invalid.*password/i,
  /incorrect.*password/i,
  /wrong.*password/i,
  /invalid login/i,
  /invalid email or password/i,
  /user not found/i,
  /no user/i,
];

const INVALID_CREDENTIALS_CODES = [
  'invalid_credentials',
  'invalid_grant',
  'invalid_login_credentials',
  'user_not_found',
];

/**
 * Patterns to detect email already in use
 */
const EMAIL_IN_USE_PATTERNS = [
  /already.*registered/i,
  /already.*exists/i,
  /already.*in use/i,
  /email.*taken/i,
  /user.*exists/i,
  /duplicate.*email/i,
];

const EMAIL_IN_USE_CODES = [
  'user_already_exists',
  'email_exists',
  'email_taken',
  'duplicate_email',
];

/**
 * Patterns to detect rate limiting / too many requests
 */
const RATE_LIMIT_PATTERNS = [
  /too many/i,
  /rate limit/i,
  /try again/i,
  /exceeded/i,
  /throttle/i,
];

const RATE_LIMIT_CODES = [
  'over_request_rate_limit',
  'rate_limit_exceeded',
  'too_many_requests',
  '429',
];

/**
 * Extract error details from various error formats
 */
function extractErrorDetails(err: unknown): AuthError {
  if (!err) return {};
  
  if (typeof err === 'string') {
    return { message: err };
  }
  
  const e = err as Record<string, unknown>;
  
  return {
    code: typeof e.code === 'string' ? e.code : undefined,
    status: typeof e.status === 'number' ? e.status : undefined,
    message: typeof e.message === 'string' ? e.message : undefined,
    name: typeof e.name === 'string' ? e.name : undefined,
    error_description: typeof e.error_description === 'string' ? e.error_description : undefined,
  };
}

/**
 * Check if any pattern matches the given text
 */
function matchesPatterns(text: string | undefined, patterns: RegExp[]): boolean {
  if (!text) return false;
  return patterns.some(pattern => pattern.test(text));
}

/**
 * Check if any code matches the given list
 */
function matchesCodes(code: string | undefined, codes: string[]): boolean {
  if (!code) return false;
  return codes.includes(code.toLowerCase());
}

/**
 * Check if status matches
 */
function matchesStatus(status: number | undefined, targetStatus: number): boolean {
  return status === targetStatus;
}

/**
 * Patterns to detect email not confirmed errors
 */
const EMAIL_NOT_CONFIRMED_PATTERNS = [
  /email.*not confirmed/i,
  /email confirmation/i,
  /confirm.*email/i,
  /verify.*email/i,
  /not verified/i,
];

const EMAIL_NOT_CONFIRMED_CODES = [
  'email_not_confirmed',
  'unverified_email',
];

/**
 * Maps authentication errors to i18n keys.
 * 
 * @param err - The error object from Supabase Auth
 * @returns The i18n key for the error message
 * 
 * Priority order:
 * 1. Rate limit -> 'auth.errors.rateLimit'
 * 2. Leaked/HIBP password -> 'auth.passwordLeaked'
 * 3. Weak/policy password -> 'auth.errors.passwordWeak'
 * 4. Email already in use -> 'auth.errors.emailAlreadyInUse'
 * 5. Invalid credentials -> 'auth.errors.invalidCredentials'
 * 6. Fallback -> 'auth.errors.generic'
 */
export function mapAuthErrorToI18nKey(err: unknown): string {
  const details = extractErrorDetails(err);
  
  const textToCheck = [
    details.message,
    details.error_description,
    details.name,
  ].filter(Boolean) as string[];
  
  // Check for rate limiting (highest priority - user needs to wait)
  if (matchesStatus(details.status, 429) || matchesCodes(details.code, RATE_LIMIT_CODES)) {
    return 'auth.errors.rateLimit';
  }
  
  for (const text of textToCheck) {
    if (matchesPatterns(text, RATE_LIMIT_PATTERNS)) {
      return 'auth.errors.rateLimit';
    }
  }
  
  // Check for leaked password
  if (matchesCodes(details.code, LEAKED_PASSWORD_CODES)) {
    return 'auth.passwordLeaked';
  }
  
  for (const text of textToCheck) {
    if (matchesPatterns(text, LEAKED_PASSWORD_PATTERNS)) {
      return 'auth.passwordLeaked';
    }
  }
  
  // Check for weak password / policy violation
  if (matchesCodes(details.code, WEAK_PASSWORD_CODES)) {
    return 'auth.errors.passwordWeak';
  }
  
  for (const text of textToCheck) {
    if (matchesPatterns(text, WEAK_PASSWORD_PATTERNS)) {
      return 'auth.errors.passwordWeak';
    }
  }
  
  // Check for email already in use
  if (matchesCodes(details.code, EMAIL_IN_USE_CODES)) {
    return 'auth.errors.emailAlreadyInUse';
  }
  
  for (const text of textToCheck) {
    if (matchesPatterns(text, EMAIL_IN_USE_PATTERNS)) {
      return 'auth.errors.emailAlreadyInUse';
    }
  }
  
  // Check for invalid credentials
  if (matchesCodes(details.code, INVALID_CREDENTIALS_CODES)) {
    return 'auth.errors.invalidCredentials';
  }
  
  for (const text of textToCheck) {
    if (matchesPatterns(text, INVALID_CREDENTIALS_PATTERNS)) {
      return 'auth.errors.invalidCredentials';
    }
  }
  
  // Check for email not confirmed
  if (matchesCodes(details.code, EMAIL_NOT_CONFIRMED_CODES)) {
    return 'auth.errors.emailNotConfirmed';
  }
  
  for (const text of textToCheck) {
    if (matchesPatterns(text, EMAIL_NOT_CONFIRMED_PATTERNS)) {
      return 'auth.errors.emailNotConfirmed';
    }
  }
  
  // Fallback to generic error
  return 'auth.errors.generic';
}
