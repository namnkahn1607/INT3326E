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
});

