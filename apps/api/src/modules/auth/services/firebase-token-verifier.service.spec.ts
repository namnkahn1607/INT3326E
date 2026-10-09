import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';

import { UserRole } from '../enums/user-role.enum';
import { FirebaseTokenVerifierService } from './firebase-token-verifier.service';

const verifyIdToken = vi.fn();

describe('FirebaseTokenVerifierService', () => {
  it.each(Object.values(UserRole))('accepts the verified claim %s', async (role) => {
    verifyIdToken.mockResolvedValue({ uid: 'user-1', email: 'user@example.com', role });

    await expect(new FirebaseTokenVerifierService({ verifyIdToken }).verify('signed-id-token'))
      .resolves.toEqual({ uid: 'user-1', email: 'user@example.com', role });
    expect(verifyIdToken).toHaveBeenLastCalledWith('signed-id-token');
  });

  it.each(['ADMIN', 'customer', '', undefined, null, 123, ['DRIVER'], { role: 'DRIVER' }])(
    'rejects unsupported or missing role %j',
    async (role) => {
      verifyIdToken.mockResolvedValue({ uid: 'user-1', role });
      await expect(new FirebaseTokenVerifierService({ verifyIdToken }).verify('signed-id-token'))
        .rejects.toThrow('Token does not contain a valid role');
    },
  );

  it('preserves SDK verification failures for the authentication guard to handle', async () => {
    const error = new Error('expired token');
    verifyIdToken.mockRejectedValue(error);
    await expect(new FirebaseTokenVerifierService({ verifyIdToken }).verify('expired-id-token'))
      .rejects.toBe(error);
  });
});
