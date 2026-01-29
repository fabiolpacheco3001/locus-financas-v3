/**
 * Date-only string utilities for handling "YYYY-MM-DD" strings from Supabase
 * without timezone shifts.
 */

/**
 * Type guard: checks if value is a date-only string "YYYY-MM-DD"
 */
export function isDateOnlyString(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * Parse a date-only string "YYYY-MM-DD" into a Date in local timezone.
 * Avoids timezone shift that occurs with new Date("YYYY-MM-DD").
 * 
 * @param dateStr - String in format "YYYY-MM-DD"
 * @returns Date object in local timezone at midnight
 */
export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Safely convert a string or Date to a Date object.
 * - If Date: returns as-is
 * - If date-only string "YYYY-MM-DD": uses parseDateOnly (no timezone shift)
 * - Otherwise: falls back to new Date(input)
 * 
 * @param input - Date object or date string
 * @returns Date object
 */
export function toDateSafe(input: string | Date): Date {
  if (input instanceof Date) {
    return input;
  }
  if (isDateOnlyString(input)) {
    return parseDateOnly(input);
  }
  return new Date(input);
}

/**
 * Format a Date object to a date-only string (YYYY-MM-DD) in LOCAL timezone.
 * This ensures no timezone shift when storing in the database.
 * 
 * IMPORTANT: Use this function instead of format(date, 'yyyy-MM-dd') when
 * the Date object might have been created from a UTC string.
 * 
 * @param date - Date object
 * @returns String in format "YYYY-MM-DD" representing the LOCAL date
 */
export function formatLocalDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Alias for formatLocalDateOnly - converts a Date to YYYY-MM-DD in local timezone.
 * Use this to ensure the calendar-selected date is preserved regardless of timezone.
 * 
 * @param date - Date object (from calendar picker, etc.)
 * @returns String in format "YYYY-MM-DD" representing the LOCAL date
 */
export function toLocalISOString(date: Date): string {
  return formatLocalDateOnly(date);
}
