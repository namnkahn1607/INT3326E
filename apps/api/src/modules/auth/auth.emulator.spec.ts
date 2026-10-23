import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { configureApp } from '../../config/app.config';
import { validateFirebaseEnvironment } from '../../config/env.validation';
import { UserRole } from './enums/user-role.enum';
import { FIREBASE_AUTH } from './providers/firebase-auth.provider';
import { RoleClaimsService } from './services/role-claims.service';

describe.skipIf(process.env.RUN_FIREBASE_AUTH_EMULATOR_TESTS !== '1')('Firebase Auth emulator integration (real SDK, not cloud)', () => {
  let sdkApp: App;
  let auth: Auth;
  let app: INestApplication;
  let base: string;
  const users: { uid: string; email: string; password: string; role: UserRole; token: string }[] = [];

  async function signIn(email: string, password: string) {
    const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const result = await response.json() as { idToken?: string };
    if (!response.ok || !result.idToken) throw new Error('Emulator sign-in failed');
    return result.idToken;
  }

  beforeAll(async () => {
    validateFirebaseEnvironment(process.env);
    if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_PROJECT_ID?.startsWith('demo-')) {
      throw new Error('This test must never use a real Firebase project');
    }
    sdkApp = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID }, `auth-test-${randomUUID()}`);
    auth = getAuth(sdkApp);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FIREBASE_AUTH).useValue(auth).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    for (const role of Object.values(UserRole)) {
      const email = `${randomUUID()}@auth.test`;
      const password = `Test-${randomUUID()}`;
      const record = await auth.createUser({ email, password });
      const user = { uid: record.uid, email, password, role, token: '' };
      users.push(user);
      await new RoleClaimsService(auth).setRole(user.uid, role, 'NONE', true);
      user.token = await signIn(email, password);
    }
  }, 30000);

  afterAll(async () => {
    try { await app?.close(); }
    finally {
      if (auth) for (const user of users) await auth.deleteUser(user.uid);
      if (sdkApp) await deleteApp(sdkApp);
    }
  });

  it('keeps health public and rejects missing/invalid credentials', async () => {
    expect((await fetch(`${base}/healthz/`)).status).toBe(200);
    expect((await fetch(`${base}/v1/auth/me`)).status).toBe(401);
    expect((await fetch(`${base}/v1/auth/me`, { headers: { Authorization: 'Bearer invalid' } })).status).toBe(401);
  });
  it.each(Object.values(UserRole))('authenticates the provisioned %s account and enforces Admin access', async role => {
    const user = users.find(value => value.role === role)!;
    const headers = { Authorization: `Bearer ${user.token}` };
    const response = await fetch(`${base}/v1/auth/me`, { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ uid: user.uid, email: user.email, role });
    expect((await fetch(`${base}/v1/admin/me`, { headers })).status).toBe(role === UserRole.ADMIN ? 200 : 403);
  });
  it('rejects an expired token through the real Admin SDK expiry check', async () => {
    const [header, payload, signature] = users[0].token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<string, unknown>;
    decoded.exp = 1;
    const expired = `${header}.${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${signature}`;
    expect((await fetch(`${base}/v1/auth/me`, { headers: { Authorization: `Bearer ${expired}` } })).status).toBe(401);
  });
  it('rejects the old Admin token immediately after a downgrade and accepts a new sign-in', async () => {
    const user = users.find(value => value.role === UserRole.ADMIN)!;
    await new RoleClaimsService(auth).setRole(user.uid, UserRole.CUSTOMER, UserRole.ADMIN, true);
    expect((await fetch(`${base}/v1/admin/me`, { headers: { Authorization: `Bearer ${user.token}` } })).status).toBe(401);
    const token = await signIn(user.email, user.password);
    expect((await fetch(`${base}/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).status).toBe(200);
    expect((await fetch(`${base}/v1/admin/me`, { headers: { Authorization: `Bearer ${token}` } })).status).toBe(403);
  });
  it('rejects an account disabled after login', async () => {
    const user = users.find(value => value.role === UserRole.DRIVER)!;
    await auth.updateUser(user.uid, { disabled: true });
    expect((await fetch(`${base}/v1/auth/me`, { headers: { Authorization: `Bearer ${user.token}` } })).status).toBe(401);
  });
});
