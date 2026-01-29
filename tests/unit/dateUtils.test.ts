import { describe, it, expect } from 'vitest';
import { parseMonthStringToDate, formatDateOnly, getValidDateForMonth } from '@/lib/dateUtils';

describe('dateUtils - parseMonthStringToDate', () => {
  it('should parse 2026-01 with day 1 to 2026-01-01 (not 2025-12-31)', () => {
    const result = parseMonthStringToDate('2026-01', 1);
    
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January is 0
    expect(result.getDate()).toBe(1);
    
    // Verify no timezone shift occurred
    const formatted = formatDateOnly(result);
    expect(formatted).toBe('2026-01-01');
  });

  it('should parse 2025-12 with day 15 to 2025-12-15', () => {
    const result = parseMonthStringToDate('2025-12', 15);
    
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11); // December is 11
    expect(result.getDate()).toBe(15);
    
    const formatted = formatDateOnly(result);
    expect(formatted).toBe('2025-12-15');
  });

  it('should default to day 1 when day is not specified', () => {
    const result = parseMonthStringToDate('2026-06');
    
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5); // June is 5
    expect(result.getDate()).toBe(1);
  });

  it('should handle year boundary correctly for January', () => {
    const result = parseMonthStringToDate('2026-01', 1);
    
    // The date should definitely be in 2026, not 2025
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    
    // Format should never show 2025
    const formatted = formatDateOnly(result);
    expect(formatted.startsWith('2026')).toBe(true);
    expect(formatted).not.toContain('2025');
  });
});

describe('dateUtils - getValidDateForMonth', () => {
  it('should return valid date for normal case', () => {
    const result = getValidDateForMonth('2026-01', 15);
    expect(result).toBe('2026-01-15');
  });

  it('should clamp day 31 to Feb 28 in non-leap year', () => {
    const result = getValidDateForMonth('2025-02', 31);
    expect(result).toBe('2025-02-28');
  });

  it('should clamp day 31 to Feb 29 in leap year', () => {
    const result = getValidDateForMonth('2024-02', 31);
    expect(result).toBe('2024-02-29');
  });

  it('should clamp day 31 to Apr 30', () => {
    const result = getValidDateForMonth('2026-04', 31);
    expect(result).toBe('2026-04-30');
  });

  it('should return exact day when valid', () => {
    const result = getValidDateForMonth('2026-01', 31);
    expect(result).toBe('2026-01-31');
  });

  it('should never return date in previous month due to timezone', () => {
    // Test first of month for each month to ensure no timezone shift
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    for (const month of months) {
      const result = getValidDateForMonth(`2026-${month}`, 1);
      expect(result).toBe(`2026-${month}-01`);
    }
  });

  it('should handle year boundary for January 1st', () => {
    const result = getValidDateForMonth('2026-01', 1);
    expect(result).toBe('2026-01-01');
    expect(result).not.toContain('2025');
  });
});

describe('dateUtils - formatDateOnly', () => {
  it('should format date without timezone shift', () => {
    // Create a local date for Jan 1, 2026
    const date = new Date(2026, 0, 1);
    const result = formatDateOnly(date);
    expect(result).toBe('2026-01-01');
  });

  it('should format date correctly regardless of time', () => {
    // Create date at midnight local time
    const date = new Date(2026, 0, 1, 0, 0, 0);
    const result = formatDateOnly(date);
    expect(result).toBe('2026-01-01');
  });

  it('should format date at end of day correctly', () => {
    // Create date at 23:59:59 local time
    const date = new Date(2026, 0, 1, 23, 59, 59);
    const result = formatDateOnly(date);
    expect(result).toBe('2026-01-01');
  });
});
