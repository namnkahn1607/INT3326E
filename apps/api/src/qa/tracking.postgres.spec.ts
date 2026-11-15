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

// QA tracking (API09) theo quyền và trạng thái, trên PostgreSQL thật với 001 + 002, Firebase giả lập.
// Vị trí GPS được ghi thẳng vào current_locations để dựng từng tình huống; đường ghi thật của Worker có test riêng.
const connectionString = process.env.TV6_ADMIN_TEST_DATABASE_URL;
const users = {
  c1: ['usr_01ARZ3NDEKTSV4RRFFQ69G5FAV', 'CUSTOMER'], c2: ['usr_01ARZ3NDEKTSV4RRFFQ69G5FAW', 'CUSTOMER'],
  d1: ['usr_01ARZ3NDEKTSV4RRFFQ69G5FAX', 'DRIVER'], d2: ['usr_01ARZ3NDEKTSV4RRFFQ69G5FAY', 'DRIVER'],
  a1: ['usr_01ARZ3NDEKTSV4RRFFQ69G5FAZ', 'ADMIN'],
} as const;
type Actor = keyof typeof users;
const payload = { pickupAddress: '144 Xuan Thuy', pickupLocation: { lat: 21.0378, lng: 105.7829 },
  dropoffAddress: '1 Dai Co Viet', dropoffLocation: { lat: 21.0061, lng: 105.8431 },
  recipientName: 'Nguoi nhan', recipientPhone: '+84900000000' };
const SC05_KEYS = ['shipmentId', 'status', 'driverId', 'pickupLocation', 'dropoffLocation', 'currentDriverLocation',
  'lastLocationUpdatedAt', 'locationClientTimestamp', 'isLocationStale', 'eta', 'etaUnavailableReason',
  'expectedDeliveryAt', 'isLate'].sort();

describe.skipIf(!connectionString)('QA tracking API09 (PostgreSQL thật, Firebase giả lập)', () => {
  let pool: Pool;
  let app: INestApplication;
  let base: string;
  const schema = `qa_trk_${randomUUID().replaceAll('-', '')}`;

  const call = (method: string, path: string, actor?: Actor, body?: unknown, extra: Record<string, string> = {}) =>
    fetch(base + path, { method, headers: { ...(actor ? { Authorization: `Bearer ${actor}` } : {}),
      'Content-Type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const track = (id: string, actor?: Actor) => call('GET', `/shipments/${id}/tracking`, actor);
  const create = async () => (await (await call('POST', '/shipments', 'c1', payload, { 'Idempotency-Key': randomUUID() })).json()).id as string;
  const assign = (id: string, d: Actor) => call('POST', `/shipments/${id}/assign`, 'a1', { driverId: users[d][0] });
  // Ghi vị trí như Worker: clientTimestamp lùi agoMs so với giờ DB, receivedAt ngay sau đó.
  const gps = (d: Actor, agoMs: number, lat = 21.03, lng = 105.8) => pool.query(
    `INSERT INTO current_locations ("driverId",lat,lng,"clientTimestamp","receivedAt","eventId")
     VALUES ($1,$2,$3,clock_timestamp() - ($4 || ' milliseconds')::interval, clock_timestamp() - ($4 || ' milliseconds')::interval + interval '200 ms', $5)
     ON CONFLICT ("driverId") DO UPDATE SET lat=EXCLUDED.lat, lng=EXCLUDED.lng, "clientTimestamp"=EXCLUDED."clientTimestamp",
       "receivedAt"=EXCLUDED."receivedAt", "eventId"=EXCLUDED."eventId"`, [users[d][0], lat, lng, String(agoMs), randomUUID()]);

  beforeAll(async () => {
    const target = new URL(connectionString!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/parcelflow_admin_test') {
      throw new Error('Use a disposable loopback database named parcelflow_admin_test');
    }
    // search_path nằm trong chuỗi kết nối để mọi connection mới đều đúng schema ngay từ đầu, không phụ thuộc thứ tự query.
    const admin = new Pool({ connectionString, max: 1 });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.end();
    const scoped = new URL(connectionString!);
    scoped.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: scoped.toString(), max: 4, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
    for (const file of ['001-create-shipment.sql', '002-create-gps-locations.sql']) {
      await pool.query(readFileSync(`../../packages/database/sql/${file}`, 'utf8'));
    }
    for (const [uid, [id, r]] of Object.entries(users)) {
      await pool.query('INSERT INTO users (id,"firebaseUid",email,name,role) VALUES ($1,$2,$3,$4,$5)', [id, uid, `${uid}@x.vn`, uid, r]);
    }
    const role = (a: Actor) => users[a][1];
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FIREBASE_AUTH).useValue({
        verifyIdToken: vi.fn(async (token: Actor) => ({ uid: token, role: role(token) })),
        getUser: vi.fn(async (uid: Actor) => ({ disabled: false, customClaims: { role: role(uid) } })),
      }).overrideProvider(USER_DATABASE).useValue(pool).compile();
    app = module.createNestApplication(); configureApp(app); await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/v1`;
  }, 30_000);

  beforeEach(async () => {
    await pool.query('TRUNCATE idempotency_requests, notifications, shipment_status_events, shipments, current_locations');
  });
  afterAll(async () => {
    await app?.close().catch(() => undefined);
    await new Pool({ connectionString, max: 1 }).query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
  });

  it('quyền: chủ đơn, tài xế được gán, Admin 200; Customer khác, tài xế khác 403; không token 401; đơn không tồn tại 404', async () => {
    const id = await create();
    await assign(id, 'd1');
    for (const a of ['c1', 'd1', 'a1'] as const) expect([a, (await track(id, a)).status]).toEqual([a, 200]);
    for (const a of ['c2', 'd2'] as const) expect([a, (await track(id, a)).status]).toEqual([a, 403]);
    expect((await track(id)).status).toBe(401);
    expect((await track('sh_01ARZ3NDEKTSV4RRFFQ69G5FAV', 'a1')).status).toBe(404);
    const r = await track(id, 'c1');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(Object.keys(await r.json()).sort()).toEqual(SC05_KEYS);
  });

  it('CREATED: không có tài xế, không có vị trí', async () => {
    const id = await create();
    expect(await (await track(id, 'c1')).json()).toMatchObject({ status: 'CREATED', driverId: null,
      currentDriverLocation: null, isLocationStale: null, eta: null });
  });

  it('ASSIGNED chưa có GPS: vị trí null, isLocationStale null', async () => {
    const id = await create(); await assign(id, 'd1');
    expect(await (await track(id, 'c1')).json()).toMatchObject({ status: 'ASSIGNED', currentDriverLocation: null,
      lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null, eta: null });
  });

  it('ASSIGNED có GPS mới: trả mẫu mới nhất, không stale, chưa có ETA', async () => {
    const id = await create(); await assign(id, 'd1'); await gps('d1', 5_000, 21.031, 105.801);
    expect(await (await track(id, 'c1')).json()).toMatchObject({ status: 'ASSIGNED',
      currentDriverLocation: { lat: 21.031, lng: 105.801 }, isLocationStale: false, eta: null });
  });

  it('PICKED_UP: GPS mới không stale; GPS cũ hơn 30 giây có nhãn stale và không có ETA', async () => {
    const id = await create(); await assign(id, 'd1');
    expect((await call('POST', `/shipments/${id}/pickup`, 'd1')).status).toBe(200);
    await gps('d1', 5_000);
    expect(await (await track(id, 'c1')).json()).toMatchObject({ status: 'PICKED_UP', isLocationStale: false });
    await gps('d1', 31_000);
    const stale = await (await track(id, 'c1')).json();
    expect(stale).toMatchObject({ status: 'PICKED_UP', isLocationStale: true, eta: null, etaUnavailableReason: 'LOCATION_STALE' });
    expect(stale.currentDriverLocation).not.toBeNull();
  });

  it('PICKED_UP chưa có GPS: vị trí null, ETA null kèm lý do', async () => {
    const id = await create(); await assign(id, 'd1'); await call('POST', `/shipments/${id}/pickup`, 'd1');
    expect(await (await track(id, 'c1')).json()).toMatchObject({ currentDriverLocation: null, isLocationStale: null,
      eta: null, etaUnavailableReason: 'LOCATION_MISSING' });
  });

  it('gán lại tài xế: không trả vị trí của tài xế cũ; tài xế cũ bị 403', async () => {
    const id = await create(); await assign(id, 'd1'); await gps('d1', 2_000, 21.5, 105.5);
    expect((await (await track(id, 'c1')).json()).currentDriverLocation).toEqual({ lat: 21.5, lng: 105.5 });
    await assign(id, 'd2');
    const after = await (await track(id, 'c1')).json();
    expect(after).toMatchObject({ driverId: users.d2[0], currentDriverLocation: null, isLocationStale: null });
    expect((await track(id, 'd1')).status).toBe(403);
    await gps('d2', 2_000, 21.6, 105.6);
    expect((await (await track(id, 'c1')).json()).currentDriverLocation).toEqual({ lat: 21.6, lng: 105.6 });
  });

  it('đơn đã giao: không lộ vị trí dù tài xế vẫn còn GPS', async () => {
    const id = await create(); await assign(id, 'd1'); await call('POST', `/shipments/${id}/pickup`, 'd1');
    await call('POST', `/shipments/${id}/deliver`, 'd1'); await gps('d1', 2_000);
    for (const a of ['c1', 'd1', 'a1'] as const) {
      expect(await (await track(id, a)).json()).toMatchObject({ status: 'DELIVERED', currentDriverLocation: null,
        lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null, eta: null });
    }
  });
});
