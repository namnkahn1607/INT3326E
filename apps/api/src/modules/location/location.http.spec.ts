import 'reflect-metadata';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module';
import { configureApp } from '../../config/app.config';
import { FIREBASE_AUTH } from '../auth/providers/firebase-auth.provider';
import { TOKEN_VERIFIER } from '../auth/interfaces/token-verifier.interface';
import { UsersRepository } from '../users/users.repository';
import { USER_DATABASE } from '../users/user-database.provider';
import { LocationService } from './location.service';

// Chạy HTTP qua module thật để kiểm chứng guard; chỉ Firebase, mapping và broker được giả lập.
describe('Tích hợp GPS của Na với develop (HTTP local)', () => {
  let app: INestApplication;
  let base: string;
  let assertEvent: (value: unknown) => void;
  const publish = vi.fn().mockResolvedValue('pubsub-message');
  const lookup = vi.fn();
  const now = Date.now();
  const valid = { lat: 21.0285, lng: 105.8542, clientTimestamp: new Date(now).toISOString(), seq: 1 };
  const driverId = 'usr_00000000000000000000000001';
  const roles: Record<string, string> = { driver: 'DRIVER', customer: 'CUSTOMER', admin: 'ADMIN',
    missing: 'DRIVER', mismatch: 'DRIVER' };

  beforeAll(async () => {
    const sharedPath = pathToFileURL(resolve(process.cwd(), '../../packages/types/src/gps.ts')).href;
    ({ assertGpsTelemetryEvent: assertEvent } = await import(sharedPath));
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FIREBASE_AUTH).useValue({})
      .overrideProvider(TOKEN_VERIFIER).useValue({ verify: vi.fn(async (token: string) => {
        if (!roles[token]) throw new Error('invalid token');
        return { uid: token, role: roles[token] };
      }) })
      .overrideProvider(USER_DATABASE).useValue(null)
      .overrideProvider(UsersRepository).useValue({ findByFirebaseUid: lookup }).compile();
    module.get(LocationService).setTopic({ publishMessage: publish });
    app = module.createNestApplication(); configureApp(app); await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/v1`;
  });

  beforeEach(() => {
    publish.mockReset().mockResolvedValue('pubsub-message');
    lookup.mockReset().mockImplementation(async (uid: string) => uid === 'missing' ? [] : [{
      id: driverId, firebaseUid: uid, role: uid === 'mismatch' ? 'CUSTOMER' : roles[uid],
    }]);
  });
  afterAll(async () => { await app?.close(); });

  const post = (body: unknown = valid, actor = 'driver') => fetch(`${base}/locations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${actor}` } : {}) },
    body: JSON.stringify(body),
  });

  it('Driver gửi GPS, event đúng validator chung và được Worker của Na tiếp nhận', async () => {
    const response = await post();
    expect(response.status).toBe(202);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const accepted = await response.json();
    expect(accepted).toEqual({ status: 'ACCEPTED', eventId: expect.any(String), receivedAt: expect.any(String) });
    const event = JSON.parse(publish.mock.calls[0][0].data.toString('utf8'));
    expect(() => assertEvent(event)).not.toThrow();
    expect(event).toEqual({ ...valid, driverId, eventId: accepted.eventId, receivedAt: accepted.receivedAt });
    expect(event.driverId).not.toBe('driver');
    const workerPath = pathToFileURL(resolve(process.cwd(), '../worker/src/consumer/gps-processor.service.ts')).href;
    const { GpsProcessorService } = await import(workerPath);
    const result = new GpsProcessorService().processMessage(JSON.stringify(event));
    expect(result.type).toBe('VALID_GPS');
    expect(result.event.clientTimestampIso).toBe(event.clientTimestamp);
    expect(result.event.driverId).toBe(driverId);
  });

  it('Chuẩn hóa timezone và cắt phần nhỏ hơn mili giây', async () => {
    const response = await post({ ...valid, clientTimestamp: '2026-10-16T17:00:00.123456+07:00',
      sessionId: '00000000-0000-4000-8000-000000000001' });
    expect(response.status).toBe(202);
    const event = JSON.parse(publish.mock.calls[0][0].data.toString('utf8'));
    expect(event.clientTimestamp).toBe('2026-10-16T10:00:00.123Z');
    expect(() => assertEvent(event)).not.toThrow();
  });

  it.each([['', 401], ['invalid', 401], ['customer', 403], ['admin', 403], ['missing', 409], ['mismatch', 409]])(
    'Chặn tài khoản %s, trả %i và không publish', async (actor, status) => {
      const response = await post(valid, actor);
      expect(response.status).toBe(status);
      expect(publish).not.toHaveBeenCalled();
      if (status === 409) expect((await response.json()).code).toBe('USER_NOT_PROVISIONED');
    });

  it('Lỗi tra cứu tài khoản không được chuyển sang dùng Firebase UID', async () => {
    const { ServiceUnavailableException } = await import('@nestjs/common');
    lookup.mockRejectedValueOnce(new ServiceUnavailableException());
    expect((await post()).status).toBe(503);
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    { ...valid, driverId: 'driver-gia' }, { ...valid, role: 'DRIVER' },
    { ...valid, receivedAt: valid.clientTimestamp }, { ...valid, eventId: 'client-event' },
    { latitude: 21, longitude: 105, clientTimestamp: valid.clientTimestamp },
    { ...valid, lat: '21' }, { ...valid, lat: 91 }, { ...valid, lng: -181 },
    { ...valid, clientTimestamp: now }, { ...valid, clientTimestamp: '2026-02-30T10:00:00Z' },
    { ...valid, clientTimestamp: '2026-10-16T10:00:00' },
    { ...valid, clientTimestamp: '2026-10-16T10:00:00+24:00' },
    { ...valid, seq: 0 }, { ...valid, seq: 1.5 }, { ...valid, seq: 2147483648 },
    { ...valid, seq: null }, { ...valid, sessionId: 'sess_123' }, {}, [],
  ])('Từ chối payload sai và không publish: %j', async body => {
    expect((await post(body)).status).toBe(400);
    expect(publish).not.toHaveBeenCalled();
  });

  it('Giữ nguyên ngưỡng clock skew của Na: nhận đúng 60 giây, từ chối vượt ngưỡng', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      expect((await post({ ...valid, clientTimestamp: new Date(now + 60_000).toISOString() })).status).toBe(202);
      publish.mockClear();
      expect((await post({ ...valid, clientTimestamp: new Date(now + 60_001).toISOString() })).status).toBe(400);
      expect(publish).not.toHaveBeenCalled();
    } finally { clock.mockRestore(); }
  });

  it('Chờ broker xác nhận trước khi trả 202', async () => {
    let confirm!: (id: string) => void;
    let started!: () => void;
    const reached = new Promise<void>(resolve => { started = resolve; });
    publish.mockImplementationOnce(() => { started(); return new Promise<string>(resolve => { confirm = resolve; }); });
    let completed = false;
    const pending = post().then(response => { completed = true; return response; });
    await reached;
    expect(completed).toBe(false);
    confirm('confirmed');
    expect((await pending).status).toBe(202);
    expect(publish).toHaveBeenCalledOnce();
  });

  it('Broker lỗi trả 503, không báo nhận thành công hoặc tự publish lại', async () => {
    publish.mockRejectedValueOnce(new Error('private Google credentials'));
    const response = await post();
    expect(response.status).toBe(503);
    const problem = await response.json();
    expect(problem.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(problem)).not.toContain('private Google credentials');
    expect(publish).toHaveBeenCalledOnce();
  });
});
