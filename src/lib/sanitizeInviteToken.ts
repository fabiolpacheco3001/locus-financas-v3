/**
 * Sanitize an invite token by trimming whitespace and removing internal spaces.
 * This handles common user errors when pasting tokens.
 */
export function sanitizeInviteToken(input: string): string {
  if (!input) return '';
  
  // Trim leading/trailing whitespace and remove all internal whitespace
  return input.trim().replace(/\s+/g, '');
}
