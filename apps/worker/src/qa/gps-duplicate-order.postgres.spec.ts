import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GpsProcessorService } from '../consumer/gps-processor.service';
import { GpsSubscriber } from '../consumer/gps.subscriber';
import { GpsWriterRepository } from '../storage/gps-writer.repository';

// TV6 QA tuần 8: gửi một manifest GPS trùng và sai thứ tự qua đúng đường Worker (message → GpsSubscriber →
// PostgreSQL với 001 + 002), rồi đối chiếu từng dòng SQL với kết quả mong đợi. Chạy khi có WORKER_TEST_DATABASE_URL.
const connectionString = process.env.WORKER_TEST_DATABASE_URL;
const driverId = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX';
const t0 = Date.UTC(2026, 10, 14, 3, 0, 0, 123);

type Sample = { name: string; eventId: string; lat: number; lng: number; clientTimestamp: number | string; receivedAt: number };
// receivedAt (r) là lúc API nhận. Theo đặc tả: r < t ≤ r+60s chỉ vào history; t > r+60s bị từ chối, không lưu.
const manifest: Sample[] = [
  { name: 'A mẫu đầu', eventId: 'evt-A', lat: 21.0001, lng: 105.8001, clientTimestamp: t0, receivedAt: t0 + 300 },
  { name: 'B trùng khóa A, tọa độ khác', eventId: 'evt-B', lat: 21.9999, lng: 105.9999, clientTimestamp: t0, receivedAt: t0 + 900 },
  { name: 'C cũ hơn A 10 giây, đến muộn', eventId: 'evt-C', lat: 21.0002, lng: 105.8002, clientTimestamp: t0 - 10_000, receivedAt: t0 + 1_000 },
  { name: 'D mới hơn A 8 giây', eventId: 'evt-D', lat: 21.0003, lng: 105.8003, clientTimestamp: t0 + 8_000, receivedAt: t0 + 8_200 },
  { name: 'E cùng thời điểm D, viết theo +07:00', eventId: 'evt-E', lat: 21.5, lng: 105.5,
    clientTimestamp: new Date(t0 + 8_000).toISOString().replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})/, (_m, d, h) => `${d}T${String(Number(h) + 7).padStart(2, '0')}`).replace('Z', '+07:00'),
    receivedAt: t0 + 8_400 },
  { name: 'F tương lai đúng biên r+60s', eventId: 'evt-F', lat: 21.0004, lng: 105.8004, clientTimestamp: t0 + 69_000, receivedAt: t0 + 9_000 },
  { name: 'G tương lai vượt biên 1 ms', eventId: 'evt-G', lat: 21.0005, lng: 105.8005, clientTimestamp: t0 + 69_001, receivedAt: t0 + 9_000 },
  { name: 'D phát lại (redelivery)', eventId: 'evt-D', lat: 21.0003, lng: 105.8003, clientTimestamp: t0 + 8_000, receivedAt: t0 + 8_200 },
];

describe.skipIf(!connectionString)('QA tuần 8: GPS trùng và sai thứ tự qua Worker, đối chiếu SQL', () => {
  const schema = `qa_w8_${randomUUID().replaceAll('-', '')}`;
  let admin: Pool;
  let db: Pool;
  let repository: GpsWriterRepository;
  let subscriber: GpsSubscriber;
  const previousUrl = process.env.DATABASE_URL;
  const acks: Record<string, string> = {};

  beforeAll(async () => {
    const target = new URL(connectionString!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/parcelflow_worker_test') {
      throw new Error('Use a disposable loopback database named parcelflow_worker_test');
    }
    admin = new Pool({ connectionString, max: 1 });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    target.searchParams.set('options', `-c search_path=${schema}`);
    db = new Pool({ connectionString: target.toString(), max: 1 });
    const sqlDir = resolve(process.cwd(), 'packages/database/sql');
    await db.query(readFileSync(resolve(sqlDir, '001-create-shipment.sql'), 'utf8'));
    await db.query(readFileSync(resolve(sqlDir, '002-create-gps-locations.sql'), 'utf8'));
    await db.query(`INSERT INTO users (id,"firebaseUid",email,name,role) VALUES ($1,'fb-d','d@x.vn','Driver','DRIVER')`, [driverId]);
    process.env.DATABASE_URL = target.toString();
    repository = new GpsWriterRepository();
    subscriber = new GpsSubscriber(new GpsProcessorService(), repository);
    for (const [i, s] of manifest.entries()) {
      let state = 'none';
      await subscriber.handleIncomingMessage({
        id: `msg-${i}`,
        data: Buffer.from(JSON.stringify({ eventId: s.eventId, driverId, latitude: s.lat, longitude: s.lng,
          clientTimestamp: s.clientTimestamp, receivedAt: new Date(s.receivedAt).toISOString() })),
        ack: () => { state = 'ack'; }, nack: () => { state = 'nack'; },
      } as never);
      acks[`${i}:${s.name}`] = state;
    }
  });

  afterAll(async () => {
    process.env.DATABASE_URL = previousUrl;
    await (repository as unknown as { pool?: Pool }).pool?.end();
    await db?.end();
    await admin?.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin?.end();
  });

  it('ACK mọi message, kể cả bản trùng, bản phát lại và mẫu vượt biên bị loại (không để kẹt hàng đợi)', () => {
    expect(Object.values(acks)).toEqual(Array(manifest.length).fill('ack'));
  });

  it('location_history: mỗi khóa (driverId, clientTimestamp) một dòng, bản đầu thắng', async () => {
    const rows = (await db.query(`SELECT "eventId", lat, lng, "clientTimestamp" FROM location_history
      WHERE "driverId"=$1 ORDER BY "clientTimestamp"`, [driverId])).rows;
    expect(rows.map((r) => r.eventId)).toEqual(['evt-C', 'evt-A', 'evt-D', 'evt-F']);
    expect(rows.find((r) => r.eventId === 'evt-A')).toMatchObject({ lat: 21.0001, lng: 105.8001 });
    expect(rows.find((r) => r.eventId === 'evt-D')).toMatchObject({ lat: 21.0003, lng: 105.8003 });
    const dup = (await db.query(`SELECT "driverId","clientTimestamp",count(*)::int n FROM location_history
      GROUP BY 1,2 HAVING count(*)>1`)).rows;
    expect(dup).toEqual([]);
  });

  it('current_locations: không lùi về mẫu cũ, không bị mẫu tương lai (F) chiếm; mẫu vượt biên (G) không lưu ở đâu', async () => {
    const cur = (await db.query(`SELECT "eventId", lat, "clientTimestamp" FROM current_locations WHERE "driverId"=$1`, [driverId])).rows;
    expect(cur).toHaveLength(1);
    expect(cur[0]).toMatchObject({ eventId: 'evt-D', lat: 21.0003 });
    expect(new Date(cur[0].clientTimestamp).getTime()).toBe(t0 + 8_000);
    const g = (await db.query(`SELECT count(*)::int n FROM location_history WHERE "eventId"='evt-G'`)).rows[0].n;
    expect(g).toBe(0);
  });
});
