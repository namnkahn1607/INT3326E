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
import { SHIPMENT_IDEMPOTENCY_TTL } from './shipments.service';
import * as identifiers from './shipment-identifiers';

const nativeUrl = process.env.SHIPMENT_TEST_DATABASE_URL;
const customerId = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAV';
const driverId = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAW';
const otherId = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX';
const payload = () => ({ pickupAddress: '144 Xuan Thuy', pickupLocation: { lat: 21.0378, lng: 105.7829 },
  dropoffAddress: '1 Dai Co Viet', dropoffLocation: { lat: 21.0061, lng: 105.8431 },
  recipientName: 'Nguoi nhan demo', recipientPhone: '+84900000000' });

// Both backends execute the production repository SQL. PGlite serializes transactions; only native PG proves row-lock races.
for (const mode of ['pglite', 'postgres'] as const) {
  describe.skipIf(mode === 'postgres' && !nativeUrl)(`Create HTTP + SQL (${mode}, Firebase mock)`, () => {
    let app: INestApplication;
    let base: string;
    let engine: PGlite | undefined;
    let pool: Pool | undefined;
    const schema = `shipment_test_${randomUUID().replaceAll('-', '')}`;
    let identity = { uid: 'firebase-customer', role: 'CUSTOMER' };
    let failWrite: string | null = null;
    let loseCommitResponse = false;
    let statementCount = 0;
    let clockAdvanceMs = 0;
    let blockEvent: { reached: () => void; gate: Promise<void> } | null = null;
    const query = async <T extends QueryResultRow = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> => {
      if (engine) return engine.query<T>(sql, params);
      return pool!.query<T>(sql, params);
    };
    const counts = async () => (await query<{ shipments: number; events: number; notifications: number; keys: number }>(`
      SELECT (SELECT count(*)::int FROM shipments) AS shipments,
      (SELECT count(*)::int FROM shipment_status_events) AS events,
      (SELECT count(*)::int FROM notifications) AS notifications,
      (SELECT count(*)::int FROM idempotency_requests) AS keys`)).rows[0];

    beforeAll(async () => {
      let adapter: object;
      if (mode === 'pglite') {
        engine = new PGlite();
        let tail = Promise.resolve();
        adapter = {
          query: (sql: string, values: unknown[]) => query(sql, values), end: () => Promise.resolve(),
          connect: async () => {
            const previous = tail;
            let unlock!: () => void;
            tail = new Promise<void>(r => { unlock = r; });
            await previous;
            return { query: interceptedQuery, release: () => unlock() };
          },
        };
      } else {
        const target = new URL(nativeUrl!);
        if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/parcelflow_shipments_test' ||
          [...target.searchParams.keys()].some(key => key !== 'sslmode')) {
          throw new Error('Use a disposable loopback database named parcelflow_shipments_test without connection overrides');
        }
        pool = new Pool({ connectionString: nativeUrl, max: 6, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
        await pool.query(`CREATE SCHEMA "${schema}"`);
        await pool.end();
        pool = new Pool({ connectionString: nativeUrl, max: 6, connectionTimeoutMillis: 5000, statement_timeout: 5000,
          options: `-c search_path=${schema}` });
        adapter = {
          query: (sql: string, values: unknown[]) => query(sql, values), end: () => Promise.resolve(),
          connect: async () => {
            const client = await pool!.connect();
            return { query: (sql: string, values: unknown[]) => interceptedQuery(sql, values, client),
              release: (error?: Error) => client.release(error) };
          },
        };
      }
      const sql = await readFile(resolve(process.cwd(), '../../packages/database/sql/001-create-shipment.sql'), 'utf8');
      if (engine) await engine.exec(sql);
      else await pool!.query(sql);
      for (const [id, uid, role] of [[customerId, 'firebase-customer', 'CUSTOMER'], [otherId, 'firebase-other', 'CUSTOMER'],
        [driverId, 'firebase-driver', 'DRIVER']]) {
        await query('INSERT INTO users (id,"firebaseUid",email,name,role) VALUES ($1,$2,$3,$4,$5)',
          [id, uid, `${uid}@example.com`, role, role]);
      }
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(FIREBASE_AUTH).useValue({
          verifyIdToken: vi.fn().mockImplementation(async () => identity),
          getUser: vi.fn().mockImplementation(async () => ({ disabled: false, customClaims: { role: identity.role } })),
        })
        .overrideProvider(USER_DATABASE).useValue(adapter)
        .overrideProvider(SHIPMENT_IDEMPOTENCY_TTL).useValue(86400).compile();
      app = module.createNestApplication();
      configureApp(app);
      await app.listen(0, '127.0.0.1');
      base = `${await app.getUrl()}/v1/shipments`;
    }, 30_000);

    async function interceptedQuery(sql: string, params: unknown[] = [], client?: PoolClient) {
      statementCount++;
      if (blockEvent && sql.includes('INSERT INTO shipment_status_events')) {
        const barrier = blockEvent;
        blockEvent = null;
        barrier.reached();
        await barrier.gate;
      }
      if (failWrite && sql.includes(failWrite)) throw new Error('private SQL dependency secret');
      const result = client ? await client.query(sql, params) : await query(sql, params);
      if (sql === 'SELECT clock_timestamp() AS now' && clockAdvanceMs) {
        return { rows: [{ now: new Date(new Date(result.rows[0].now as string).getTime() + clockAdvanceMs) }] };
      }
      if (sql === 'COMMIT' && loseCommitResponse) { loseCommitResponse = false; throw new Error('lost commit response'); }
      return result;
    }

    beforeEach(async () => {
      identity = { uid: 'firebase-customer', role: 'CUSTOMER' };
      failWrite = null; loseCommitResponse = false; statementCount = 0; clockAdvanceMs = 0;
      blockEvent = null;
      await query('DELETE FROM idempotency_requests');
      await query('DELETE FROM notifications');
      await query('DELETE FROM shipment_status_events');
      await query('DELETE FROM shipments');
    });
    afterAll(async () => {
      await app?.close();
      await engine?.close();
      if (pool) {
        try { await pool.query(`DROP SCHEMA "${schema}" CASCADE`); }
        finally { await pool.end(); }
      }
    });
    const send = (body: unknown = payload(), key: string | null = randomUUID(), token = true, path = '') => fetch(base + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer test-token' } : {}),
        ...(key === null ? {} : { 'Idempotency-Key': key }) }, body: JSON.stringify(body),
    });

    it('TC01.1: commits one set of rows with exact SC02 mapping and trusted actor', async () => {
      const response = await send();
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toEqual({ ...payload(), id: expect.stringMatching(/^sh_[0-7][0-9A-HJKMNP-TV-Z]{25}$/),
        trackingNumber: expect.stringMatching(/^PF\d{8}[0-9A-HJKMNP-TV-Z]{6}$/), customerId, status: 'CREATED',
        driverId: null, notes: null, packageDescription: null, packageWeightKg: null,
        expectedDeliveryAt: null, isLate: null, failureReason: null, failedByRole: null, failedByUserId: null,
        proofOfDeliveryNotes: null, createdAt: expect.stringMatching(/\.\d{3}Z$/), updatedAt: expect.any(String) });
      expect(body.updatedAt).toBe(body.createdAt);
      const openapi = JSON.parse(await readFile(resolve(process.cwd(), '../../docs/openapi.json'), 'utf8'));
      expect(Object.keys(body).sort()).toEqual([...openapi.components.schemas.ShipmentResponse.required].sort());
      expect(openapi.components.schemas.ShipmentResponse.additionalProperties).toBe(false);
      expect(await counts()).toEqual({ shipments: 1, events: 1, notifications: 1, keys: 1 });
      const row = (await query('SELECT * FROM shipments')).rows[0];
      expect(row).toMatchObject({ senderId: customerId, trackingCode: body.trackingNumber,
        deliveryAddress: body.dropoffAddress, deliveryLat: body.dropoffLocation.lat });
      expect((await query('SELECT * FROM shipment_status_events')).rows[0]).toMatchObject({
        shipmentId: body.id, action: 'CREATED', fromStatus: null, toStatus: 'CREATED', actorUserId: customerId,
        actorRole: 'CUSTOMER', previousDriverId: null, newDriverId: null, reason: null });
      const notification = (await query('SELECT * FROM notifications')).rows[0];
      expect(notification).toMatchObject({ customerId, shipmentId: body.id, kind: 'CREATED' });
      expect(String(notification.body)).not.toContain(body.recipientPhone);
    });

    it('persists every optional field with trimmed text and millisecond-truncated timestamp', async () => {
      const timestamp = new Date(Date.now() + 3600_000).toISOString().slice(0, 19) + '.123999Z';
      const response = await send({ ...payload(), notes: ' Ghi chu ', packageDescription: ' Mo ta ',
        packageWeightKg: 1.5, expectedDeliveryAt: timestamp });
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toMatchObject({ notes: 'Ghi chu', packageDescription: 'Mo ta', packageWeightKg: 1.5,
        expectedDeliveryAt: timestamp.replace('.123999Z', '.123Z'), isLate: false });
      const row = (await query('SELECT * FROM shipments')).rows[0];
      expect(row).toMatchObject({ notes: 'Ghi chu', packageDescription: 'Mo ta', packageWeightKg: 1.5 });
      expect(new Date(row.expectedDeliveryAt as string).toISOString()).toBe(body.expectedDeliveryAt);
    });

    it('TC01.2: identical and concurrent retries return original201 and do not duplicate rows', async () => {
      const key = randomUUID();
      const responses = await Promise.all(Array.from({ length: 6 }, () => send(payload(), key)));
      expect(responses.map(r => r.status)).toEqual(Array(6).fill(201));
      const bodies = await Promise.all(responses.map(r => r.json()));
      for (const body of bodies) expect(body).toEqual(bodies[0]);
      expect(await counts()).toEqual({ shipments: 1, events: 1, notifications: 1, keys: 1 });
    });

    it.skipIf(mode !== 'postgres')('observes a competing native connection waiting on the idempotency row lock', async () => {
      let reached!: () => void;
      let release!: () => void;
      const arrived = new Promise<void>(r => { reached = r; });
      const gate = new Promise<void>(r => { release = r; });
      blockEvent = { reached, gate };
      const key = randomUUID();
      const first = send(payload(), key);
      let second: Promise<Response> | undefined;
      try {
        await Promise.race([arrived, first.then(() => { throw new Error('First transaction did not reach the lock barrier'); })]);
        second = send(payload(), key);
        const until = Date.now() + 2000;
        let waiting = 0;
        do {
          waiting = (await query<{ count: number }>(`SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname=current_database() AND wait_event_type='Lock'
            AND query LIKE '%INSERT INTO idempotency_requests%'`)).rows[0].count;
          if (!waiting) await new Promise(r => setTimeout(r, 20));
        } while (!waiting && Date.now() < until);
        expect(waiting).toBeGreaterThan(0);
        expect(pool!.totalCount).toBeGreaterThanOrEqual(2);
      } finally { release(); }
      const responses = await Promise.all([first, second!]);
      expect(responses.map(r => r.status)).toEqual([201, 201]);
      const bodies = await Promise.all(responses.map(r => r.json()));
      expect(bodies[1]).toEqual(bodies[0]);
      expect(await counts()).toEqual({ shipments: 1, events: 1, notifications: 1, keys: 1 });
    });

    it('existing frontend Create client accepts the real HTTP response and replay without adapters', async () => {
      const frontendClientPath = resolve(process.cwd(), '../web/src/api/endpoints/shipments.ts');
      const frontendSessionPath = resolve(process.cwd(), '../web/src/features/auth/session.ts');
      const { createShipment } = await import(frontendClientPath);
      const { setTokenReader } = await import(frontendSessionPath);
      vi.stubEnv('VITE_API_URL', base.replace(/\/shipments$/, ''));
      setTokenReader(async () => 'test-token');
      try {
        const key = randomUUID();
        const first = await createShipment(payload(), key);
        expect(first).toMatchObject({ customerId, status: 'CREATED', driverId: null });
        expect(await createShipment(payload(), key)).toEqual(first);
        expect((await counts()).shipments).toBe(1);
      } finally {
        setTokenReader(async () => null);
        vi.unstubAllEnvs();
      }
    });

    it('TC01.3: changed normalized payload conflicts without changing the committed rows', async () => {
      const key = randomUUID();
      await send(payload(), key);
      const result = await send({ ...payload(), notes: 'Changed' }, key);
      expect(result.status).toBe(409);
      expect(await result.json()).toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT', status: 409 });
      expect(await counts()).toEqual({ shipments: 1, events: 1, notifications: 1, keys: 1 });
    });

    it('competing different payloads using one key have exactly one winner', async () => {
      const key = randomUUID();
      const responses = await Promise.all([send(payload(), key), send({ ...payload(), notes: 'Other intent' }, key)]);
      expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
      expect(await counts()).toEqual({ shipments: 1, events: 1, notifications: 1, keys: 1 });
    });

    it('tracking collision retries the shipment insert without duplicate event/notification', async () => {
      const first = await (await send()).json();
      const generate = identifiers.shipmentIdentifiers;
      const spy = vi.spyOn(identifiers, 'shipmentIdentifiers').mockImplementationOnce(now => ({
        ...generate(now), trackingNumber: first.trackingNumber,
      }));
      try {
        const response = await send();
        expect(response.status).toBe(201);
        expect((await response.json()).trackingNumber).not.toBe(first.trackingNumber);
        expect(spy).toHaveBeenCalledTimes(2);
        expect(await counts()).toEqual({ shipments: 2, events: 2, notifications: 2, keys: 2 });
      } finally { spy.mockRestore(); }
    });

    it('normalization treats reordered fields, optional nulls, spaces and equivalent offsets identically', async () => {
      const key = randomUUID();
      const time = new Date(Date.now() + 3600_000).toISOString();
      const body = { ...payload(), expectedDeliveryAt: time, notes: ' Demo ' };
      const first = await send(body, key);
      const reordered = Object.fromEntries(Object.entries({ ...body, pickupAddress: ' 144 Xuan Thuy ',
        notes: 'Demo', packageDescription: null, expectedDeliveryAt: time.replace('Z', '+00:00') }).reverse());
      const second = await send(reordered, key.toUpperCase());
      expect([first.status, second.status]).toEqual([201, 201]);
      expect(await second.json()).toEqual(await first.json());
    });

    it('TC01.6: replay preserves CREATED snapshot after assign and a past deadline', async () => {
      const key = randomUUID();
      const body = { ...payload(), expectedDeliveryAt: new Date(Date.now() + 60_000).toISOString() };
      const first = await send(body, key);
      const snapshot = await first.json();
      expect(snapshot.isLate).toBe(false);
      await query('UPDATE shipments SET status=\'ASSIGNED\',"driverId"=$1 WHERE id=$2', [driverId, snapshot.id]);
      // Advance only the repository clock; the24h key remains live but the deadline has passed.
      clockAdvanceMs = 120_000;
      const replay = await send(body, key);
      expect(replay.status).toBe(201);
      expect(await replay.json()).toEqual(snapshot);
      expect((await send(body, randomUUID())).status).toBe(400);
      expect((await query('SELECT status,"driverId" FROM shipments')).rows[0]).toEqual({ status: 'ASSIGNED', driverId });
    });

    it('expired keys permit a new create and use a renewed configured24h window', async () => {
      const key = randomUUID();
      const first = await (await send(payload(), key)).json();
      await query(`UPDATE idempotency_requests SET "createdAt"=clock_timestamp()-interval '25 hours',
        "expiresAt"=clock_timestamp()-interval '1 hour'`);
      const responses = await Promise.all(Array.from({ length: 3 }, () => send({ ...payload(), notes: 'New intent' }, key)));
      expect(responses.map(r => r.status)).toEqual([201, 201, 201]);
      const snapshots = await Promise.all(responses.map(r => r.json()));
      expect(snapshots[0].id).not.toBe(first.id);
      for (const snapshot of snapshots) expect(snapshot).toEqual(snapshots[0]);
      expect(await counts()).toEqual({ shipments: 2, events: 2, notifications: 2, keys: 1 });
      const ttl = (await query<{ ttl: number }>(`SELECT extract(epoch FROM ("expiresAt"-"createdAt"))::int AS ttl FROM idempotency_requests`)).rows[0].ttl;
      expect(ttl).toBe(86400);
    });

    it('key scope is per business Customer', async () => {
      const key = randomUUID();
      const first = await (await send(payload(), key)).json();
      identity = { uid: 'firebase-other', role: 'CUSTOMER' };
      const response = await send(payload(), key);
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ customerId: otherId, id: expect.not.stringMatching(first.id) });
      expect((await counts()).keys).toBe(2);
    });

    it.each([null, 'bad', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'])('TC01.4: invalid/missing key %s', async key => {
      const result = await send(payload(), key);
      expect(result.status).toBe(400);
      expect(await result.json()).toMatchObject({ code: 'IDEMPOTENCY_KEY_MISSING' });
      expect((await counts()).shipments).toBe(0);
    });

    it.each([
      { ...payload(), customerId: 'forged' }, { ...payload(), role: 'ADMIN' },
      { ...payload(), pickupLocation: { lat: 91, lng: 1 } },
      { ...payload(), expectedDeliveryAt: '2020-01-01T00:00:00Z' },
      { ...payload(), packageWeightKg: 0 }, { ...payload(), recipientPhone: 'abc' },
    ])('TC01.4: invalid payload leaves no writes %#', async body => {
      const result = await send(body);
      expect(result.status).toBe(400);
      expect(result.headers.get('content-type')).toContain('application/problem+json');
      expect(await result.json()).toMatchObject({ code: 'VALIDATION_ERROR', errors: [{ field: expect.any(String), message: expect.any(String) }] });
      expect(await counts()).toEqual({ shipments: 0, events: 0, notifications: 0, keys: 0 });
    });

    it('rejects unknown query fields', async () => { expect((await send(payload(), randomUUID(), true, '?customerId=forged')).status).toBe(400); });

    it.each(['INSERT INTO shipment_status_events', 'INSERT INTO notifications', 'SET "responseStatus"=201'])('TC01.5: rolls back %s failure then retries safely', async failure => {
      failWrite = failure;
      const key = randomUUID();
      const result = await send(payload(), key);
      expect(result.status).toBe(503);
      expect(await result.text()).not.toContain('private');
      expect(await counts()).toEqual({ shipments: 0, events: 0, notifications: 0, keys: 0 });
      failWrite = null;
      expect((await send(payload(), key)).status).toBe(201);
    });

    it('lost commit response is safely recoverable with the same key, without an internal create retry', async () => {
      loseCommitResponse = true;
      const key = randomUUID();
      expect((await send(payload(), key)).status).toBe(503);
      expect(await counts()).toEqual({ shipments: 1, events: 1, notifications: 1, keys: 1 });
      expect((await send(payload(), key)).status).toBe(201);
      expect((await counts()).shipments).toBe(1);
    });

    it('TC01.5: a real SQL constraint failure aborts and rolls back every write', async () => {
      await query(`ALTER TABLE notifications ADD CONSTRAINT inject_notification_failure CHECK (kind <> 'CREATED')`);
      const key = randomUUID();
      try {
        const result = await send(payload(), key);
        expect(result.status).toBe(503);
        expect(await result.text()).not.toContain('inject_notification_failure');
        expect(await counts()).toEqual({ shipments: 0, events: 0, notifications: 0, keys: 0 });
      } finally { await query('ALTER TABLE notifications DROP CONSTRAINT inject_notification_failure'); }
      expect((await send(payload(), key)).status).toBe(201);
    });

    it('checks auth/role/linkage before opening a mutation transaction', async () => {
      expect((await send(payload(), randomUUID(), false)).status).toBe(401);
      for (const role of ['DRIVER', 'ADMIN']) {
        identity = { uid: 'firebase-driver', role };
        expect((await send()).status).toBe(403);
      }
      identity = { uid: 'not-provisioned', role: 'CUSTOMER' };
      const result = await send();
      expect(result.status).toBe(409);
      expect(await result.json()).toMatchObject({ code: 'USER_NOT_PROVISIONED' });
      expect(statementCount).toBe(0);
    });
  });
}
