import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../enums/user-role.enum';
import { RoleClaimsService } from './role-claims.service';

function fixture(role?: string) {
  const auth = {
    getUser: vi.fn().mockResolvedValue({ disabled: false, customClaims: { tenant: 'team-1', ...(role ? { role } : {}) } }),
    setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
    revokeRefreshTokens: vi.fn().mockResolvedValue(undefined),
  };
  return { auth, service: new RoleClaimsService(auth) };
}

describe('Trusted role provisioning', () => {
  it.each(Object.values(UserRole))('previews %s without writing', async (role) => {
    const { auth, service } = fixture();
    expect(await service.setRole('uid', role, 'NONE')).toMatchObject({ status: 'dry-run', role });
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect(auth.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('preserves unrelated claims, revokes sessions and verifies readback', async () => {
    const { auth, service } = fixture(UserRole.ADMIN);
    auth.getUser.mockResolvedValueOnce({ customClaims: { tenant: 'team-1', role: UserRole.ADMIN } });
    auth.getUser.mockResolvedValueOnce({ customClaims: { tenant: 'team-1', role: UserRole.DRIVER } });
    expect(await service.setRole('uid', UserRole.DRIVER, UserRole.ADMIN, true)).toMatchObject({ status: 'updated', signInAgain: true });
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('uid', { tenant: 'team-1', role: UserRole.DRIVER });
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith('uid');
  });

  it('does not write if expected role is stale or account disabled', async () => {
    const { auth, service } = fixture(UserRole.ADMIN);
    await expect(service.setRole('uid', UserRole.CUSTOMER, 'NONE', true)).rejects.toThrow('expect-role');
    auth.getUser.mockResolvedValueOnce({ disabled: true });
    await expect(service.setRole('uid', UserRole.CUSTOMER, 'NONE', true)).rejects.toThrow('disabled');
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it.each(['', ' uid', 'u\nid', 'x'.repeat(129)])('rejects invalid UID %j before Firebase', async (uid) => {
    const { auth, service } = fixture();
    await expect(service.setRole(uid, UserRole.CUSTOMER, 'NONE', true)).rejects.toThrow('UID');
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it('rejects unsupported roles and oversized claims before writing', async () => {
    const { auth, service } = fixture();
    await expect(service.setRole('uid', 'DISPATCHER' as UserRole, 'NONE', true)).rejects.toThrow('CUSTOMER');
    auth.getUser.mockResolvedValueOnce({ customClaims: { note: 'đ'.repeat(500) } });
    await expect(service.setRole('uid', UserRole.ADMIN, 'NONE', true)).rejects.toThrow('1000-byte');
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('reports partial failure if revocation fails after the write', async () => {
    const { auth, service } = fixture();
    auth.revokeRefreshTokens.mockRejectedValueOnce(new Error('SDK detail'));
    await expect(service.setRole('uid', UserRole.ADMIN, 'NONE', true)).rejects.toThrow('updated but session revocation failed');
  });

  it('leaves unchanged roles alone and detects inconsistent readback', async () => {
    const { auth, service } = fixture(UserRole.ADMIN);
    expect(await service.setRole('uid', UserRole.ADMIN, UserRole.ADMIN, true)).toMatchObject({ status: 'unchanged' });
    expect(auth.revokeRefreshTokens).not.toHaveBeenCalled();
    await expect(service.setRole('uid', UserRole.CUSTOMER, UserRole.ADMIN, true)).rejects.toThrow('readback');
  });
});
