import type { Auth } from 'firebase-admin/auth';

import { UserRole } from '../enums/user-role.enum';

export type ExpectedRole = UserRole | 'NONE';

export class RoleClaimsService {
  constructor(private readonly auth: Pick<Auth,
    'getUser' | 'setCustomUserClaims' | 'revokeRefreshTokens'>) {}

  async setRole(uid: string, role: UserRole, expectedRole: ExpectedRole, apply = false) {
    if (!uid || uid.trim() !== uid || uid.length > 128 || /\s/.test(uid)) {
      throw new Error('A non-empty Firebase UID of at most 128 characters is required');
    }
    if (!Object.values(UserRole).includes(role) ||
        ![...Object.values(UserRole), 'NONE'].includes(expectedRole)) {
      throw new Error('Use CUSTOMER, DRIVER or ADMIN; expected role may also be NONE');
    }
    const user = await this.auth.getUser(uid);
    if (user.disabled) throw new Error('Cannot assign a role to a disabled account');
    const current = user.customClaims?.role ?? 'NONE';
    if (current !== expectedRole) throw new Error('Current role differs from --expect-role; inspect the account first');
    const claims = { ...user.customClaims, role };
    if (Buffer.byteLength(JSON.stringify(claims), 'utf8') > 1000) {
      throw new Error('Custom claims exceed the Firebase 1000-byte limit');
    }
    if (!apply) return { uid, previousRole: current, role, status: 'dry-run' as const };
    if (current === role) return { uid, previousRole: current, role, status: 'unchanged' as const };

    await this.auth.setCustomUserClaims(uid, claims);
    try {
      await this.auth.revokeRefreshTokens(uid);
    } catch {
      throw new Error('Role was updated but session revocation failed. Do not report success; revoke sessions before retrying.');
    }
    const saved = await this.auth.getUser(uid);
    if (saved.customClaims?.role !== role) throw new Error('Role readback differs; inspect concurrent account changes');
    return { uid, previousRole: current, role, status: 'updated' as const, signInAgain: true };
  }
}
