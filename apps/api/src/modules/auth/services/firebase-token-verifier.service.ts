import { Inject, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { Auth } from 'firebase-admin/auth';
import { logDependencyFailure, type DependencyStage } from '../../../common/dependency-diagnostics';

import { UserRole } from '../enums/user-role.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { TokenVerifier } from '../interfaces/token-verifier.interface';
import { FIREBASE_AUTH } from '../providers/firebase-auth.provider';
import { firebaseAuthError } from './firebase-auth-error';

@Injectable()
export class FirebaseTokenVerifierService implements TokenVerifier {
  private readonly logger = new Logger(FirebaseTokenVerifierService.name);
  constructor(
    @Inject(FIREBASE_AUTH)
    private readonly auth: Pick<Auth, 'verifyIdToken' | 'getUser'>,
  ) {}

  async verify(token: string): Promise<AuthenticatedUser> {
    let stage: DependencyStage = 'auth.verify-token';
    try {
      const decodedToken = await this.auth.verifyIdToken(token, true);
      const role = this.parseRole(decodedToken.role);
      stage = 'auth.lookup-user';
      const account = await this.auth.getUser(decodedToken.uid);
      // Reject stale role claims even when a role change and login share a second.
      if (account.disabled || this.parseRole(account.customClaims?.role) !== role) {
        throw new UnauthorizedException('Account disabled or role changed; sign in again');
      }

      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role,
      };
    } catch (error) {
      const failure = firebaseAuthError(error);
      if (failure instanceof ServiceUnavailableException) logDependencyFailure(this.logger, stage, error);
      throw failure;
    }
  }

  private parseRole(value: unknown): UserRole {
    if (
      typeof value !== 'string' ||
      !Object.values(UserRole).includes(value as UserRole)
    ) {
      throw new UnauthorizedException('Token does not contain a valid role');
    }

    return value as UserRole;
  }
}
