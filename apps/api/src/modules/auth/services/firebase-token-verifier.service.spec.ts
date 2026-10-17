import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';

import { UserRole } from '../enums/user-role.enum';
import { FirebaseTokenVerifierService } from './firebase-token-verifier.service';

const verifyIdToken = vi.fn();
const getUser = vi.fn();

describe('FirebaseTokenVerifierService', () => {
  it.each(Object.values(UserRole))('accepts the verified claim %s', async (role) => {
    verifyIdToken.mockResolvedValue({ uid: 'user-1', email: 'user@example.com', role });
    getUser.mockResolvedValue({ disabled: false, customClaims: { role } });

    await expect(new FirebaseTokenVerifierService({ verifyIdToken, getUser }).verify('signed-id-token'))
      .resolves.toEqual({ uid: 'user-1', email: 'user@example.com', role });
    expect(verifyIdToken).toHaveBeenLastCalledWith('signed-id-token', true);
  });

  it.each(['DISPATCHER', 'customer', '', undefined, null, 123, ['DRIVER'], { role: 'DRIVER' }])(
    'rejects unsupported or missing role %j',
    async (role) => {
      verifyIdToken.mockResolvedValue({ uid: 'user-1', role });
      await expect(new FirebaseTokenVerifierService({ verifyIdToken, getUser }).verify('signed-id-token'))
        .rejects.toThrow('Token does not contain a valid role');
    },
  );

  it('preserves SDK verification failures for the authentication guard to handle', async () => {
    const error = new Error('expired token');
    verifyIdToken.mockRejectedValue(error);
    await expect(new FirebaseTokenVerifierService({ verifyIdToken, getUser }).verify('expired-id-token'))
      .rejects.toBe(error);
  });

  it.each([undefined, 'DISPATCHER', UserRole.CUSTOMER])('rejects a stale ADMIN token after the current role becomes %j', async (role) => {
    verifyIdToken.mockResolvedValue({ uid: 'user-1', role: UserRole.ADMIN });
    getUser.mockResolvedValue({ disabled: false, customClaims: { role } });
    await expect(new FirebaseTokenVerifierService({ verifyIdToken, getUser }).verify('old-token')).rejects.toThrow();
  });

  it('rejects a disabled account even when token verification succeeds', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-1', role: UserRole.ADMIN });
    getUser.mockResolvedValue({ disabled: true, customClaims: { role: UserRole.ADMIN } });
    await expect(new FirebaseTokenVerifierService({ verifyIdToken, getUser }).verify('old-token')).rejects.toThrow('disabled');
  });
});
