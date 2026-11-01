import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PGlite } from '@electric-sql/pglite';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module';
import { configureApp } from '../../config/app.config';
import { FIREBASE_AUTH } from '../auth/providers/firebase-auth.provider';
import { USER_DATABASE } from '../users/user-database.provider';

const nativeUrl = process.env.SHIPMENT_TEST_DATABASE_URL;
const id = (n: number) => `usr_${String(n).padStart(26, '0')}`;
const shipmentId = (n: number) => `sh_${String(n).padStart(26, '0')}`;
const users = { customer: [1, 'CUSTOMER'], other: [2, 'CUSTOMER'], driver1: [3, 'DRIVER'],
  driver2: [4, 'DRIVER'], admin: [5, 'ADMIN'], admin2: [6, 'ADMIN'] } as const;
type Actor = keyof typeof users | 'missing' | 'mismatch';
const payload = { pickupAddress: '144 Xuan Thuy', pickupLocation: { lat: 21, lng: 105 },
  dropoffAddress: '1 Dai Co Viet', dropoffLocation: { lat: 0, lng: 0 },
  recipientName: 'Nguoi nhan', recipientPhone: '+84900000000' };

// Cả hai chế độ chạy handler và SQL thật. Chỉ PostgreSQL nhiều connection kiểm chứng được việc chờ khóa.
for (const mode of ['pglite', 'postgres'] as const) {
  describe.skipIf(mode === 'postgres' && !nativeUrl)(`Tuần 6: đọc đơn và phân công (${mode}, Firebase giả lập)`, () => {
    let app: INestApplication;
    let base: string;
    let engine: PGlite | undefined;
    let pool: Pool | undefined;
    let failWrite: string | null = null;
    let loseCommit = false;
    let blockWrite: { reached: () => void; gate: Promise<void> } | null = null;
    const schema = `assignment_test_${randomUUID().replaceAll('-', '')}`;
    const query = async <T extends QueryResultRow = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> =>
      engine ? engine.query<T>(sql, params) : pool!.query<T>(sql, params);

    async function intercepted(sql: string, params: unknown[] = [], client?: PoolClient) {
      if (blockWrite && sql.startsWith('UPDATE shipments')) {
        const barrier = blockWrite; blockWrite = null;
        barrier.reached(); await barrier.gate;
      }
      if (failWrite && sql.includes(failWrite)) throw new Error('private SQL credentials');
      const result = client ? await client.query(sql, params) : await query(sql, params);
      if (sql === 'COMMIT' && loseCommit) { loseCommit = false; throw new Error('lost COMMIT response'); }
      return result;
    }

    beforeAll(async () => {
      let adapter: object;
      if (mode === 'pglite') {
        engine = new PGlite();
        let tail = Promise.resolve();
        adapter = { query, end: async () => {}, connect: async () => {
          const previous = tail;
          let release!: () => void;
          tail = new Promise<void>(r => { release = r; });
          await previous;
          return { query: intercepted, release };
        } };
      } else {
        const target = new URL(nativeUrl!);
        if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
            target.pathname !== '/parcelflow_shipments_test' || [...target.searchParams.keys()].some(k => k !== 'sslmode')) {
          throw new Error('Chỉ dùng database test riêng trên máy tên parcelflow_shipments_test, không ghi đè tham số kết nối');
        }
        pool = new Pool({ connectionString: nativeUrl, max: 8, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
        await pool.query(`CREATE SCHEMA "${schema}"`); await pool.end();
        pool = new Pool({ connectionString: nativeUrl, max: 8, connectionTimeoutMillis: 5000, statement_timeout: 5000,
          options: `-c search_path=${schema}` });
        adapter = { query, end: async () => {}, connect: async () => {
          const client = await pool!.connect();
          return { query: (sql: string, params: unknown[]) => intercepted(sql, params, client),
            release: (error?: Error) => client.release(error) };
        } };
      }
      const sql = await readFile(resolve(process.cwd(), '../../packages/database/sql/001-create-shipment.sql'), 'utf8');
      if (engine) await engine.exec(sql); else await pool!.query(sql);
      for (const [uid, [n, role]] of Object.entries(users)) {
        await query('INSERT INTO users (id,"firebaseUid",email,name,role) VALUES ($1,$2,$3,$4,$5)',
          [id(n), uid, `${uid}@example.com`, uid, role]);
      }
      await query('INSERT INTO users (id,"firebaseUid",email,name,role) VALUES ($1,$2,$3,$4,$5)',
        [id(7), 'mismatch', 'mismatch@example.com', 'mismatch', 'CUSTOMER']);
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(FIREBASE_AUTH).useValue({
          verifyIdToken: vi.fn(async (token: Actor) => ({ uid: token,
            role: token === 'missing' || token === 'mismatch' ? 'ADMIN' : users[token][1] })),
          getUser: vi.fn(async (uid: Actor) => ({ disabled: false, customClaims: {
            role: uid === 'missing' || uid === 'mismatch' ? 'ADMIN' : users[uid][1] } })),
        }).overrideProvider(USER_DATABASE).useValue(adapter).compile();
      app = module.createNestApplication(); configureApp(app); await app.listen(0, '127.0.0.1');
      base = `${await app.getUrl()}/v1`;
    }, 30_000);

    beforeEach(async () => {
      failWrite = null; loseCommit = false; blockWrite = null;
      await query('TRUNCATE idempotency_requests, notifications, shipment_status_events, shipments');
    });
    afterAll(async () => {
      await app?.close(); await engine?.close();
      if (pool) { try { await pool.query(`DROP SCHEMA "${schema}" CASCADE`); } finally { await pool.end(); } }
    });

    const headers = (actor: Actor) => ({ Authorization: `Bearer ${actor}`, 'Content-Type': 'application/json' });
    const get = (path: string, actor: Actor = 'admin') => fetch(base + path, { headers: headers(actor) });
    const assign = (s: string, driverId = id(3), actor: Actor = 'admin', body: unknown = { driverId }, suffix = '') =>
      fetch(`${base}/shipments/${s}/assign${suffix}`, { method: 'POST', headers: headers(actor), body: JSON.stringify(body) });
    const create = async (actor: 'customer' | 'other' = 'customer', extra: object = {}) => {
      const response = await fetch(`${base}/shipments`, { method: 'POST',
        headers: { ...headers(actor), 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ ...payload, ...extra }) });
      expect(response.status).toBe(201); return response.json();
    };
    const effects = async () => (await query<{ events: number; notifications: number }>(`
      SELECT (SELECT count(*)::int FROM shipment_status_events WHERE action<>'CREATED') AS events,
        (SELECT count(*)::int FROM notifications WHERE kind<>'CREATED') AS notifications`)).rows[0];

    it('bảo vệ API đọc đơn và phân công bằng xác thực, role và liên kết người dùng nghiệp vụ', async () => {
      const s = await create();
      for (const path of ['/shipments', `/shipments/${s.id}`, `/shipments/${s.id}/assign`]) {
        const response = await fetch(base + path, path.endsWith('/assign') ? { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ driverId: id(3) }) } : {});
        expect(response.status).toBe(401);
      }
      for (const actor of ['customer', 'driver1'] as const) expect((await assign(s.id, id(3), actor)).status).toBe(403);
      for (const actor of ['missing', 'mismatch'] as const) {
        for (const response of [await get('/shipments', actor), await get(`/shipments/${s.id}`, actor), await assign(s.id, id(3), actor)]) {
          expect(response.status).toBe(409); expect((await response.json()).code).toBe('USER_NOT_PROVISIONED');
        }
      }
      expect(await effects()).toEqual({ events: 0, notifications: 0 });
    });

    it('TC02.1: gán tài xế và ghi lịch sử, thông báo cùng giao dịch; response đúng SC02', async () => {
      const s = await create(); const response = await assign(s.id);
      expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
      const body = await response.json();
      expect(body).toMatchObject({ ...s, driverId: id(3), status: 'ASSIGNED', updatedAt: expect.any(String) });
      expect(Object.keys(body).sort()).toEqual(Object.keys(s).sort());
      const detail = await (await get(`/shipments/${s.id}`)).json();
      expect(detail.statusHistory).toHaveLength(2);
      expect(detail.statusHistory[1]).toMatchObject({ shipmentId: s.id, action: 'ASSIGNED', fromStatus: 'CREATED',
        toStatus: 'ASSIGNED', actorUserId: id(5), actorRole: 'ADMIN', previousDriverId: null, newDriverId: id(3), reason: null });
      expect(detail.statusHistory[1].occurredAt).toBe(body.updatedAt);
      expect(await effects()).toEqual({ events: 1, notifications: 1 });
      const n = (await query(`SELECT * FROM notifications WHERE kind='ASSIGNED'`)).rows[0];
      expect(n).toMatchObject({ customerId: id(1), shipmentId: s.id, statusEventId: detail.statusHistory[1].id });
      expect(String(n.body)).not.toContain(payload.recipientPhone);
    });

    it('TC02.2: gán lại đúng tài xế không đổi thời gian và không thêm lịch sử, thông báo', async () => {
      const s = await create(); const first = await (await assign(s.id)).json();
      const second = await assign(s.id, id(3), 'admin2'); expect(second.status).toBe(200);
      expect(await second.json()).toEqual(first);
      expect(await effects()).toEqual({ events: 1, notifications: 1 });
    });

    it('TC02.3: gán lại ghi đúng tài xế trước/sau và thu quyền xem của tài xế cũ', async () => {
      const s = await create(); await assign(s.id);
      const changed = await assign(s.id, id(4), 'admin2'); expect(changed.status).toBe(200);
      expect(await changed.json()).toMatchObject({ driverId: id(4), status: 'ASSIGNED' });
      expect((await get(`/shipments/${s.id}`, 'driver1')).status).toBe(403);
      expect((await (await get('/shipments', 'driver1')).json()).data).toEqual([]);
      expect((await get(`/shipments/${s.id}`, 'driver2')).status).toBe(200);
      const detail = await (await get(`/shipments/${s.id}`, 'customer')).json();
      expect(detail.statusHistory[2]).toMatchObject({ action: 'REASSIGNED', fromStatus: 'ASSIGNED', toStatus: 'ASSIGNED',
        previousDriverId: id(3), newDriverId: id(4), actorUserId: id(6), reason: null });
      expect(await effects()).toEqual({ events: 2, notifications: 2 });
    });

    it('TC02.4: thiếu đơn/tài xế trả 404, sai role trả 400, đã lấy hàng/kết thúc trả 409', async () => {
      const s = await create(); expect((await assign(shipmentId(999))).status).toBe(404);
      expect((await assign(s.id, id(999))).status).toBe(404);
      expect((await assign(s.id, id(1))).status).toBe(400);
      await assign(s.id);
      for (const status of ['PICKED_UP', 'DELIVERED']) {
        await query('UPDATE shipments SET status=$2 WHERE id=$1', [s.id, status]);
        const response = await assign(s.id); expect(response.status).toBe(409);
        expect((await response.json()).code).toBe('INVALID_STATE_TRANSITION');
      }
      await query(`UPDATE shipments SET status='DELIVERY_FAILED', "failureReason"='Test reason',
        "failedByUserId"=$2,"failedByRole"='DRIVER' WHERE id=$1`, [s.id, id(3)]);
      expect((await assign(s.id)).status).toBe(409);
      expect(await effects()).toEqual({ events: 1, notifications: 1 });
    });

    it.each(['INSERT INTO shipment_status_events', 'INSERT INTO notifications', 'UPDATE shipments'])(
      'hoàn tác phân công khi %s lỗi, không lộ SQL và cho phép thử lại khi lỗi đã hết', async stage => {
        const s = await create(); failWrite = stage;
        const failed = await assign(s.id); expect(failed.status).toBe(503);
        expect(JSON.stringify(await failed.json())).not.toMatch(/credentials|INSERT|UPDATE|SELECT/);
        expect((await query('SELECT status,"driverId" FROM shipments WHERE id=$1', [s.id])).rows[0])
          .toEqual({ status: 'CREATED', driverId: null });
        expect(await effects()).toEqual({ events: 0, notifications: 0 });
        failWrite = null; expect((await assign(s.id)).status).toBe(200);
      });

    it('TC02.6: mất phản hồi sau commit vẫn đọc lại được chi tiết và không ghi trùng phân công', async () => {
      const s = await create(); loseCommit = true; expect((await assign(s.id)).status).toBe(503);
      const detail = await (await get(`/shipments/${s.id}`)).json();
      expect(detail).toMatchObject({ status: 'ASSIGNED', driverId: id(3) });
      expect(detail.statusHistory).toHaveLength(2);
      expect((await assign(s.id)).status).toBe(200);
      expect(await effects()).toEqual({ events: 1, notifications: 1 });
    });

    it('cho phép một tài xế nhận nhiều đơn', async () => {
      const a = await create(); const b = await create();
      expect((await assign(a.id)).status).toBe(200); expect((await assign(b.id)).status).toBe(200);
      expect((await (await get('/shipments', 'driver1')).json()).data).toHaveLength(2);
    });

    it('lọc đơn theo người dùng, mã vận đơn và trạng thái; trả trang rỗng khi không có kết quả', async () => {
      const a = await create(); const b = await create('other'); await assign(a.id);
      const list = await get('/shipments', 'customer'); expect(list.headers.get('cache-control')).toBe('no-store');
      expect((await list.json()).data.map((s: { id: string }) => s.id)).toEqual([a.id]);
      expect((await get(`/shipments/${b.id}`, 'customer')).status).toBe(403);
      expect((await get(`/shipments/${shipmentId(999)}`)).status).toBe(404);
      expect((await (await get(`/shipments?trackingNumber=${b.trackingNumber}`, 'customer')).json()).data).toEqual([]);
      expect((await (await get('/shipments?status=CREATED')).json()).data.map((s: { id: string }) => s.id)).toEqual([b.id]);
      expect((await (await get('/shipments?status=DELIVERED')).json()).pagination)
        .toEqual({ limit: 20, hasMore: false, nextCursor: null });
    });

    it('phân trang đúng khi trùng thời gian hoặc lệch micro giây; chặn cursor khác người dùng/bộ lọc', async () => {
      // Schema mẫu dùng mili giây; vẫn phải phân trang đúng nếu database chung lưu đến micro giây.
      await query('ALTER TABLE shipments ALTER COLUMN "createdAt" TYPE timestamptz(6)');
      const created = await Promise.all([create(), create(), create()]);
      for (const [i, s] of created.entries()) await query('UPDATE shipments SET "createdAt"=$2 WHERE id=$1',
        [s.id, i === 0 ? '2026-10-26T00:00:00.123456Z' : '2026-10-26T00:00:00.123455Z']);
      const expected = [created[0].id, ...created.slice(1).map(s => s.id as string).sort((a, b) => a < b ? 1 : a > b ? -1 : 0)];
      const seen: string[] = []; let cursor: string | null = null;
      do {
        const body = await (await get(`/shipments?limit=1${cursor ? '&cursor=' + cursor : ''}`)).json();
        seen.push(...body.data.map((s: { id: string }) => s.id));
        cursor = body.pagination.nextCursor; expect(body.pagination.hasMore).toBe(cursor !== null);
        expect(seen.length).toBeLessThanOrEqual(3);
      } while (cursor);
      expect(seen).toEqual(expected);
      const first = await (await get('/shipments?limit=1')).json();
      expect((await get('/shipments?cursor=' + first.pagination.nextCursor, 'customer')).status).toBe(400);
      expect((await get('/shipments?status=ASSIGNED&cursor=' + first.pagination.nextCursor)).status).toBe(400);
    });

    it('tài xế vẫn xem được đơn đã kết thúc; giao trễ tính theo sự kiện kết thúc', async () => {
      const s = await create('customer', { expectedDeliveryAt: new Date(Date.now() + 60_000).toISOString() });
      await assign(s.id);
      await query(`UPDATE shipments SET status='DELIVERED',"expectedDeliveryAt"='2026-01-01T01:00:00Z',
        "updatedAt"='2026-01-01T01:00:00Z' WHERE id=$1`, [s.id]);
      await query(`INSERT INTO shipment_status_events
        (id,"shipmentId",action,"fromStatus","toStatus","actorUserId","actorRole","previousDriverId","newDriverId","occurredAt")
        VALUES ($1,$2,'DELIVERED','PICKED_UP','DELIVERED',$3,'DRIVER',$3,$3,'2026-01-01T01:00:00Z')`, [randomUUID(), s.id, id(3)]);
      const body = await (await get(`/shipments/${s.id}`, 'driver1')).json();
      expect(body.isLate).toBe(false);
      const listed = await (await get('/shipments?status=DELIVERED', 'driver1')).json();
      expect(listed.data[0]).toMatchObject({ id: s.id, isLate: false });
      await query(`UPDATE shipment_status_events SET "occurredAt"='2026-01-01T01:00:00.001Z' WHERE action='DELIVERED'`);
      expect((await (await get(`/shipments/${s.id}`)).json()).isLate).toBe(true);
    });

    it('đơn đang xử lý chưa có hạn giao trả null, quá hạn trả giao trễ', async () => {
      const s = await create(); expect(s.isLate).toBeNull();
      await query(`UPDATE shipments SET "expectedDeliveryAt"=clock_timestamp()-interval '1 second' WHERE id=$1`, [s.id]);
      expect((await (await get(`/shipments/${s.id}`)).json()).isLate).toBe(true);
      await query(`UPDATE shipments SET "expectedDeliveryAt"=clock_timestamp()+interval '1 hour' WHERE id=$1`, [s.id]);
      expect((await (await get(`/shipments/${s.id}`)).json()).isLate).toBe(false);
    });

    it.each([{}, [], null, { driverId: id(3), role: 'ADMIN' }, { driverId: 'bad' }, { driverId: id(3), customerId: id(2) }])(
      'từ chối nội dung phân công sai %j và không ghi dữ liệu', async body => {
        const s = await create(); expect((await assign(s.id, id(3), 'admin', body)).status).toBe(400);
        expect(await effects()).toEqual({ events: 0, notifications: 0 });
      });

    it.each(['?limit=0', '?limit=101', '?limit=1.5', '?limit=1&limit=2', '?status=BAD', '?status=CREATED&status=ASSIGNED',
      '?trackingNumber=bad', '?cursor=garbage', '?cursor=e30', '?role=ADMIN', '?customerId=x'])(
      'từ chối tham số danh sách không hợp lệ %s', async query => expect((await get('/shipments' + query)).status).toBe(400));

    it('chặn mã đơn sai, tham số thừa và các action ngoài phạm vi', async () => {
      const s = await create();
      expect((await get('/shipments/not-an-id')).status).toBe(400);
      expect((await assign('not-an-id')).status).toBe(400);
      expect((await get(`/shipments/${s.id}?role=ADMIN`)).status).toBe(400);
      expect((await assign(s.id, id(3), 'admin', { driverId: id(3) }, '?retry=1')).status).toBe(400);
      expect((await fetch(`${base}/shipments/${s.id}/pickup`, { method: 'POST', headers: headers('driver1') })).status).toBe(404);
    });

    it('frontend hiện có đọc được response thật của API danh sách, chi tiết và phân công', async () => {
      const { getShipments, getShipmentById, assignShipment } = await import(resolve(process.cwd(), '../web/src/api/endpoints/shipments.ts'));
      const { setTokenReader } = await import(resolve(process.cwd(), '../web/src/features/auth/session.ts'));
      const s = await create(); vi.stubEnv('VITE_API_URL', base); setTokenReader(async () => 'admin');
      try {
        expect((await getShipments()).data[0].id).toBe(s.id);
        expect((await assignShipment(s.id, id(3))).status).toBe('ASSIGNED');
        expect((await getShipmentById(s.id)).statusHistory).toHaveLength(2);
      } finally { setTokenReader(null); vi.unstubAllEnvs(); }
    });

    it('nhiều request cùng gán một tài xế chỉ tạo một sự kiện và một thông báo', async () => {
      const s = await create();
      const responses = await Promise.all(Array.from({ length: 5 }, () => assign(s.id)));
      expect(responses.map(r => r.status)).toEqual([200, 200, 200, 200, 200]);
      expect(await effects()).toEqual({ events: 1, notifications: 1 });
    });

    it.skipIf(mode !== 'postgres')('quan sát connection thứ hai chờ khóa đơn rồi gán lại theo đúng thứ tự', async () => {
      const s = await create();
      let reached!: () => void; let release!: () => void;
      const arrived = new Promise<void>(r => { reached = r; });
      blockWrite = { reached, gate: new Promise<void>(r => { release = r; }) };
      const first = assign(s.id); let second: Promise<Response> | undefined;
      try {
        await Promise.race([arrived, first.then(() => { throw new Error('Lần gán đầu chưa tới điểm giữ giao dịch để kiểm tra khóa'); })]);
        second = assign(s.id, id(4), 'admin2');
        const until = Date.now() + 2500; let waiting = 0;
        do {
          waiting = (await query<{ count: number }>(`SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE OF s%'`)).rows[0].count;
          if (!waiting) await new Promise(r => setTimeout(r, 20));
        } while (!waiting && Date.now() < until);
        expect(waiting).toBeGreaterThan(0); expect(pool!.totalCount).toBeGreaterThanOrEqual(2);
      } finally { release(); }
      const responses = await Promise.all([first, second!]); expect(responses.map(r => r.status)).toEqual([200, 200]);
      const detail = await (await get(`/shipments/${s.id}`)).json();
      expect(detail.driverId).toBe(id(4));
      expect(detail.statusHistory.map((e: { action: string }) => e.action)).toEqual(['CREATED', 'ASSIGNED', 'REASSIGNED']);
      expect(detail.statusHistory[2]).toMatchObject({ previousDriverId: id(3), newDriverId: id(4) });
    });
  });
}
