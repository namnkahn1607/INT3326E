import { Injectable } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';

import { UserRole } from '../enums/user-role.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { TokenVerifier } from '../interfaces/token-verifier.interface';

@Injectable()
export class FirebaseTokenVerifierService implements TokenVerifier {
  async verify(token: string): Promise<AuthenticatedUser> {
    const decodedToken = await getAuth().verifyIdToken(token);
    const role = this.parseRole(decodedToken.role);

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role,
    };
  }

  private parseRole(value: unknown): UserRole {
    if (
      typeof value !== 'string' ||
      !Object.values(UserRole).includes(value as UserRole)
    ) {
      throw new Error('Token does not contain a valid role');
    }

    return value as UserRole;
  }
}