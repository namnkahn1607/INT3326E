import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module';
import { configureApp } from '../config/app.config';
import { FIREBASE_AUTH } from '../modules/auth/providers/firebase-auth.provider';
import { USER_DATABASE } from '../modules/users/user-database.provider';

// TV6 QA tuần 7: chỉ bổ sung các ca chưa có trong assignments.postgres.spec.ts (TC06.1 với Customer khác,
// TC03.4 phần chạy được khi chưa có Fail, và ma trận quyền TC10). Chạy trên PostgreSQL thật, Firebase giả lập.
const connectionString = process.env.TV6_ADMIN_TEST_DATABASE_URL;
const users = {
  c1: ['usr_01ARZ3NDEKTSV4RRFFQ69G5FAV', 'CUSTOMER'], c2: ['usr_01ARZ3NDEKTSV4RRFFQ69G5FAW', 'CUSTOMER'],
  d1: ['usr_01ARZ3NDEKTSV4RRFFQ69G5FAX', 'DRIVER'], d2: ['usr_01ARZ3NDEKTSV4RRFFQ69G5FAY', 'DRIVER'],
  a1: ['usr_01ARZ3NDEKTSV4RRFFQ69G5FAZ', 'ADMIN'],
} as const;
type Actor = keyof typeof users | 'unlinked';
const payload = { pickupAddress: '144 Xuan Thuy', pickupLocation: { lat: 21.0378, lng: 105.7829 },
  dropoffAddress: '1 Dai Co Viet', dropoffLocation: { lat: 21.0061, lng: 105.8431 },
  recipientName: 'Nguoi nhan', recipientPhone: '+84900000000' };

describe.skipIf(!connectionString)('QA tuần 7: luồng đầu cuối và ma trận quyền (PostgreSQL thật, Firebase giả lập)', () => {
  let pool: Pool;
  let app: INestApplication;
  let base: string;
  const schema = `qa_w7_${randomUUID().replaceAll('-', '')}`;

  const role = (a: Actor) => (a === 'unlinked' ? 'CUSTOMER' : users[a][1]);
  const call = (method: string, path: string, actor?: Actor, body?: unknown, extra: Record<string, string> = {}) =>
    fetch(base + path, { method, headers: { ...(actor ? { Authorization: `Bearer ${actor}` } : {}),
      'Content-Type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const effects = async () => (await pool.query<{ e: number; n: number }>(
    'SELECT (SELECT count(*)::int FROM shipment_status_events) e, (SELECT count(*)::int FROM notifications) n')).rows[0];
  const create = async () => {
    const r = await call('POST', '/shipments', 'c1', payload, { 'Idempotency-Key': randomUUID() });
    expect(r.status).toBe(201);
    return (await r.json()) as { id: string; trackingNumber: string };
  };
  const assign = (id: string, driver: keyof typeof users) => call('POST', `/shipments/${id}/assign`, 'a1', { driverId: users[driver][0] });

  beforeAll(async () => {
    const target = new URL(connectionString!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/parcelflow_admin_test') {
      throw new Error('Use a disposable loopback database named parcelflow_admin_test');
    }
    pool = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
    pool.on('connect', (client) => { void client.query(`SET search_path TO "${schema}"`); });
    await pool.query(`CREATE SCHEMA "${schema}"`);
    await pool.query(readFileSync('../../packages/database/sql/001-create-shipment.sql', 'utf8'));
    // Repo chưa có DDL cho bảng GPS (tồn đọng mục 8); fixture dựng current_locations theo DATA04 để /drivers chạy được.
    await pool.query(`CREATE TABLE current_locations ("driverId" text PRIMARY KEY REFERENCES users(id),
      lat double precision NOT NULL, lng double precision NOT NULL, "clientTimestamp" timestamptz(3) NOT NULL,
      "receivedAt" timestamptz(3) NOT NULL, "eventId" text NOT NULL, "sessionId" uuid, seq int,
      "updatedAt" timestamptz(3) NOT NULL DEFAULT now())`);
    for (const [uid, [id, r]] of Object.entries(users)) {
      await pool.query('INSERT INTO users (id,"firebaseUid",email,name,role) VALUES ($1,$2,$3,$4,$5)', [id, uid, `${uid}@x.vn`, uid, r]);
    }
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FIREBASE_AUTH).useValue({
        verifyIdToken: vi.fn(async (token: Actor) => ({ uid: token, role: role(token) })),
        getUser: vi.fn(async (uid: Actor) => ({ disabled: false, customClaims: { role: role(uid) } })),
      }).overrideProvider(USER_DATABASE).useValue(pool).compile();
    app = module.createNestApplication(); configureApp(app); await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/v1`;
  }, 30_000);

  beforeEach(async () => { await pool.query('TRUNCATE idempotency_requests, notifications, shipment_status_events, shipments'); });
  afterAll(async () => {
    await app?.close().catch(() => undefined);
    await new Pool({ connectionString, max: 1 }).query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
  });

  it('TC06.1: đủ chuỗi CREATED → ASSIGNED → REASSIGNED → PICKED_UP → DELIVERED; chỉ chủ đơn và tài xế hiện hành xem được', async () => {
    const s = await create();
    expect((await assign(s.id, 'd1')).status).toBe(200);
    expect((await assign(s.id, 'd2')).status).toBe(200);
    expect((await call('POST', `/shipments/${s.id}/pickup`, 'd2')).status).toBe(200);
    expect((await call('POST', `/shipments/${s.id}/deliver`, 'd2', { proofOfDeliveryNotes: 'Giao cho lễ tân' })).status).toBe(200);

    const detail = await (await call('GET', `/shipments/${s.id}`, 'c1')).json();
    expect(detail.statusHistory.map((e: { action: string }) => e.action))
      .toEqual(['CREATED', 'ASSIGNED', 'REASSIGNED', 'PICKED_UP', 'DELIVERED']);
    expect(detail.statusHistory.map((e: { toStatus: string }) => e.toStatus))
      .toEqual(['CREATED', 'ASSIGNED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED']);
    const times = detail.statusHistory.map((e: { occurredAt: string }) => e.occurredAt);
    expect(times).toEqual([...times].sort());
    expect(detail.statusHistory.map((e: { actorRole: string }) => e.actorRole))
      .toEqual(['CUSTOMER', 'ADMIN', 'ADMIN', 'DRIVER', 'DRIVER']);
    expect(JSON.stringify(detail)).not.toMatch(/currentLocation|clientTimestamp|location_history|total/);

    // Customer khác, tài xế cũ (đã bị gán lại) không thấy chi tiết và không thấy đơn trong danh sách.
    for (const actor of ['c2', 'd1'] as const) {
      expect((await call('GET', `/shipments/${s.id}`, actor)).status).toBe(403);
      expect((await (await call('GET', '/shipments', actor)).json()).data).toEqual([]);
    }
    expect((await call('GET', `/shipments/${s.id}`, 'd2')).status).toBe(200);
    const filtered = await (await call('GET', `/shipments?status=DELIVERED&trackingNumber=${s.trackingNumber}`, 'c1')).json();
    expect(filtered.data.map((x: { id: string }) => x.id)).toEqual([s.id]);
    // Thông báo PICKED_UP và DELIVERED đến đúng chủ đơn, Customer khác không có.
    const kinds = (await (await call('GET', '/notifications', 'c1')).json()).data.map((n: { kind: string }) => n.kind);
    expect(kinds).toEqual(['DELIVERED', 'PICKED_UP', 'REASSIGNED', 'ASSIGNED', 'CREATED']);
    expect((await (await call('GET', '/notifications', 'c2')).json()).data).toEqual([]);
  });

  it('TC03.4 (phần chạy được khi chưa có Fail): hai Deliver đồng thời chỉ tạo một event và một thông báo', async () => {
    const s = await create();
    await assign(s.id, 'd1');
    await call('POST', `/shipments/${s.id}/pickup`, 'd1');
    const before = await effects();
    const results = await Promise.all([
      call('POST', `/shipments/${s.id}/deliver`, 'd1', { proofOfDeliveryNotes: 'A' }),
      call('POST', `/shipments/${s.id}/deliver`, 'd1', { proofOfDeliveryNotes: 'B' }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const bodies = await Promise.all(results.map((r) => r.json()));
    expect(bodies[0]).toEqual(bodies[1]);
    expect(await effects()).toEqual({ e: before.e + 1, n: before.n + 1 });
    // Sau terminal không đổi được nữa.
    expect((await call('POST', `/shipments/${s.id}/pickup`, 'd1')).status).toBe(409);
  });

  describe('TC10: ma trận quyền', () => {
    let delivered: string;
    let assigned: string;
    beforeEach(async () => {
      delivered = (await create()).id;
      await assign(delivered, 'd1');
      await call('POST', `/shipments/${delivered}/pickup`, 'd1');
      await call('POST', `/shipments/${delivered}/deliver`, 'd1');
      assigned = (await create()).id;
      await assign(assigned, 'd1');
    });

    const protectedCalls = (id: string): [string, string, unknown?][] => [
      ['GET', '/shipments'], ['GET', `/shipments/${id}`], ['POST', '/shipments', payload],
      ['POST', `/shipments/${id}/assign`, { driverId: users.d2[0] }], ['POST', `/shipments/${id}/pickup`],
      ['POST', `/shipments/${id}/deliver`], ['GET', '/notifications'], ['GET', '/drivers'], ['GET', '/admin/customers'],
      ['GET', '/auth/me'], ['GET', '/admin/me'], ['POST', '/locations', {}],
    ];

    it('TC10.1: không token thì mọi API bảo vệ trả 401; health vẫn public', async () => {
      const before = await effects();
      for (const [m, p, b] of protectedCalls(assigned)) {
        const r = await call(m, p, undefined, b);
        expect([m, p, r.status]).toEqual([m, p, 401]);
      }
      expect((await fetch(base.replace('/v1', '') + '/healthz')).status).toBe(200);
      expect(await effects()).toEqual(before);
    });

    it('TC10.2: token hợp lệ nhưng chưa có row users thì API nghiệp vụ trả 409 USER_NOT_PROVISIONED', async () => {
      for (const [m, p, b] of [['GET', '/shipments'], ['GET', `/shipments/${assigned}`], ['GET', '/notifications'],
        ['POST', '/shipments', payload]] as [string, string, unknown?][]) {
        const r = await call(m, p, 'unlinked', b, { 'Idempotency-Key': randomUUID() });
        expect([m, p, r.status]).toEqual([m, p, 409]);
        expect((await r.json()).code).toBe('USER_NOT_PROVISIONED');
      }
    });

    // [actor, method, path, status mong đợi]; mỗi ca chạy hai lần để kiểm retry không đổi kết quả và DB.
    const matrix = (): [Actor, string, string, number, unknown?][] => [
      ['c2', 'GET', `/shipments/${delivered}`, 403], ['c2', 'POST', `/shipments/${assigned}/assign`, 403, { driverId: users.d2[0] }],
      ['c2', 'POST', `/shipments/${assigned}/pickup`, 403], ['c2', 'POST', `/shipments/${delivered}/deliver`, 403],
      ['c2', 'GET', '/drivers', 403], ['c2', 'GET', '/admin/customers', 403], ['c2', 'POST', '/locations', 403, {}],
      ['d2', 'GET', `/shipments/${assigned}`, 403], ['d2', 'GET', `/shipments/${delivered}`, 403],
      ['d2', 'POST', `/shipments/${assigned}/pickup`, 403], ['d2', 'POST', `/shipments/${assigned}/deliver`, 403],
      ['d2', 'POST', `/shipments/${assigned}/assign`, 403, { driverId: users.d2[0] }], ['d2', 'GET', '/notifications', 403],
      ['d2', 'GET', '/drivers', 403], ['d2', 'POST', '/shipments', 403, payload],
      ['a1', 'GET', `/shipments/${delivered}`, 200], ['a1', 'POST', `/shipments/${assigned}/pickup`, 403],
      ['a1', 'POST', `/shipments/${assigned}/deliver`, 403], ['a1', 'POST', `/shipments/${delivered}/assign`, 409, { driverId: users.d2[0] }],
      ['a1', 'GET', '/notifications', 403], ['a1', 'POST', '/shipments', 403, payload], ['a1', 'POST', '/locations', 403, {}],
      ['a1', 'GET', '/drivers', 200],
    ];

    it('TC10.3: Customer khác, Driver không được gán, Admin chỉ làm được đúng phần đặc tả cho phép; gọi lặp không đổi DB', async () => {
      const before = await effects();
      for (const [actor, m, p, expected, b] of matrix()) {
        for (let attempt = 0; attempt < 2; attempt++) {
          const r = await call(m, p, actor, b, { 'Idempotency-Key': randomUUID() });
          expect([actor, m, p, attempt, r.status]).toEqual([actor, m, p, attempt, expected]);
        }
      }
      expect(await effects()).toEqual(before);
      for (const actor of ['c2', 'd2'] as const) {
        expect((await (await call('GET', '/shipments', actor)).json()).data).toEqual([]);
      }
      expect((await (await call('GET', '/notifications', 'c2')).json()).data).toEqual([]);
      const adminList = (await (await call('GET', '/shipments', 'a1')).json()).data.map((x: { id: string }) => x.id);
      expect(adminList.sort()).toEqual([assigned, delivered].sort());
    });
  });
});
