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

  it('classifies expired tokens as 401 without exposing SDK errors', async () => {
    const error = Object.assign(new Error('private SDK details'), { code: 'auth/id-token-expired' });
    verifyIdToken.mockRejectedValue(error);
    await expect(new FirebaseTokenVerifierService({ verifyIdToken, getUser }).verify('expired-id-token'))
      .rejects.toMatchObject({ status: 401, message: 'Invalid or expired authentication token' });
  });

  it.each(['app/network-error', 'auth/internal-error', 'auth/insufficient-permission', 'auth/invalid-credential', undefined])(
    'classifies Firebase dependency/configuration failure %s as 503', async (code) => {
      verifyIdToken.mockRejectedValue(Object.assign(new Error('private SDK details'), { code }));
      await expect(new FirebaseTokenVerifierService({ verifyIdToken, getUser }).verify('token'))
        .rejects.toMatchObject({ status: 503, message: 'Authentication service temporarily unavailable' });
    },
  );

  it('also reports account lookup network failures as 503', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-1', role: UserRole.DRIVER });
    getUser.mockRejectedValueOnce(Object.assign(new Error('private backend address'), { code: 'app/network-error' }));
    await expect(new FirebaseTokenVerifierService({ verifyIdToken, getUser }).verify('token'))
      .rejects.toMatchObject({ status: 503 });
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
