/**
 * JSONB Metadata Sanitization Utilities
 * 
 * Frontend sanitization layer to complement database triggers.
 * Ensures no sensitive data (amount, balance, description, email, etc.)
 * is ever written to metadata/params JSONB columns.
 * 
 * Security properties:
 * - Shallow sanitization only (flat objects)
 * - Allowlist of permitted keys per table/column
 * - Rejects complex values (arrays, nested objects)
 * - Size limit to prevent trigger rejection (< 900 bytes)
 */

export type JsonRecord = Record<string, unknown>;

// ========================================
// ALLOWLISTS (must match database triggers)
// ========================================

/**
 * Allowed keys for risk_events.metadata
 */
export const ALLOWED_RISK_EVENT_METADATA_KEYS = [
  'rule_key',
  'severity',
  'scope',
  'month',
  'account_id',
  'category_id',
  'budget_id',
  'transaction_id',
] as const;

/**
 * Allowed keys for notifications.metadata
 */
export const ALLOWED_NOTIFICATION_METADATA_KEYS = [
  'template_key',
  'severity',
  'month',
  'entity_type',
  'entity_id',
] as const;

/**
 * Allowed keys for notifications.params
 */
export const ALLOWED_NOTIFICATION_PARAMS_KEYS = [
  'category_name',
  'account_name',
  'title_key',
  'body_key',
] as const;

// Maximum byte size for serialized JSON (leave margin for trigger's 1024 limit)
const MAX_JSON_BYTES = 900;

// ========================================
// CORE SANITIZATION LOGIC
// ========================================

/**
 * Check if a value is a plain object (not null, not array)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Check if a value is a primitive (string, number, boolean)
 */
function isPrimitive(value: unknown): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * Core sanitization function with allowlist.
 * 
 * Rules:
 * 1. Input must be a plain object, otherwise return {}
 * 2. Only keys in allowlist are kept
 * 3. Only primitive values (string/number/boolean) are kept
 * 4. null/undefined values are removed
 * 5. Objects/arrays as values are removed (even if key is allowed)
 * 6. If result exceeds MAX_JSON_BYTES, return {}
 */
function sanitizeWithAllowlist(
  input: unknown,
  allowedKeys: readonly string[]
): JsonRecord {
  // Rule 1: Input must be plain object
  if (!isPlainObject(input)) {
    return {};
  }

  const result: JsonRecord = {};
  const allowedSet = new Set(allowedKeys);

  for (const [key, value] of Object.entries(input)) {
    // Rule 2: Only allowed keys
    if (!allowedSet.has(key)) {
      continue;
    }

    // Rule 4: Skip null/undefined
    if (value === null || value === undefined) {
      continue;
    }

    // Rule 3 & 5: Only primitives (rejects objects/arrays)
    if (!isPrimitive(value)) {
      continue;
    }

    result[key] = value;
  }

  // Rule 6: Check size limit
  const serialized = JSON.stringify(result);
  if (new TextEncoder().encode(serialized).length > MAX_JSON_BYTES) {
    // Too large - return empty object for safety
    return {};
  }

  return result;
}

// ========================================
// EXPORTED SANITIZATION FUNCTIONS
// ========================================

/**
 * Sanitize metadata for risk_events table.
 * 
 * @param input - The raw metadata input
 * @returns Sanitized JsonRecord with only allowed keys and primitive values
 */
export function sanitizeRiskEventMetadata(input: unknown): JsonRecord {
  return sanitizeWithAllowlist(input, ALLOWED_RISK_EVENT_METADATA_KEYS);
}

/**
 * Sanitize metadata for notifications table.
 * 
 * @param input - The raw metadata input
 * @returns Sanitized JsonRecord with only allowed keys and primitive values
 */
export function sanitizeNotificationMetadata(input: unknown): JsonRecord {
  return sanitizeWithAllowlist(input, ALLOWED_NOTIFICATION_METADATA_KEYS);
}

/**
 * Sanitize params for notifications table.
 * 
 * @param input - The raw params input
 * @returns Sanitized JsonRecord with only allowed keys and primitive values
 */
export function sanitizeNotificationParams(input: unknown): JsonRecord {
  return sanitizeWithAllowlist(input, ALLOWED_NOTIFICATION_PARAMS_KEYS);
}
