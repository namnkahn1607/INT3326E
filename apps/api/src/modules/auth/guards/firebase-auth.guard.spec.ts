import 'reflect-metadata';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { UserRole } from '../enums/user-role.enum';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { FirebaseAuthGuard } from './firebase-auth.guard';

function contextFor(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
}

describe('FirebaseAuthGuard', () => {
  it.each([undefined, '', '   ', 'Bearer', 'Bearer   ', 'Basic token', 'Bearer token extra'])(
    'rejects malformed Authorization header %j before verifying',
    async (authorization) => {
      const verify = vi.fn();
      const guard = new FirebaseAuthGuard({ verify });

      await expect(guard.canActivate(contextFor({ headers: { authorization } })))
        .rejects.toBeInstanceOf(UnauthorizedException);
      expect(verify).not.toHaveBeenCalled();
    },
  );

  it.each(['Bearer token', 'bearer token', ' BEARER   token  '])(
    'verifies %j and attaches the verified user',
    async (authorization) => {
      const user = { uid: 'driver-1', role: UserRole.DRIVER };
      const verify = vi.fn().mockResolvedValue(user);
      const request: AuthenticatedRequest = { headers: { authorization } };

      await expect(new FirebaseAuthGuard({ verify }).canActivate(contextFor(request)))
        .resolves.toBe(true);
      expect(verify).toHaveBeenCalledWith('token');
      expect(request.user).toEqual(user);
    },
  );

  it('returns 401 without exposing verifier errors', async () => {
    const verify = vi.fn().mockRejectedValue(new Error('private verification details'));
    const request: AuthenticatedRequest = { headers: { authorization: 'Bearer token' } };

    await expect(new FirebaseAuthGuard({ verify }).canActivate(contextFor(request)))
      .rejects.toMatchObject({
        message: 'Invalid or expired authentication token',
        status: 401,
      });
    expect(request.user).toBeUndefined();
  });
});
