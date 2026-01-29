/**
 * Masks an email address for privacy, showing only first 2 chars and domain.
 * Example: "john.doe@example.com" -> "jo***@example.com"
 * 
 * @param email - The email address to mask
 * @returns The masked email or empty string if input is null/undefined
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  
  const atIndex = email.indexOf('@');
  if (atIndex < 0) return '***';
  
  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex);
  
  if (localPart.length <= 2) {
    return `${localPart}***${domain}`;
  }
  
  const visibleChars = localPart.substring(0, 2);
  return `${visibleChars}***${domain}`;
}
