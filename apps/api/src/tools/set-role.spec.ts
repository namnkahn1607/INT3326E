import { describe, expect, it } from 'vitest';
import { readRoleOptions } from './set-role';

const args = ['--project', 'demo-parcelflow', '--uid', 'user-1', '--role', 'ADMIN', '--expect-role', 'NONE'];

describe('Role CLI scope', () => {
  it('defaults to dry-run and requires exact project agreement', () => {
    expect(readRoleOptions(args, {})).toMatchObject({ apply: false, role: 'ADMIN', expectedRole: 'NONE' });
    expect(readRoleOptions([...args, '--apply'], {})).toMatchObject({ apply: true });
    expect(() => readRoleOptions(args, { FIREBASE_PROJECT_ID: 'production-project' })).toThrow('match');
  });
  it.each([[], args.slice(0, -2), [...args, '--apply', '--apply'], [...args, '--unknown'], [...args, '--role', 'DRIVER']].map(value => ({ value })))(
    'rejects incomplete, unknown or duplicate arguments', ({ value }) => {
      expect(() => readRoleOptions(value, {})).toThrow();
    },
  );
});
