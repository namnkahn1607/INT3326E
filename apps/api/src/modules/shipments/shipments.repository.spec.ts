import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { normalizeCreateShipment } from './dto/create-shipment.dto';
import type { ShipmentResponseDto } from './dto/shipment-response.dto';
import { shipmentIdentifiers } from './shipment-identifiers';
import { ShipmentsRepository } from './shipments.repository';
import { shipmentIdempotencyTtlProvider } from './shipments.service';

const actor = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAV';
const body = normalizeCreateShipment({ pickupAddress: '144 Xuan Thuy', dropoffAddress: '1 Dai Co Viet',
  pickupLocation: { lat: 21, lng: 105 }, dropoffLocation: { lat: 0, lng: 0 },
  recipientName: 'Nguoi nhan', recipientPhone: '+84900000000' });
const make = (now: Date): ShipmentResponseDto => ({ ...body, ...shipmentIdentifiers(now), customerId: actor,
  driverId: null, status: 'CREATED', isLate: null, failureReason: null, failedByRole: null,
  failedByUserId: null, proofOfDeliveryNotes: null, createdAt: now.toISOString(), updatedAt: now.toISOString() });

const errorLog = vi.fn();
beforeEach(() => { errorLog.mockClear(); vi.spyOn(Logger.prototype, 'error').mockImplementation(errorLog); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Repository failure boundaries (mock SQL client)', () => {
  it.each([
    ['BEGIN', 'shipments.begin'],
    ['INSERT INTO idempotency_requests', 'shipments.idempotency.claim'],
    ['SELECT clock_timestamp()', 'shipments.clock'],
    ['SET "requestHash"=$4', 'shipments.idempotency.refresh'],
    ['INSERT INTO shipments', 'shipments.insert'],
    ['INSERT INTO shipment_status_events', 'shipments.event.insert'],
    ['INSERT INTO notifications', 'shipments.notification.insert'],
    ['SET "responseStatus"=201', 'shipments.idempotency.complete'],
    ['COMMIT', 'shipments.commit'],
  ])('identifies failure at %s without exposing SQL parameters', async (statement, stage) => {
    const now = new Date();
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes(statement)) throw Object.assign(new Error('private SQL/password'), { code: '42501', detail: body });
      if (sql.includes('RETURNING "requestHash"')) return { rows: [{ requestHash: 'hash', responseBody: null, expiresAt: now }] };
      if (sql === 'SELECT clock_timestamp() AS now') return { rows: [{ now }] };
      if (sql.includes('INSERT INTO shipments')) return { rows: [{ id: 'created' }] };
      return { rows: [] };
    });
    const release = vi.fn();
    const pool = { connect: vi.fn().mockResolvedValue({ query, release }) };
    await expect(new ShipmentsRepository(pool as unknown as Pool).create(actor, 'private-key', 'private-hash', 86400, make))
      .rejects.toMatchObject({ status: 503 });
    expect(errorLog).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ event: 'dependency_failure', stage, code: '42501' }));
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('fails closed when pool is absent or connection cannot be acquired', async () => {
    await expect(new ShipmentsRepository(null).create(actor, 'key', 'hash', 86400, make)).rejects.toMatchObject({ status: 503 });
    const pool = { connect: vi.fn().mockRejectedValue(new Error('private credentials')) };
    await expect(new ShipmentsRepository(pool as unknown as Pool).create(actor, 'key', 'hash', 86400, make))
      .rejects.toMatchObject({ status: 503 });
    expect(errorLog).toHaveBeenNthCalledWith(1, JSON.stringify({
      event: 'dependency_failure', stage: 'shipments.connect', code: 'DATABASE_URL_MISSING',
    }));
    expect(errorLog).toHaveBeenNthCalledWith(2, JSON.stringify({
      event: 'dependency_failure', stage: 'shipments.connect', code: 'UNKNOWN',
    }));
  });

  it('does not log a normal idempotency conflict as a dependency failure', async () => {
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('RETURNING "requestHash"')) return { rows: [{ requestHash: 'other', responseStatus: 201,
        responseBody: {}, expiresAt: new Date(Date.now() + 86400_000) }] };
      if (sql === 'SELECT clock_timestamp() AS now') return { rows: [{ now: new Date() }] };
      return { rows: [] };
    });
    const release = vi.fn();
    const pool = { connect: vi.fn().mockResolvedValue({ query, release }) };
    await expect(new ShipmentsRepository(pool as unknown as Pool).create(actor, 'key', 'hash', 86400, make))
      .rejects.toMatchObject({ status: 409 });
    expect(errorLog).not.toHaveBeenCalled();
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('retries tracking collisions on one client, at most five times; always rolls back and releases on exhaustion', async () => {
    const now = new Date();
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('RETURNING "requestHash"')) return { rows: [{ requestHash: 'hash', responseStatus: null, responseBody: null, expiresAt: new Date(now.getTime() + 86400_000) }] };
      if (sql === 'SELECT clock_timestamp() AS now') return { rows: [{ now }] };
      return { rows: [] };
    });
    const release = vi.fn();
    const pool = { connect: vi.fn().mockResolvedValue({ query, release }), query: vi.fn() };
    const factory = vi.fn(make);
    await expect(new ShipmentsRepository(pool as unknown as Pool).create(actor, 'key', 'hash', 86400, factory))
      .rejects.toMatchObject({ status: 503 });
    expect(factory).toHaveBeenCalledTimes(5);
    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
    expect(query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO shipments'))).toHaveLength(5);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
      event: 'dependency_failure', stage: 'shipments.insert', code: 'TRACKING_CODE_RETRY_EXHAUSTED',
    }));
  });

  it('discards a connection if rollback also fails, masking internal errors', async () => {
    const query = vi.fn().mockRejectedValue(new Error('private DB detail'));
    const release = vi.fn();
    const pool = { connect: vi.fn().mockResolvedValue({ query, release }) };
    await expect(new ShipmentsRepository(pool as unknown as Pool).create(actor, 'key', 'hash', 86400, make))
      .rejects.toMatchObject({ status: 503 });
    expect(release).toHaveBeenCalledWith(expect.any(Error));
    expect(errorLog).toHaveBeenNthCalledWith(1, JSON.stringify({
      event: 'dependency_failure', stage: 'shipments.begin', code: 'UNKNOWN',
    }));
    expect(errorLog).toHaveBeenNthCalledWith(2, JSON.stringify({
      event: 'dependency_failure', stage: 'shipments.rollback', code: 'UNKNOWN',
    }));
  });
});

describe('Create TTL configuration', () => {
  it('defaults to24h and accepts a configured window', () => {
    vi.stubEnv('SHIPMENT_IDEMPOTENCY_TTL_SECONDS', undefined);
    try {
      expect(shipmentIdempotencyTtlProvider.useFactory()).toBe(86400);
      vi.stubEnv('SHIPMENT_IDEMPOTENCY_TTL_SECONDS', '60');
      expect(shipmentIdempotencyTtlProvider.useFactory()).toBe(60);
    } finally { vi.unstubAllEnvs(); }
  });
  it.each(['0', '-1', '1.2', '', 'no', 'Infinity', '31536001'])('fails startup on invalid TTL %s', value => {
    vi.stubEnv('SHIPMENT_IDEMPOTENCY_TTL_SECONDS', value);
    try { expect(() => shipmentIdempotencyTtlProvider.useFactory()).toThrow(); }
    finally { vi.unstubAllEnvs(); }
  });
});
