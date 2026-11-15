import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module';
import { configureApp } from '../../config/app.config';
import { UserRole } from '../auth/enums/user-role.enum';
import { FIREBASE_AUTH } from '../auth/providers/firebase-auth.provider';
import { USER_DATABASE } from '../users/user-database.provider';
import { encodeNotificationCursor, parseNotificationQuery } from './dto/notification-query';

const customerId = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAV';
const otherId = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number, createdAt = '2026-11-07T01:00:00.123456Z') => ({
  id: uuid(n), shipmentId: 'sh_01ARZ3NDEKTSV4RRFFQ69G5FAV', trackingCode: 'PF20261107ABCDEF', kind: 'ASSIGNED',
  title: 'Đơn đã được gán tài xế', body: 'Đơn PF20261107ABCDEF đã có tài xế', createdAt: new Date('2026-11-07T01:00:00.123Z'),
  cursorCreatedAt: createdAt,
});

describe('GET /v1/notifications (real Nest HTTP, mock Firebase/SQL)', () => {
  let app: INestApplication;
  let base: string;
  const verifyIdToken = vi.fn();
  const getUser = vi.fn();
  const query = vi.fn();
  const headers = { Authorization: 'Bearer signed-test-token' };
  let rows: unknown[];
  let linkage: unknown[];
  let failList = false;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FIREBASE_AUTH).useValue({ verifyIdToken, getUser })
      .overrideProvider(USER_DATABASE).useValue({ query, end: vi.fn() }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/v1`;
  });

  beforeEach(() => {
    verifyIdToken.mockReset().mockResolvedValue({ uid: 'customer-firebase', role: UserRole.CUSTOMER });
    getUser.mockReset().mockResolvedValue({ disabled: false, customClaims: { role: UserRole.CUSTOMER } });
    linkage = [{ id: customerId, firebaseUid: 'customer-firebase', role: UserRole.CUSTOMER }];
    rows = [];
    failList = false;
    query.mockReset().mockImplementation(async (sql: string) => {
      if (sql.includes('WHERE "firebaseUid" = $1')) return { rows: linkage };
      if (failList) throw Object.assign(new Error('boom'), { code: '08006' });
      return { rows };
    });
  });

  afterAll(async () => { await app?.close(); });

  it('requires authentication before reading SQL', async () => {
    const response = await fetch(`${base}/notifications`);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(query).not.toHaveBeenCalled();
  });

  it.each([UserRole.DRIVER, UserRole.ADMIN])('rejects role %s before reading SQL', async (role) => {
    verifyIdToken.mockResolvedValue({ uid: 'other', role });
    getUser.mockResolvedValue({ disabled: false, customClaims: { role } });
    const response = await fetch(`${base}/notifications`, { headers });
    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns 409 when the Customer has no business user row', async () => {
    linkage = [];
    const response = await fetch(`${base}/notifications`, { headers });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'USER_NOT_PROVISIONED' });
  });

  it('maps SC07 fields, binds the customer id from the token and sends no-store', async () => {
    rows = [row(1)];
    const response = await fetch(`${base}/notifications`, { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      data: [{ id: uuid(1), shipmentId: 'sh_01ARZ3NDEKTSV4RRFFQ69G5FAV', trackingNumber: 'PF20261107ABCDEF',
        kind: 'ASSIGNED', title: 'Đơn đã được gán tài xế', body: 'Đơn PF20261107ABCDEF đã có tài xế',
        createdAt: '2026-11-07T01:00:00.123Z' }],
      pagination: { limit: 20, hasMore: false, nextCursor: null },
    });
    const call = query.mock.calls.find(([sql]) => String(sql).includes('FROM notifications'))!;
    expect(call[1]).toEqual([customerId, null, null, 21]);
  });

  it('returns an empty page, not 404, when the Customer has no notifications', async () => {
    const response = await fetch(`${base}/notifications`, { headers });
    expect(await response.json()).toEqual({ data: [], pagination: { limit: 20, hasMore: false, nextCursor: null } });
  });

  it('uses the lookahead row only to build nextCursor and never returns it', async () => {
    rows = [row(3), row(2), row(1)];
    const body = await (await fetch(`${base}/notifications?limit=2`, { headers })).json();
    expect(body.data.map((n: { id: string }) => n.id)).toEqual([uuid(3), uuid(2)]);
    expect(body.pagination.hasMore).toBe(true);
    expect(parseNotificationQuery({ cursor: body.pagination.nextCursor }, customerId).after)
      .toEqual({ id: uuid(2), createdAt: '2026-11-07T01:00:00.123456Z' });
  });

  it.each(['?limit=0', '?limit=101', '?limit=1.5', '?limit=1&limit=2', '?cursor=bad', '?customerId=forged', '?status=x'])(
    'rejects invalid query %s with 400', async (suffix) => {
      const response = await fetch(`${base}/notifications${suffix}`, { headers });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(query.mock.calls.some(([sql]) => String(sql).includes('FROM notifications'))).toBe(false);
    });

  it('rejects a cursor issued to another Customer', async () => {
    const foreign = encodeNotificationCursor(otherId, { id: uuid(1), createdAt: '2026-11-07T01:00:00.123456Z' });
    const response = await fetch(`${base}/notifications?cursor=${foreign}`, { headers });
    expect(response.status).toBe(400);
  });

  it('returns 503 without leaking SQL when the read path fails, and recovers afterwards', async () => {
    failList = true;
    const failed = await fetch(`${base}/notifications`, { headers });
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toMatch(/boom|SELECT|FROM|08006/);
    failList = false; rows = [row(1)];
    expect((await (await fetch(`${base}/notifications`, { headers })).json()).data).toHaveLength(1);
  });
});
