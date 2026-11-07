import { Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersRepository } from './users.repository';

const errorLog = vi.fn();
beforeEach(() => { errorLog.mockClear(); vi.spyOn(Logger.prototype, 'error').mockImplementation(errorLog); });
afterEach(() => { vi.restoreAllMocks(); });

describe('UsersRepository configuration', () => {
  it('fails closed with 503 when DATABASE_URL is not configured', async () => {
    await expect(new UsersRepository(null).findByFirebaseUid('firebase-user'))
      .rejects.toMatchObject({ status: 503 });
    expect(errorLog).toHaveBeenCalledWith(JSON.stringify({
      event: 'dependency_failure', stage: 'users.lookup', code: 'DATABASE_URL_MISSING',
    }));
  });
  it('logs only the lookup stage and SQL code, not credentials or the Firebase UID', async () => {
    const failure = Object.assign(new Error('private database password'), {
      code: '42501', detail: 'private SQL parameters', connectionString: 'private connection URL',
    });
    const pool = { query: vi.fn().mockRejectedValue(failure) };
    await expect(new UsersRepository(pool as unknown as Pool).findByFirebaseUid('private-firebase-uid'))
      .rejects.toMatchObject({ status: 503 });
    expect(errorLog).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
      event: 'dependency_failure', stage: 'users.lookup', code: '42501',
    }));
  });
});
