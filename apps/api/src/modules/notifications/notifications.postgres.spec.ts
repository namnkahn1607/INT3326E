import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module';
import { configureApp } from '../../config/app.config';
import { UserRole } from '../auth/enums/user-role.enum';
import { FIREBASE_AUTH } from '../auth/providers/firebase-auth.provider';
import { USER_DATABASE } from '../users/user-database.provider';

const connectionString = process.env.TV6_ADMIN_TEST_DATABASE_URL;
const C1 = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAV';
const C2 = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAW';
const ADMIN = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX';
const S1 = 'sh_01ARZ3NDEKTSV4RRFFQ69G5FAV';
const S2 = 'sh_01ARZ3NDEKTSV4RRFFQ69G5FAW';

describe.skipIf(!connectionString)('Notifications PostgreSQL integration (mock Firebase)', () => {
  let pool: Pool;
  let app: INestApplication;
  let base: string;
  let identity = { uid: 'fb-c1', role: UserRole.CUSTOMER };
  const schema = `notif_test_${randomUUID().replaceAll('-', '')}`;
  const headers = { Authorization: 'Bearer test-token' };
  const ids: string[] = [];
  const get = async (suffix = '') => (await fetch(`${base}/notifications${suffix}`, { headers }));

  beforeAll(async () => {
    const target = new URL(connectionString!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/parcelflow_admin_test') {
      throw new Error('Use a disposable loopback database named parcelflow_admin_test');
    }
    pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
    pool.on('connect', (client) => { void client.query(`SET search_path TO "${schema}"`); });
    await pool.query(`CREATE SCHEMA "${schema}"`);
    // Test fixture only: the baseline SQL file, applied to a throw-away schema.
    await pool.query(readFileSync('../../packages/database/sql/001-create-shipment.sql', 'utf8'));
    const user = (id: string, uid: string, role: string) => pool.query(
      'INSERT INTO users (id,"firebaseUid",email,name,role) VALUES ($1,$2,$3,$4,$5)', [id, uid, `${uid}@x.vn`, uid, role]);
    await user(C1, 'fb-c1', 'CUSTOMER'); await user(C2, 'fb-c2', 'CUSTOMER'); await user(ADMIN, 'fb-admin', 'ADMIN');
    const shipment = (id: string, code: string, sender: string) => pool.query(
      `INSERT INTO shipments (id,"trackingCode","senderId",status,"pickupAddress","pickupLat","pickupLng","deliveryAddress",
        "deliveryLat","deliveryLng","recipientName","recipientPhone","createdAt","updatedAt")
       VALUES ($1,$2,$3,'CREATED','144 Xuan Thuy',21,105.7,'1 Dai Co Viet',21,105.8,'Nguoi nhan','+84900000000',now(),now())`,
      [id, code, sender]);
    await shipment(S1, 'PF20261107AAAAAA', C1); await shipment(S2, 'PF20261107BBBBBB', C2);
    // C1: five notifications; three share one millisecond so only id breaks the tie. C2: one.
    const add = async (customer: string, ship: string, at: string, kind: string) => {
      const event = randomUUID(); const note = randomUUID();
      await pool.query(`INSERT INTO shipment_status_events (id,"shipmentId",action,"fromStatus","toStatus","actorUserId","actorRole","occurredAt")
        VALUES ($1,$2,'CREATED',NULL,'CREATED',$3,'CUSTOMER',$4)`, [event, ship, customer, at]);
      await pool.query(`INSERT INTO notifications (id,"customerId","shipmentId","statusEventId",kind,title,body,"createdAt")
        VALUES ($1,$2,$3,$4,$5,'Tiêu đề','Nội dung',$6)`, [note, customer, ship, event, kind, at]);
      return note;
    };
    for (const [at, kind] of [['2026-11-07T01:00:00.100Z', 'CREATED'], ['2026-11-07T01:00:00.200Z', 'ASSIGNED'],
      ['2026-11-07T01:00:00.300Z', 'REASSIGNED'], ['2026-11-07T01:00:00.300Z', 'ASSIGNED'], ['2026-11-07T01:00:00.300Z', 'REASSIGNED']] as const) {
      ids.push(await add(C1, S1, at, kind));
    }
    await add(C2, S2, '2026-11-07T01:00:00.400Z', 'CREATED');

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FIREBASE_AUTH).useValue({
        verifyIdToken: vi.fn(async () => ({ uid: identity.uid, role: identity.role })),
        getUser: vi.fn(async () => ({ disabled: false, customClaims: { role: identity.role } })),
      })
      .overrideProvider(USER_DATABASE).useValue(pool).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/v1`;
  });

  afterAll(async () => {
    await app?.close().catch(() => undefined);
    await new Pool({ connectionString, max: 1 }).query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
  });

  it('returns only the caller\'s notifications with the joined tracking number, newest first', async () => {
    const body = await (await get()).json();
    expect(body.data).toHaveLength(5);
    expect(body.data.every((n: { shipmentId: string; trackingNumber: string }) =>
      n.shipmentId === S1 && n.trackingNumber === 'PF20261107AAAAAA')).toBe(true);
    const times = body.data.map((n: { createdAt: string }) => n.createdAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(body.pagination).toEqual({ limit: 20, hasMore: false, nextCursor: null });
  });

  it('does not leak another Customer\'s rows and gives that Customer a separate list', async () => {
    identity = { uid: 'fb-c2', role: UserRole.CUSTOMER };
    try {
      const body = await (await get()).json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].trackingNumber).toBe('PF20261107BBBBBB');
    } finally { identity = { uid: 'fb-c1', role: UserRole.CUSTOMER }; }
  });

  it('pages through equal timestamps without repeating or skipping a row', async () => {
    const seen: string[] = [];
    let suffix = '?limit=2';
    for (let page = 0; page < 5; page++) {
      const body = await (await get(suffix)).json();
      seen.push(...body.data.map((n: { id: string }) => n.id));
      if (!body.pagination.hasMore) break;
      suffix = `?limit=2&cursor=${body.pagination.nextCursor}`;
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    expect([...seen].sort()).toEqual([...ids].sort());
  });

  it('rejects a cursor taken from another Customer', async () => {
    const own = (await (await get('?limit=1')).json()).pagination.nextCursor;
    expect(own).toBeTruthy();
    identity = { uid: 'fb-c2', role: UserRole.CUSTOMER };
    try { expect((await get(`?cursor=${own}`)).status).toBe(400); } finally { identity = { uid: 'fb-c1', role: UserRole.CUSTOMER }; }
  });

  it('keeps stored rows readable after a read failure (503 then recovery)', async () => {
    await pool.query('ALTER TABLE notifications RENAME COLUMN title TO old_title');
    try {
      const failed = await get();
      expect(failed.status).toBe(503);
      expect(await failed.text()).not.toMatch(/old_title|SELECT|FROM/);
    } finally { await pool.query('ALTER TABLE notifications RENAME COLUMN old_title TO title'); }
    expect((await (await get()).json()).data).toHaveLength(5);
  });
});
