import 'reflect-metadata';
import { Controller, Get, Req, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AuthModule } from '../auth/auth.module';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { FIREBASE_AUTH } from '../auth/providers/firebase-auth.provider';
import { AdminModule } from './admin.module';
import { AdminController } from './controllers/admin.controller';

@Controller('admin-scaffold-probe')
class AdminScaffoldProbeController extends AdminController {
  @Get()
  probe(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}

describe('AdminModule scaffold authorization', () => {
  let app: INestApplication;
  let endpoint: string;
  const verifyIdToken = vi.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AdminModule, AuthModule],
      controllers: [AdminScaffoldProbeController],
    }).overrideProvider(FIREBASE_AUTH).useValue({ verifyIdToken }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    endpoint = `${await app.getUrl()}/admin-scaffold-probe`;
  });

  afterAll(async () => { await app?.close(); });

  it('requires authentication for a handler on the admin scaffold', async () => {
    const response = await fetch(endpoint);
    expect(response.status).toBe(401);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it.each([UserRole.CUSTOMER, UserRole.DRIVER])('rejects %s on admin operations', async (role) => {
    verifyIdToken.mockResolvedValueOnce({ uid: 'user-1', role });
    const response = await fetch(endpoint, {
      headers: { Authorization: 'Bearer signed-token' },
    });
    expect(response.status).toBe(403);
  });

  it('accepts a verified ADMIN claim', async () => {
    const user = { uid: 'admin-1', role: UserRole.ADMIN };
    verifyIdToken.mockResolvedValueOnce(user);
    const response = await fetch(endpoint, {
      headers: { Authorization: 'Bearer signed-token' },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(user);
  });

  it('rejects a verified token with the removed DISPATCHER claim', async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: 'old-role', role: 'DISPATCHER' });
    const response = await fetch(endpoint, {
      headers: { Authorization: 'Bearer signed-token' },
    });
    expect(response.status).toBe(401);
  });
});
