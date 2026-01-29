import { describe, it, expect } from 'vitest';
import { isDateOnlyString, parseDateOnly, toDateSafe, formatLocalDateOnly } from '@/lib/dateOnly';

describe('dateOnly - isDateOnlyString', () => {
  it('should return true for valid YYYY-MM-DD strings', () => {
    expect(isDateOnlyString('2026-01-01')).toBe(true);
    expect(isDateOnlyString('2025-12-31')).toBe(true);
    expect(isDateOnlyString('2024-02-29')).toBe(true);
  });

  it('should return false for invalid formats', () => {
    expect(isDateOnlyString('2026-1-1')).toBe(false);
    expect(isDateOnlyString('26-01-01')).toBe(false);
    expect(isDateOnlyString('2026/01/01')).toBe(false);
    expect(isDateOnlyString('2026-01-01T00:00:00')).toBe(false);
    expect(isDateOnlyString('2026-01-01T00:00:00Z')).toBe(false);
  });

  it('should return false for non-strings', () => {
    expect(isDateOnlyString(null)).toBe(false);
    expect(isDateOnlyString(undefined)).toBe(false);
    expect(isDateOnlyString(123)).toBe(false);
    expect(isDateOnlyString(new Date())).toBe(false);
  });
});

describe('dateOnly - parseDateOnly', () => {
  it('should parse 2026-01-01 to Jan 1, 2026 in local timezone (no shift)', () => {
    const result = parseDateOnly('2026-01-01');
    
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(1);
  });

  it('should parse 2025-12-31 to Dec 31, 2025 in local timezone', () => {
    const result = parseDateOnly('2025-12-31');
    
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11); // December
    expect(result.getDate()).toBe(31);
  });

  it('should not cause year boundary shift for January dates', () => {
    // This is the main bug we're fixing: new Date("2026-01-01") in Brazil
    // would show as 2025-12-31 due to UTC interpretation
    const result = parseDateOnly('2026-01-01');
    
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
    
    // Verify using toLocaleDateString
    const localStr = result.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    expect(localStr).toBe('2026-01-01');
  });
});

describe('dateOnly - toDateSafe', () => {
  it('should return Date as-is if already a Date', () => {
    const date = new Date(2026, 0, 15);
    const result = toDateSafe(date);
    
    expect(result).toBe(date); // Same reference
  });

  it('should parse date-only strings using parseDateOnly', () => {
    const result = toDateSafe('2026-01-01');
    
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  it('should fall back to new Date() for ISO datetime strings', () => {
    const result = toDateSafe('2026-01-15T10:30:00Z');
    
    // This will be parsed as UTC, which is expected for datetime strings
    expect(result instanceof Date).toBe(true);
    expect(result.getFullYear()).toBe(2026);
  });

  it('should handle transaction date scenarios correctly', () => {
    // Simulating Supabase response for a transaction
    const txDate = '2025-12-31';
    const txDueDate = '2026-01-05';
    
    const dateResult = toDateSafe(txDate);
    const dueDateResult = toDateSafe(txDueDate);
    
    expect(dateResult.getFullYear()).toBe(2025);
    expect(dateResult.getMonth()).toBe(11); // December
    expect(dateResult.getDate()).toBe(31);
    
    expect(dueDateResult.getFullYear()).toBe(2026);
    expect(dueDateResult.getMonth()).toBe(0); // January
    expect(dueDateResult.getDate()).toBe(5);
  });
});

describe('dateOnly - formatLocalDateOnly', () => {
  it('should format a Date object to YYYY-MM-DD in local timezone', () => {
    const date = new Date(2026, 0, 15); // Jan 15, 2026 local
    const result = formatLocalDateOnly(date);
    expect(result).toBe('2026-01-15');
  });

  it('should handle single-digit months and days with padding', () => {
    const date = new Date(2026, 2, 5); // Mar 5, 2026
    const result = formatLocalDateOnly(date);
    expect(result).toBe('2026-03-05');
  });

  it('should preserve local date even for dates created from UTC', () => {
    // Create a date in local time and verify it formats correctly
    const localDate = new Date(2026, 11, 31); // Dec 31, 2026 local
    const result = formatLocalDateOnly(localDate);
    expect(result).toBe('2026-12-31');
  });

  it('should work correctly for year boundaries', () => {
    const newYearsDay = new Date(2026, 0, 1); // Jan 1, 2026
    expect(formatLocalDateOnly(newYearsDay)).toBe('2026-01-01');
    
    const newYearsEve = new Date(2025, 11, 31); // Dec 31, 2025
    expect(formatLocalDateOnly(newYearsEve)).toBe('2025-12-31');
  });
});

describe('dateOnly - effectiveDate sorting', () => {
  it('YYYY-MM-DD strings should sort correctly via localeCompare', () => {
    // This validates the sorting approach used in Transactions.tsx
    const dates = ['2026-01-15', '2025-12-01', '2026-01-01', '2025-12-31'];
    
    const sorted = [...dates].sort((a, b) => a.localeCompare(b));
    
    expect(sorted).toEqual(['2025-12-01', '2025-12-31', '2026-01-01', '2026-01-15']);
  });

  it('effective date (due_date ?? date) should use due_date when present', () => {
    const txWithDueDate = { date: '2026-01-05', due_date: '2025-12-31' };
    const txWithoutDueDate = { date: '2025-12-15', due_date: null };
    
    const getEffectiveDate = (tx: { date: string; due_date: string | null }) => 
      tx.due_date || tx.date;
    
    expect(getEffectiveDate(txWithDueDate)).toBe('2025-12-31');
    expect(getEffectiveDate(txWithoutDueDate)).toBe('2025-12-15');
  });

  it('transactions should sort by effective date correctly', () => {
    const transactions = [
      { id: 'a', date: '2026-01-05', due_date: '2025-12-31' }, // effective: 2025-12-31
      { id: 'b', date: '2025-12-15', due_date: null },          // effective: 2025-12-15
      { id: 'c', date: '2026-01-01', due_date: null },          // effective: 2026-01-01
      { id: 'd', date: '2025-12-20', due_date: '2025-12-25' },  // effective: 2025-12-25
    ];
    
    const getEffectiveDate = (tx: { date: string; due_date: string | null }) => 
      tx.due_date || tx.date;
    
    const sorted = [...transactions].sort((a, b) => 
      getEffectiveDate(a).localeCompare(getEffectiveDate(b))
    );
    
    // Expected order by effective date:
    // b (2025-12-15) -> d (2025-12-25) -> a (2025-12-31) -> c (2026-01-01)
    expect(sorted.map(t => t.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});
