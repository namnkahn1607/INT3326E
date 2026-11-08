import { describe, expect, it, vi } from 'vitest';
import { logDependencyFailure } from './dependency-diagnostics';

describe('Safe dependency diagnostics', () => {
  it.each(['28P01', '42501', '42P01', '42703', '42P10', '42804', '23503', 'ECONNREFUSED', 'ENOENT', 'auth/insufficient-permission'])(
    'logs allowlisted technical code %s without serializing the error', code => {
      const logger = { error: vi.fn() };
      const failure = Object.assign(new Error('private password token and recipient address'), {
        code, detail: 'private SQL parameters', query: 'private SQL',
        connectionString: 'postgresql://private-user:private-password@example.invalid/private-db',
        firebaseUid: 'private-uid', key: 'private-idempotency-key',
      });
      Object.defineProperty(failure, 'stack', { get: () => { throw new Error('Must not inspect stack'); } });
      logDependencyFailure(logger, 'users.lookup', failure);
      expect(logger.error).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
        event: 'dependency_failure', stage: 'users.lookup', code,
      }));
    },
  );

  it.each([
    ['timeout exceeded when trying to connect', 'CONNECTION_TIMEOUT'],
    ['Connection terminated due to connection timeout', 'CONNECTION_TIMEOUT'],
    ['Query read timeout', 'QUERY_TIMEOUT'],
  ])('maps a known driver timeout to a fixed label: %s', (message, code) => {
    const logger = { error: vi.fn() };
    logDependencyFailure(logger, 'users.lookup', new Error(message));
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ event: 'dependency_failure', stage: 'users.lookup', code }));
  });

  it.each([new Error('private text'), { code: 'private-password' }, { code: 'TOKEN' },
    { code: '42501\nprivate-log-injection' }, { code: 42501 }, 'private string', null, undefined])(
    'does not forward unknown error data %#', error => {
      const logger = { error: vi.fn() };
      logDependencyFailure(logger, 'shipments.connect', error);
      expect(logger.error).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
        event: 'dependency_failure', stage: 'shipments.connect', code: 'UNKNOWN',
      }));
    },
  );

  it('handles a throwing code accessor without replacing the original failure', () => {
    const logger = { error: vi.fn() };
    const failure = { get code(): string { throw new Error('private accessor failure'); } };
    expect(() => logDependencyFailure(logger, 'users.lookup', failure)).not.toThrow();
    expect(JSON.parse(logger.error.mock.calls[0][0]).code).toBe('UNKNOWN');
  });

  it('does not let a failing logger interrupt transaction cleanup', () => {
    const logger = { error: vi.fn().mockImplementation(() => { throw new Error('logging unavailable'); }) };
    expect(() => logDependencyFailure(logger, 'shipments.rollback', { code: '08006' })).not.toThrow();
  });
});
