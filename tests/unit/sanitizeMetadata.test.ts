import { describe, it, expect } from 'vitest';
import {
  sanitizeRiskEventMetadata,
  sanitizeNotificationMetadata,
  sanitizeNotificationParams,
  ALLOWED_RISK_EVENT_METADATA_KEYS,
  ALLOWED_NOTIFICATION_METADATA_KEYS,
  ALLOWED_NOTIFICATION_PARAMS_KEYS,
} from '@/lib/sanitizeMetadata';

describe('sanitizeRiskEventMetadata', () => {
  it('keeps only allowed keys', () => {
    const input = {
      rule_key: 'OVER_BUDGET',
      severity: 'high',
      scope: 'month',
      month: '2026-01',
      account_id: 'acc-123',
      category_id: 'cat-456',
      budget_id: 'bud-789',
      transaction_id: 'tx-abc',
    };
    const result = sanitizeRiskEventMetadata(input);
    expect(result).toEqual(input);
  });

  it('removes disallowed sensitive keys', () => {
    const input = {
      rule_key: 'LOW_BALANCE',
      amount: 1500.50,
      balance: -200,
      description: 'Pagamento de aluguel',
      merchant: 'Imobiliária XYZ',
      account_number: '12345-6',
      user_id: 'user-uuid',
      email: 'user@example.com',
    };
    const result = sanitizeRiskEventMetadata(input);
    expect(result).toEqual({ rule_key: 'LOW_BALANCE' });
    expect(result).not.toHaveProperty('amount');
    expect(result).not.toHaveProperty('balance');
    expect(result).not.toHaveProperty('description');
    expect(result).not.toHaveProperty('merchant');
    expect(result).not.toHaveProperty('account_number');
    expect(result).not.toHaveProperty('user_id');
    expect(result).not.toHaveProperty('email');
  });

  it('removes complex values (objects/arrays) even on allowed keys', () => {
    const input = {
      rule_key: { nested: 'object' },
      severity: ['high', 'medium'],
      scope: 'month',
      month: { year: 2026, month: 1 },
    };
    const result = sanitizeRiskEventMetadata(input);
    expect(result).toEqual({ scope: 'month' });
  });

  it('removes null and undefined values', () => {
    const input = {
      rule_key: 'TEST',
      severity: null,
      scope: undefined,
      month: '2026-01',
    };
    const result = sanitizeRiskEventMetadata(input);
    expect(result).toEqual({ rule_key: 'TEST', month: '2026-01' });
  });

  it('returns empty object for invalid inputs', () => {
    expect(sanitizeRiskEventMetadata(null)).toEqual({});
    expect(sanitizeRiskEventMetadata(undefined)).toEqual({});
    expect(sanitizeRiskEventMetadata('string')).toEqual({});
    expect(sanitizeRiskEventMetadata(123)).toEqual({});
    expect(sanitizeRiskEventMetadata(['array'])).toEqual({});
    expect(sanitizeRiskEventMetadata(true)).toEqual({});
  });

  it('returns empty object when size exceeds limit', () => {
    const largeString = 'x'.repeat(1000);
    const input = {
      rule_key: largeString,
    };
    const result = sanitizeRiskEventMetadata(input);
    expect(result).toEqual({});
  });

  it('keeps boolean and number primitives', () => {
    // Note: Currently only strings are typical, but we support numbers
    const input = {
      rule_key: 'TEST',
      severity: 3,
    };
    const result = sanitizeRiskEventMetadata(input);
    expect(result).toEqual({ rule_key: 'TEST', severity: 3 });
  });
});

describe('sanitizeNotificationMetadata', () => {
  it('keeps only allowed keys', () => {
    const input = {
      template_key: 'BUDGET_ALERT',
      severity: 'warning',
      month: '2026-01',
      entity_type: 'budget',
      entity_id: 'bud-123',
    };
    const result = sanitizeNotificationMetadata(input);
    expect(result).toEqual(input);
  });

  it('removes sensitive data', () => {
    const input = {
      template_key: 'RISK_ALERT',
      amount: 5000,
      balance: -1000,
      description: 'Sensitive payment info',
      user_id: 'user-abc',
      email: 'private@email.com',
    };
    const result = sanitizeNotificationMetadata(input);
    expect(result).toEqual({ template_key: 'RISK_ALERT' });
  });

  it('removes complex values', () => {
    const input = {
      template_key: 'TEST',
      severity: { level: 'high' },
      entity_id: ['id1', 'id2'],
    };
    const result = sanitizeNotificationMetadata(input);
    expect(result).toEqual({ template_key: 'TEST' });
  });

  it('handles empty object', () => {
    expect(sanitizeNotificationMetadata({})).toEqual({});
  });
});

describe('sanitizeNotificationParams', () => {
  it('keeps only allowed keys', () => {
    const input = {
      category_name: 'Alimentação',
      account_name: 'Conta Corrente',
      title_key: 'budget.exceeded',
      body_key: 'budget.exceeded.body',
    };
    const result = sanitizeNotificationParams(input);
    expect(result).toEqual(input);
  });

  it('removes sensitive data', () => {
    const input = {
      category_name: 'Moradia',
      amount: 2500,
      balance: 100,
      description: 'Rent payment',
      email: 'user@test.com',
      account_number: '9999-9',
    };
    const result = sanitizeNotificationParams(input);
    expect(result).toEqual({ category_name: 'Moradia' });
  });

  it('removes complex values', () => {
    const input = {
      category_name: 'Test',
      account_name: { id: 'acc-1', name: 'Main' },
      title_key: ['key1', 'key2'],
    };
    const result = sanitizeNotificationParams(input);
    expect(result).toEqual({ category_name: 'Test' });
  });

  it('returns empty for invalid input', () => {
    expect(sanitizeNotificationParams(null)).toEqual({});
    expect(sanitizeNotificationParams(undefined)).toEqual({});
    expect(sanitizeNotificationParams([])).toEqual({});
  });

  it('enforces size limit', () => {
    const largeValue = 'y'.repeat(950);
    const input = {
      category_name: largeValue,
    };
    const result = sanitizeNotificationParams(input);
    expect(result).toEqual({});
  });
});

describe('allowlist constants', () => {
  it('exports correct risk_events metadata keys', () => {
    expect(ALLOWED_RISK_EVENT_METADATA_KEYS).toContain('rule_key');
    expect(ALLOWED_RISK_EVENT_METADATA_KEYS).toContain('severity');
    expect(ALLOWED_RISK_EVENT_METADATA_KEYS).toContain('month');
    expect(ALLOWED_RISK_EVENT_METADATA_KEYS).toContain('account_id');
    expect(ALLOWED_RISK_EVENT_METADATA_KEYS).toContain('category_id');
    expect(ALLOWED_RISK_EVENT_METADATA_KEYS).toContain('budget_id');
    expect(ALLOWED_RISK_EVENT_METADATA_KEYS).toContain('transaction_id');
    expect(ALLOWED_RISK_EVENT_METADATA_KEYS).not.toContain('amount');
    expect(ALLOWED_RISK_EVENT_METADATA_KEYS).not.toContain('balance');
  });

  it('exports correct notifications metadata keys', () => {
    expect(ALLOWED_NOTIFICATION_METADATA_KEYS).toContain('template_key');
    expect(ALLOWED_NOTIFICATION_METADATA_KEYS).toContain('severity');
    expect(ALLOWED_NOTIFICATION_METADATA_KEYS).toContain('month');
    expect(ALLOWED_NOTIFICATION_METADATA_KEYS).toContain('entity_type');
    expect(ALLOWED_NOTIFICATION_METADATA_KEYS).toContain('entity_id');
    expect(ALLOWED_NOTIFICATION_METADATA_KEYS).not.toContain('amount');
  });

  it('exports correct notifications params keys', () => {
    expect(ALLOWED_NOTIFICATION_PARAMS_KEYS).toContain('category_name');
    expect(ALLOWED_NOTIFICATION_PARAMS_KEYS).toContain('account_name');
    expect(ALLOWED_NOTIFICATION_PARAMS_KEYS).toContain('title_key');
    expect(ALLOWED_NOTIFICATION_PARAMS_KEYS).toContain('body_key');
    expect(ALLOWED_NOTIFICATION_PARAMS_KEYS).not.toContain('amount');
    expect(ALLOWED_NOTIFICATION_PARAMS_KEYS).not.toContain('description');
  });
});
