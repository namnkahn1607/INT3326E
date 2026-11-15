import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GpsWriterRepository } from './gps-writer.repository';
import { NormalizedGpsEvent } from '../consumer/gps-processor.service';

// Chạy với PostgreSQL thật khi có WORKER_TEST_DATABASE_URL; mỗi lượt dùng schema riêng rồi xóa.
const connectionString = process.env.WORKER_TEST_DATABASE_URL;
const driverId = `usr_${'1'.padStart(26, '0')}`;
const base = Date.UTC(2026, 10, 12, 3, 0, 0);

const event = (overrides: Partial<NormalizedGpsEvent> = {}): NormalizedGpsEvent => {
  const lat = overrides.lat ?? 21.0285;
  const lng = overrides.lng ?? 105.8542;
  const clientTimestamp = overrides.clientTimestamp ?? base;
  const receivedAtMs = overrides.receivedAtMs ?? clientTimestamp + 500;
  return {
    eventId: randomUUID(),
    driverId,
    latitude: lat,
    longitude: lng,
    lat,
    lng,
    clientTimestamp,
    clientTimestampIso: new Date(clientTimestamp).toISOString(),
    receivedAt: new Date(receivedAtMs).toISOString(),
    receivedAtMs,
    ...overrides,
  };
};

describe.skipIf(!connectionString)('GpsWriterRepository trên PostgreSQL (DATA04/05)', () => {
  const schema = `worker_test_${randomUUID().replaceAll('-', '')}`;
  let admin: Pool;
  let db: Pool;
  let repository: GpsWriterRepository;
  const previousUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    const target = new URL(connectionString!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
        target.pathname !== '/parcelflow_worker_test') {
      throw new Error('Use a disposable loopback database named parcelflow_worker_test');
    }
    admin = new Pool({ connectionString, max: 1 });
    await admin.query(`CREATE SCHEMA "${schema}"`);

    target.searchParams.set('options', `-c search_path=${schema}`);
    db = new Pool({ connectionString: target.toString(), max: 1 });
    const sqlDir = resolve(process.cwd(), 'packages/database/sql');
    await db.query(readFileSync(resolve(sqlDir, '001-create-shipment.sql'), 'utf8'));
    await db.query(readFileSync(resolve(sqlDir, '002-create-gps-locations.sql'), 'utf8'));
    await db.query(
      `INSERT INTO users (id, "firebaseUid", email, name, role) VALUES ($1, 'fb-driver', 'driver@test.local', 'Driver', 'DRIVER')`,
      [driverId],
    );

    process.env.DATABASE_URL = target.toString();
    repository = new GpsWriterRepository();
  });

  afterAll(async () => {
    process.env.DATABASE_URL = previousUrl;
    await (repository as unknown as { pool?: Pool }).pool?.end();
    await db?.end();
    await admin?.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin?.end();
  });

  const history = async () =>
    (await db.query(`SELECT "eventId", lat FROM location_history WHERE "driverId" = $1 ORDER BY "clientTimestamp"`, [driverId])).rows;
  const current = async () =>
    (await db.query(`SELECT "eventId", "clientTimestamp" FROM current_locations WHERE "driverId" = $1`, [driverId])).rows[0];

  it('ghi mẫu mới vào cả history và current với cùng eventId', async () => {
    const first = event();
    const result = await repository.recordGpsEvent(first);

    expect(result).toMatchObject({ historyInserted: true, currentUpdated: true });
    expect(await history()).toEqual([{ eventId: first.eventId, lat: first.lat }]);
    expect((await current()).eventId).toBe(first.eventId);
  });

  it('mẫu trùng khóa giữ bản đầu tiên, không ghi đè history hay current', async () => {
    const [kept] = await history();
    const duplicate = event({ lat: 10.5 });
    const result = await repository.recordGpsEvent(duplicate);

    expect(result).toMatchObject({ historyInserted: false, currentUpdated: false, conflict: true });
    expect(await history()).toEqual([kept]);
    expect((await current()).eventId).toBe(kept.eventId);
  });

  it('mẫu cũ hơn vào history nhưng current không lùi', async () => {
    const before = await current();
    const older = event({ clientTimestamp: base - 8_000 });
    const result = await repository.recordGpsEvent(older);

    expect(result).toMatchObject({ historyInserted: true, currentUpdated: false });
    expect(await history()).toHaveLength(2);
    expect(await current()).toEqual(before);
  });

  it('mẫu chỉ ghi history (lệch giờ) không chiếm current', async () => {
    const before = await current();
    const future = event({ clientTimestamp: base + 120_000, receivedAtMs: base + 1_000 });
    const result = await repository.recordGpsEvent(future, true);

    expect(result).toMatchObject({ historyInserted: true, currentUpdated: false });
    expect(await current()).toEqual(before);
  });

  it('lỗi sau khi đã ghi history thì rollback cả hai bảng', async () => {
    const countBefore = (await history()).length;
    const before = await current();
    // Ép bước ghi current lỗi để thử rollback phần history đã ghi trong cùng transaction.
    await db.query('ALTER TABLE current_locations ADD CONSTRAINT force_fail CHECK (false) NOT VALID');
    try {
      await expect(repository.recordGpsEvent(event({ clientTimestamp: base + 8_000 }))).rejects.toThrow();
    } finally {
      await db.query('ALTER TABLE current_locations DROP CONSTRAINT force_fail');
    }

    expect(await history()).toHaveLength(countBefore);
    expect(await current()).toEqual(before);
  });
});
