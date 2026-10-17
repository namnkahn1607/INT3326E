import { describe, expect, it } from 'vitest';
import { UsersRepository } from './users.repository';

describe('UsersRepository configuration', () => {
  it('fails closed with 503 when DATABASE_URL is not configured', async () => {
    await expect(new UsersRepository(null).findByFirebaseUid('firebase-user'))
      .rejects.toMatchObject({ status: 503 });
  });
});
