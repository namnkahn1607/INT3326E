import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
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
const id = (n: number) => `usr_${String(n).padStart(26, '0')}`;

describe.skipIf(!connectionString)('Admin directory PostgreSQL integration (mock Firebase)', () => {
  let pool: Pool;
  let app: INestApplication;
  let base: string;
  const schema = `admin_test_${randomUUID().replaceAll('-', '')}`;
  const headers = { Authorization: 'Bearer test-admin-token' };

  beforeAll(async () => {
    const target = new URL(connectionString!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
        target.pathname !== '/parcelflow_admin_test') {
      throw new Error('Use a disposable loopback database named parcelflow_admin_test');
    }
    pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
    await pool.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
    // Test fixture only: this does not replace TV1/TV2 migrations or initialize the application DB.
    await pool.query(`
      CREATE TABLE users (
        id text PRIMARY KEY, "firebaseUid" text UNIQUE NOT NULL, name text NOT NULL,
        email text UNIQUE NOT NULL, phone text, role text NOT NULL,
        "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE shipments (id text PRIMARY KEY, "driverId" text REFERENCES users(id), status text NOT NULL);
      CREATE TABLE current_locations (
        "driverId" text PRIMARY KEY REFERENCES users(id), lat double precision NOT NULL,
        lng double precision NOT NULL, "clientTimestamp" timestamptz(3) NOT NULL, "receivedAt" timestamptz(3) NOT NULL
      );
    `);
    const seed = async (n: number, role: UserRole, createdAt: string) => pool.query(
      'INSERT INTO users (id, "firebaseUid", name, email, role, "createdAt") VALUES ($1,$2,$3,$4,$5,$6)',
      [id(n), `firebase-${n}`, `${role} ${n}`, `user${n}@example.com`, role, createdAt],
    );
    await seed(1, UserRole.ADMIN, '2026-10-23T00:00:00Z');
    await seed(2, UserRole.CUSTOMER, '2026-10-23T00:00:00Z');
    await seed(3, UserRole.CUSTOMER, '2026-10-22T00:00:00Z');
    for (const [n, time] of [
      [105, '2026-10-23T00:00:00.123456Z'], [104, '2026-10-23T00:00:00.123455Z'],
      [103, '2026-10-23T00:00:00.123455Z'], [102, '2026-10-22T00:00:00Z'], [101, '2026-10-21T00:00:00Z'],
    ] as const) await seed(n, UserRole.DRIVER, time);
    for (const [n, statuses] of [
      [105, ['ASSIGNED', 'PICKED_UP', 'DELIVERED', 'DELIVERY_FAILED']],
      [104, ['DELIVERED']], [103, ['PICKED_UP']], [102, ['ASSIGNED']],
    ] as const) {
      for (const status of statuses) await pool.query('INSERT INTO shipments VALUES ($1,$2,$3)',
        [`shipment-${n}-${status}`, id(n), status]);
    }
    await pool.query(`
      INSERT INTO current_locations VALUES
        ($1, 21.0285, 105.8542, statement_timestamp() - interval '5 seconds', statement_timestamp()),
        ($2, 20.5, 105.5, statement_timestamp() - interval '5 seconds', statement_timestamp()),
        ($3, 0, 0, statement_timestamp() - interval '31 seconds', statement_timestamp())
    `, [id(105), id(104), id(102)]);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FIREBASE_AUTH).useValue({
        verifyIdToken: vi.fn().mockResolvedValue({ uid: 'firebase-1', role: UserRole.ADMIN }),
        getUser: vi.fn().mockResolvedValue({ disabled: false, customClaims: { role: UserRole.ADMIN } }),
      })
      .overrideProvider(USER_DATABASE).useValue(pool).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/v1`;
  }, 20_000);

  afterAll(async () => {
    try { await pool?.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
    finally {
      if (app) await app.close();
      else await pool?.end();
    }
  });

  const read = async (path: string) => {
    const response = await fetch(`${base}${path}`, { headers });
    expect(response.status).toBe(200);
    return response.json();
  };

  it('filters roles in SQL and counts only the two active shipment states without duplicate drivers', async () => {
    const body = await read('/drivers');
    expect(body.data.map((row: { id: string }) => row.id)).toEqual([105, 104, 103, 102, 101].map(id));
    expect(body.data.map((row: { activeShipmentCount: number }) => row.activeShipmentCount)).toEqual([2, 0, 1, 1, 0]);
  });

  it('hides coordinates and timestamps for a driver who has only terminal shipments', async () => {
    const body = await read('/drivers');
    expect(body.data[1]).toEqual({ id: id(104), name: 'DRIVER 104', activeShipmentCount: 0,
      currentLocation: null, lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null });
  });

  it('distinguishes missing GPS from a valid stale sample at coordinates 0,0', async () => {
    const body = await read('/drivers');
    expect(body.data[2]).toMatchObject({ activeShipmentCount: 1, currentLocation: null,
      lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null });
    expect(body.data[3]).toMatchObject({ activeShipmentCount: 1, currentLocation: { lat: 0, lng: 0 }, isLocationStale: true });
    expect(body.data[0]).toMatchObject({ activeShipmentCount: 2, currentLocation: { lat: 21.0285, lng: 105.8542 },
      isLocationStale: false, lastLocationUpdatedAt: expect.stringMatching(/\.\d{3}Z$/),
      locationClientTimestamp: expect.stringMatching(/\.\d{3}Z$/) });
  });

  it('paginates equal timestamps and microsecond differences without omissions or duplicate IDs', async () => {
    const seen: string[] = [];
    let next: string | null = null;
    do {
      const body = await read(`/drivers?limit=1${next ? `&cursor=${next}` : ''}`);
      seen.push(...body.data.map((row: { id: string }) => row.id));
      next = body.pagination.nextCursor;
      expect(body.pagination.hasMore).toBe(next !== null);
      expect(seen.length).toBeLessThanOrEqual(5);
    } while (next);
    expect(seen).toEqual([105, 104, 103, 102, 101].map(id));
  });

  it('returns only paginated Customer summaries and preserves a null phone', async () => {
    const first = await read('/admin/customers?limit=1');
    expect(first.data).toEqual([{ id: id(2), name: 'CUSTOMER 2', email: 'user2@example.com', phone: null }]);
    expect(first.pagination.hasMore).toBe(true);
    const second = await read(`/admin/customers?limit=1&cursor=${first.pagination.nextCursor}`);
    expect(second.data.map((row: { id: string }) => row.id)).toEqual([id(3)]);
    expect(second.pagination).toEqual({ limit: 1, hasMore: false, nextCursor: null });
  });

  it('uses one listing statement after the actor lookup rather than a query per driver', async () => {
    const spy = vi.spyOn(pool, 'query');
    try {
      await read('/drivers');
      expect(spy).toHaveBeenCalledTimes(2);
      expect(String(spy.mock.calls[1][0])).toContain('WITH page AS');
    } finally { spy.mockRestore(); }
  });

  it('returns 503 for a missing GPS contract column instead of fabricated counts or locations', async () => {
    await pool.query('ALTER TABLE current_locations RENAME COLUMN "clientTimestamp" TO old_timestamp');
    try {
      const response = await fetch(`${base}/drivers`, { headers });
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
      expect((await read('/admin/customers')).data).toHaveLength(2);
    } finally { await pool.query('ALTER TABLE current_locations RENAME COLUMN old_timestamp TO "clientTimestamp"'); }
  });
});
