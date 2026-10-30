import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GpsSubscriber } from './gps.subscriber';
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
});

