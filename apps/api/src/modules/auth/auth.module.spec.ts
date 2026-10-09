import 'reflect-metadata';
import { Controller, Get, Req, UseGuards, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AuthModule } from './auth.module';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from './enums/user-role.enum';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { FIREBASE_AUTH } from './providers/firebase-auth.provider';

@Controller('auth-test')
@UseGuards(FirebaseAuthGuard, RolesGuard)
class AuthTestController {
  @Get('admin')
  @Roles(UserRole.ADMIN)
  admin(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  @Get('customer')
  @Roles(UserRole.CUSTOMER)
  customer(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  @Get('driver')
  @Roles(UserRole.DRIVER)
  driver(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}

describe('AuthModule HTTP integration', () => {
  let app: INestApplication;
  let baseUrl: string;
  const verifyIdToken = vi.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [AuthTestController],
    }).overrideProvider(FIREBASE_AUTH).useValue({ verifyIdToken }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 401 for missing authentication before invoking Firebase', async () => {
    const response = await fetch(`${baseUrl}/auth-test/admin`);
    expect(response.status).toBe(401);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('returns 401 for a failed Firebase verification', async () => {
    verifyIdToken.mockRejectedValueOnce(new Error('expired token'));
    const response = await fetch(`${baseUrl}/auth-test/admin`, {
      headers: { Authorization: 'Bearer expired-token' },
    });
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('expired token');
  });

  it('rejects the removed DISPATCHER claim even after Firebase verifies the token', async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: 'old-role', role: 'DISPATCHER' });
    const response = await fetch(`${baseUrl}/auth-test/admin`, {
      headers: { Authorization: 'Bearer signed-token' },
    });
    expect(response.status).toBe(401);
  });

  it.each([UserRole.CUSTOMER, UserRole.DRIVER])('returns 403 for %s on admin operations', async (role) => {
    verifyIdToken.mockResolvedValueOnce({ uid: 'user-1', role });
    const response = await fetch(`${baseUrl}/auth-test/admin`, {
      headers: { Authorization: 'Bearer signed-token' },
    });
    expect(response.status).toBe(403);
  });

  it.each(Object.values(UserRole))('accepts %s on its permitted route and attaches the user', async (role) => {
    const user = { uid: 'user-1', email: 'user@example.com', role };
    verifyIdToken.mockResolvedValueOnce(user);
    const response = await fetch(`${baseUrl}/auth-test/${role.toLowerCase()}`, {
      headers: { Authorization: 'Bearer signed-token' },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(user);
    expect(verifyIdToken).toHaveBeenCalledWith('signed-token');
  });
});
