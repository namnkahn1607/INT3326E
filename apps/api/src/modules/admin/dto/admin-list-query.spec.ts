import { describe, expect, it } from 'vitest';
import { encodeDirectoryCursor, parseAdminListQuery } from './admin-list-query';

const cursor = { id: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAV', createdAt: '2026-10-23T10:00:00.123456Z' };

describe('Admin directory query validation', () => {
  it('applies the SC01 default and accepts the maximum page size', () => {
    expect(parseAdminListQuery({}, 'drivers')).toEqual({ limit: 20, after: null });
    expect(parseAdminListQuery({ limit: '100' }, 'drivers').limit).toBe(100);
  });

  it('round-trips the scoped cursor without losing PostgreSQL microseconds', () => {
    const token = encodeDirectoryCursor('drivers', cursor);
    expect(parseAdminListQuery({ cursor: token, limit: '1' }, 'drivers')).toEqual({ limit: 1, after: cursor });
  });

  it.each(['0', '-1', '101', '1.5', '1e2', '01', ' 2', '', ['2', '3'], { value: '2' }])(
    'rejects invalid page limit %j', (limit) => {
      expect(() => parseAdminListQuery({ limit }, 'drivers')).toThrow();
    },
  );

  it.each([
    { role: 'CUSTOMER' }, { uid: 'other-user' }, { sort: 'name' }, { limit: '2', other: 'value' },
    { cursor: '' }, { cursor: 'not-json' }, { cursor: 'a'.repeat(513) }, { cursor: ['one', 'two'] },
    { cursor: encodeDirectoryCursor('customers', cursor) },
  ])('rejects unknown fields and malformed/cross-directory cursors %j', (query) => {
    expect(() => parseAdminListQuery(query, 'drivers')).toThrow();
  });

  it.each([
    { v: 2 }, { scope: 'customers' }, { id: 'usr_invalid' }, { id: "' OR true --" },
    { createdAt: '2026-02-31T10:00:00.123456Z' }, { createdAt: '2026-10-23T10:00:00Z' },
    { createdAt: '0000-01-01T10:00:00.123456Z' },
    { createdAt: '2026-10-23T25:00:00.123456Z' }, { extra: 'field' },
  ])('rejects unsupported or invalid decoded cursor %j', (change) => {
    const value = { v: 1, scope: 'drivers', ...cursor, ...change };
    const token = Buffer.from(JSON.stringify(value)).toString('base64url');
    expect(() => parseAdminListQuery({ cursor: token }, 'drivers')).toThrow();
  });
});
