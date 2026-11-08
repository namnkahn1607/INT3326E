import 'reflect-metadata';
import { Controller, Get, Post, Req, UseGuards, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module';
import { configureApp } from '../../config/app.config';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { FIREBASE_AUTH } from '../auth/providers/firebase-auth.provider';
import { BusinessUserGuard } from './business-user.guard';
import { USER_DATABASE } from './user-database.provider';
import { UsersModule } from './users.module';

@Controller('user-link-test')
@Roles(UserRole.CUSTOMER)
@UseGuards(BusinessUserGuard)
class BusinessController {
  @Post('actor')
  actor(@Req() request: AuthenticatedRequest) { return request.businessUser; }

  @Get('admin')
  @Roles(UserRole.ADMIN)
  admin(@Req() request: AuthenticatedRequest) { return request.businessUser; }

  @Get('failure')
  failure() { throw new Error('private unexpected failure details'); }
}

describe('Business identity integration (mock Firebase and SQL, real Nest HTTP)', () => {
  let app: INestApplication;
  let base: string;
  const query = vi.fn();
  const end = vi.fn();
  const verifyIdToken = vi.fn();
  const getUser = vi.fn();
  const identity = { uid: 'firebase-customer', role: UserRole.CUSTOMER };
  const user = { id: 'database-user-id', firebaseUid: identity.uid, role: identity.role };
  const headers = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule, UsersModule], controllers: [BusinessController] })
      .overrideProvider(FIREBASE_AUTH).useValue({ verifyIdToken, getUser })
      .overrideProvider(USER_DATABASE).useValue({ query, end }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  beforeEach(() => {
    verifyIdToken.mockReset().mockResolvedValue(identity);
    getUser.mockReset().mockResolvedValue({ disabled: false, customClaims: { role: identity.role } });
    query.mockReset().mockResolvedValue({ rows: [user] });
  });
  afterAll(async () => { await app?.close(); });

  it('takes the business actor from the verified UID lookup, ignoring body-supplied IDs and roles', async () => {
    const response = await fetch(`${base}/v1/user-link-test/actor`, {
      method: 'POST', headers, body: JSON.stringify({ customerId: 'attacker', role: 'ADMIN', uid: 'other-user' }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(user);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('"firebaseUid" = $1'), [identity.uid]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([
    { rows: [] }, { rows: [{ ...user, role: UserRole.ADMIN }] }, { rows: [{ ...user, firebaseUid: 'other-user' }] },
    { rows: [{ ...user, id: '' }] }, { rows: [user, user] },
  ])('rejects missing, inconsistent or ambiguous business linkage %# as 409', async ({ rows }) => {
    query.mockResolvedValueOnce({ rows });
    const response = await fetch(`${base}/v1/user-link-test/actor?private=hidden`, { method: 'POST', headers });
    expect(response.status).toBe(409);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(await response.json()).toMatchObject({ type: 'about:blank', status: 409,
      code: 'USER_NOT_PROVISIONED', instance: '/v1/user-link-test/actor', timestamp: expect.any(String) });
  });

  it('checks authentication and route role before looking up the business user', async () => {
    const missing = await fetch(`${base}/v1/user-link-test/actor`, { method: 'POST' });
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
    const forbidden = await fetch(`${base}/v1/user-link-test/admin`, { headers });
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ code: 'FORBIDDEN_RESOURCE' });
    expect(query).not.toHaveBeenCalled();
  });

  it('keeps identity and health endpoints independent of business provisioning', async () => {
    query.mockResolvedValue({ rows: [] });
    expect((await fetch(`${base}/v1/auth/me`, { headers })).status).toBe(200);
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
    expect(query).not.toHaveBeenCalled();
  });

  it('reports SQL outages as 503 instead of treating the account as unprovisioned', async () => {
    query.mockRejectedValueOnce(new Error('private database address/password'));
    const response = await fetch(`${base}/v1/user-link-test/actor`, { method: 'POST', headers });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('does not expose unexpected application error details', async () => {
    const response = await fetch(`${base}/v1/user-link-test/failure`, { headers });
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({ code: 'INTERNAL_SERVER_ERROR', status: 500 });
    expect(body).not.toContain('private');
  });

  it.each(['verify', 'lookup'])('reports Firebase %s dependency failure as 503, without touching SQL', async (stage) => {
    const error = Object.assign(new Error('private credential detail'), { code: 'app/network-error' });
    if (stage === 'verify') verifyIdToken.mockRejectedValueOnce(error);
    else getUser.mockRejectedValueOnce(error);
    const response = await fetch(`${base}/v1/auth/me`, { headers });
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 503 });
    expect(body).not.toContain('private');
    expect(query).not.toHaveBeenCalled();
  });
});
