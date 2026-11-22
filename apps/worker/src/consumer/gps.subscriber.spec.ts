import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GpsSubscriber, isPermanentDatabaseError } from './gps.subscriber';
import { GpsProcessorService } from './gps-processor.service';
import { GpsWriterRepository } from '../storage/gps-writer.repository';

describe('GpsSubscriber message handling', () => {
  let subscriber: GpsSubscriber;
  let processor: GpsProcessorService;
  let repository: GpsWriterRepository;

  beforeEach(() => {
    processor = new GpsProcessorService();
    repository = new GpsWriterRepository();
    subscriber = new GpsSubscriber(processor, repository);
  });

  const createMockMessage = (content: string) => ({
    id: 'msg_test_001',
    data: Buffer.from(content, 'utf-8'),
    ack: vi.fn(),
    nack: vi.fn(),
  });

  it('should acknowledge Hello World message and log appropriately', async () => {
    const mockMessage = createMockMessage('Hello World');
    await subscriber.handleIncomingMessage(mockMessage as any);

    expect(mockMessage.ack).toHaveBeenCalledOnce();
  });

  it('should process and record valid EVT01 GPS message and ack', async () => {
    const validGps = {
      eventId: 'evt_101',
      driverId: 'drv_test',
      latitude: 21.0285,
      longitude: 105.8542,
      clientTimestamp: 1760800000000,
      receivedAt: '2026-10-18T14:30:00.000Z',
    };

    const mockMessage = createMockMessage(JSON.stringify(validGps));
    await subscriber.handleIncomingMessage(mockMessage as any);

    expect(mockMessage.ack).toHaveBeenCalledOnce();
    const current = await repository.getLatestCurrentLocation('drv_test');
    expect(current?.latitude).toBe(21.0285);
  });

  it('should acknowledge invalid message to prevent deadlocks and poison queue', async () => {
    const mockMessage = createMockMessage('{ bad: json');
    await subscriber.handleIncomingMessage(mockMessage as any);

    expect(mockMessage.ack).toHaveBeenCalledOnce();
  });

  describe('TC04.8: Database Failure & Transaction Recovery', () => {
    it('should NOT acknowledge and instead call nack when database transaction fails', async () => {
      repository.setSimulateFailure(true);

      const validGps = {
        eventId: 'evt_fail_test',
        driverId: 'drv_fail',
        latitude: 21.0285,
        longitude: 105.8542,
        clientTimestamp: 1760800000000,
        receivedAt: '2026-10-18T14:30:00.000Z',
      };

      const mockMessage = createMockMessage(JSON.stringify(validGps));

      await expect(subscriber.handleIncomingMessage(mockMessage as any)).rejects.toThrow(
        'Simulated database transaction failure (TC04.8 test hook)',
      );

      // Must NOT ACK before commit
      expect(mockMessage.ack).not.toHaveBeenCalled();
      // Must call nack for Pub/Sub redelivery
      expect(mockMessage.nack).toHaveBeenCalledOnce();

      // Database should not have stored the uncommitted event
      expect(await repository.getHistoryCount('drv_fail')).toBe(0);
      expect(await repository.getLatestCurrentLocation('drv_fail')).toBeNull();
    });

    it('should successfully persist and ack upon retry after recovery', async () => {
      // Simulate failure on first attempt
      repository.setSimulateFailure(true);
      const validGps = {
        eventId: 'evt_retry_test',
        driverId: 'drv_retry',
        latitude: 21.0333,
        longitude: 105.8444,
        clientTimestamp: 1760800000000,
        receivedAt: '2026-10-18T14:30:00.000Z',
      };
      const failedMessage = createMockMessage(JSON.stringify(validGps));
      await expect(subscriber.handleIncomingMessage(failedMessage as any)).rejects.toThrow();

      // System recovers
      repository.setSimulateFailure(false);
      const redeliveredMessage = createMockMessage(JSON.stringify(validGps));
      await subscriber.handleIncomingMessage(redeliveredMessage as any);

      expect(redeliveredMessage.ack).toHaveBeenCalledOnce();
      expect(await repository.getHistoryCount('drv_retry')).toBe(1);
      const current = await repository.getLatestCurrentLocation('drv_retry');
      expect(current?.latitude).toBe(21.0333);
    });
  });

  describe('Permanent vs Transient error classification', () => {
    const validGps = {
      eventId: 'evt_perm_test',
      driverId: 'drv_perm',
      latitude: 21.0285,
      longitude: 105.8542,
      clientTimestamp: 1760800000000,
      receivedAt: '2026-10-18T14:30:00.000Z',
    };

    it('should ACK (not NACK) on foreign key violation (23503) so message routes to DLQ', async () => {
      const fkError = new Error('insert or update on table "location_history" violates foreign key constraint') as any;
      fkError.code = '23503';
      vi.spyOn(repository, 'recordGpsEvent').mockRejectedValueOnce(fkError);

      const mockMessage = createMockMessage(JSON.stringify(validGps));

      // Should NOT throw — permanent errors are handled gracefully
      await subscriber.handleIncomingMessage(mockMessage as any);

      expect(mockMessage.ack).toHaveBeenCalledOnce();
      expect(mockMessage.nack).not.toHaveBeenCalled();
    });

    it('should ACK on not-null violation (23502)', async () => {
      const nnError = new Error('null value in column "driverId" violates not-null constraint') as any;
      nnError.code = '23502';
      vi.spyOn(repository, 'recordGpsEvent').mockRejectedValueOnce(nnError);

      const mockMessage = createMockMessage(JSON.stringify(validGps));
      await subscriber.handleIncomingMessage(mockMessage as any);

      expect(mockMessage.ack).toHaveBeenCalledOnce();
      expect(mockMessage.nack).not.toHaveBeenCalled();
    });

    it('should ACK on check constraint violation (23514)', async () => {
      const ckError = new Error('new row violates check constraint') as any;
      ckError.code = '23514';
      vi.spyOn(repository, 'recordGpsEvent').mockRejectedValueOnce(ckError);

      const mockMessage = createMockMessage(JSON.stringify(validGps));
      await subscriber.handleIncomingMessage(mockMessage as any);

      expect(mockMessage.ack).toHaveBeenCalledOnce();
      expect(mockMessage.nack).not.toHaveBeenCalled();
    });

    it('should ACK on syntax/access class 42 errors (e.g. 42P01 undefined_table)', async () => {
      const synError = new Error('relation "location_history" does not exist') as any;
      synError.code = '42P01';
      vi.spyOn(repository, 'recordGpsEvent').mockRejectedValueOnce(synError);

      const mockMessage = createMockMessage(JSON.stringify(validGps));
      await subscriber.handleIncomingMessage(mockMessage as any);

      expect(mockMessage.ack).toHaveBeenCalledOnce();
      expect(mockMessage.nack).not.toHaveBeenCalled();
    });

    it('should NACK on connection timeout (transient error)', async () => {
      const connError = new Error('timeout exceeded when trying to connect') as any;
      // Connection errors from pg typically have no SQLSTATE code
      vi.spyOn(repository, 'recordGpsEvent').mockRejectedValueOnce(connError);

      const mockMessage = createMockMessage(JSON.stringify(validGps));
      await expect(subscriber.handleIncomingMessage(mockMessage as any)).rejects.toThrow('timeout exceeded');

      expect(mockMessage.ack).not.toHaveBeenCalled();
      expect(mockMessage.nack).toHaveBeenCalledOnce();
    });

    it('should NACK on ECONNREFUSED (transient error)', async () => {
      const connError = new Error('connect ECONNREFUSED 127.0.0.1:5432') as any;
      connError.code = 'ECONNREFUSED'; // Node.js system error code, not a PG SQLSTATE
      vi.spyOn(repository, 'recordGpsEvent').mockRejectedValueOnce(connError);

      const mockMessage = createMockMessage(JSON.stringify(validGps));
      await expect(subscriber.handleIncomingMessage(mockMessage as any)).rejects.toThrow('ECONNREFUSED');

      expect(mockMessage.ack).not.toHaveBeenCalled();
      expect(mockMessage.nack).toHaveBeenCalledOnce();
    });

    it('should NACK on admin_shutdown (57P01 — transient PG error)', async () => {
      const shutdownError = new Error('terminating connection due to administrator command') as any;
      shutdownError.code = '57P01';
      vi.spyOn(repository, 'recordGpsEvent').mockRejectedValueOnce(shutdownError);

      const mockMessage = createMockMessage(JSON.stringify(validGps));
      await expect(subscriber.handleIncomingMessage(mockMessage as any)).rejects.toThrow('terminating connection');

      expect(mockMessage.ack).not.toHaveBeenCalled();
      expect(mockMessage.nack).toHaveBeenCalledOnce();
    });

    it('should NACK on unknown/generic errors as safe default', async () => {
      const unknownError = new Error('Something unexpected');
      vi.spyOn(repository, 'recordGpsEvent').mockRejectedValueOnce(unknownError);

      const mockMessage = createMockMessage(JSON.stringify(validGps));
      await expect(subscriber.handleIncomingMessage(mockMessage as any)).rejects.toThrow('Something unexpected');

      expect(mockMessage.ack).not.toHaveBeenCalled();
      expect(mockMessage.nack).toHaveBeenCalledOnce();
    });
  });

  describe('isPermanentDatabaseError helper', () => {
    it('returns true for FK violation 23503', () => {
      expect(isPermanentDatabaseError({ code: '23503' })).toBe(true);
    });

    it('returns true for not-null violation 23502', () => {
      expect(isPermanentDatabaseError({ code: '23502' })).toBe(true);
    });

    it('returns true for check violation 23514', () => {
      expect(isPermanentDatabaseError({ code: '23514' })).toBe(true);
    });

    it('returns true for exclusion violation 23P01', () => {
      expect(isPermanentDatabaseError({ code: '23P01' })).toBe(true);
    });

    it('returns true for class 42 errors (42P01, 42000, etc.)', () => {
      expect(isPermanentDatabaseError({ code: '42P01' })).toBe(true);
      expect(isPermanentDatabaseError({ code: '42000' })).toBe(true);
      expect(isPermanentDatabaseError({ code: '42501' })).toBe(true);
    });

    it('returns false for transient PG errors (57P01 admin_shutdown)', () => {
      expect(isPermanentDatabaseError({ code: '57P01' })).toBe(false);
    });

    it('returns false for Node.js system error codes', () => {
      expect(isPermanentDatabaseError({ code: 'ECONNREFUSED' })).toBe(false);
      expect(isPermanentDatabaseError({ code: 'ETIMEDOUT' })).toBe(false);
    });

    it('returns false for errors without code', () => {
      expect(isPermanentDatabaseError(new Error('generic'))).toBe(false);
      expect(isPermanentDatabaseError(null)).toBe(false);
      expect(isPermanentDatabaseError(undefined)).toBe(false);
    });
  });
});
