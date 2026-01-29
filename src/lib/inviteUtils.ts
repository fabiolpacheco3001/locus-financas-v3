/**
 * Utility functions for household invites
 */

/**
 * Normalizes a token by trimming whitespace and removing common formatting characters
 */
export function normalizeToken(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/[\s\n\r\t]/g, '') // Remove all whitespace
    .replace(/['"<>]/g, '');     // Remove common copy-paste artifacts
}

/**
 * Builds an invite link from a token
 */
export function buildInviteLink(token: string, basePath = '/join'): string {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) return '';
  
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : '';
    
  return `${baseUrl}${basePath}?token=${encodeURIComponent(normalizedToken)}`;
}

/**
 * Copies text to clipboard with fallback for older browsers
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch {
    return false;
  }
}

/**
 * Validates a token format (basic check)
 */
export function isValidTokenFormat(token: string): boolean {
  const normalized = normalizeToken(token);
  // Token should be at least 20 chars (hex encoded 10+ bytes)
  return normalized.length >= 20 && /^[a-f0-9]+$/i.test(normalized);
}
