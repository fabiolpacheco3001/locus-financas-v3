/**
 * REGRA DE PROJETO: Todas as queries que dependem da data atual DEVEM usar
 * getLocalTodayISO() como fonte de verdade, NUNCA o relógio do servidor (CURRENT_DATE, NOW()).
 * Isso previne bugs de fuso horário onde o servidor (UTC) está em um dia diferente do usuário.
 */

import { format } from 'date-fns';

/**
 * Returns the user's current LOCAL date in strict ISO format (YYYY-MM-DD).
 * This function NEVER applies UTC conversion, ensuring "today" matches the user's device.
 * 
 * Use this for:
 * - Passing to Supabase RPCs as reference date
 * - Comparing against due_date fields
 * - Any logic that needs "today" from the user's perspective
 * 
 * @example
 * const today = getLocalTodayISO(); // "2026-01-23"
 */
export function getLocalTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a month string (YYYY-MM) into a Date object in local time.
 * This avoids timezone issues that occur with new Date("YYYY-MM") or parse().
 * 
 * @param monthStr - String in format "YYYY-MM"
 * @param day - Day of month (defaults to 1)
 * @returns Date object in local timezone
 */
export function parseMonthStringToDate(monthStr: string, day: number = 1): Date {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a Date object to a date-only string (YYYY-MM-DD).
 * This ensures no timezone shift when storing in the database.
 * 
 * @param date - Date object
 * @returns String in format "YYYY-MM-DD"
 */
export function formatDateOnly(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Calculate a valid date string for a given month and day, handling edge cases
 * like Feb 30 -> Feb 28/29, Apr 31 -> Apr 30, etc.
 * 
 * @param monthStr - Month string in format "YYYY-MM"
 * @param dayOfMonth - Desired day of month
 * @returns Date string in format "YYYY-MM-DD"
 */
export function getValidDateForMonth(monthStr: string, dayOfMonth: number): string {
  const [year, month] = monthStr.split('-').map(Number);
  // Get last day of the month by creating date on day 0 of next month
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  // Use the smaller of dayOfMonth or lastDayOfMonth
  const validDay = Math.min(dayOfMonth, lastDayOfMonth);
  // Create local date and format as date-only string
  const dateObj = new Date(year, month - 1, validDay);
  return formatDateOnly(dateObj);
}
