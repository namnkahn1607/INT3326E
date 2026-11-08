import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userDatabaseProvider } from './user-database.provider';

const pool = vi.hoisted(() => ({ create: vi.fn(), on: vi.fn() }));
vi.mock('pg', () => ({ Pool: pool.create }));
const errorLog = vi.fn();

beforeEach(() => {
  pool.create.mockReset().mockImplementation(function () { return { on: pool.on }; });
  pool.on.mockReset();
  errorLog.mockClear();
  vi.spyOn(Logger.prototype, 'error').mockImplementation(errorLog);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('Database pool diagnostics (mock pool, no real connection)', () => {
  it('preserves the absent configuration behavior without creating a pool', () => {
    vi.stubEnv('DATABASE_URL', undefined);
    expect(userDatabaseProvider.useFactory()).toBeNull();
    expect(pool.create).not.toHaveBeenCalled();
  });

  it('logs only a safe code for an idle connection failure', () => {
    const connectionString = 'postgresql://private-user:private-password@example.invalid/private-db';
    vi.stubEnv('DATABASE_URL', connectionString);
    userDatabaseProvider.useFactory();
    expect(pool.create).toHaveBeenCalledWith({ connectionString, max: 5, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
    const [event, onError] = pool.on.mock.calls[0];
    expect(event).toBe('error');
    onError(Object.assign(new Error(connectionString), { code: 'ECONNRESET', detail: 'private SQL' }));
    expect(errorLog).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
      event: 'dependency_failure', stage: 'database.idle', code: 'ECONNRESET',
    }));
  });
});
