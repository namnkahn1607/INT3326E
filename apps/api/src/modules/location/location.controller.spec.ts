import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { LocationService } from './location.service';
import { LocationController } from './location.controller';
import { IngestLocationDto } from './dto/ingest-location.dto';

describe('LocationController & LocationService (API08)', () => {
  let service: LocationService;
  let controller: LocationController;
  let mockTopic: { publishMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = new LocationService();
    mockTopic = {
      publishMessage: vi.fn().mockResolvedValue('msg-id-123'),
    };
    service.setTopic(mockTopic);
    controller = new LocationController(service);
  });

  const validPayload: IngestLocationDto = {
    driverId: 'drv_test_01',
    latitude: 21.0285,
    longitude: 105.8542,
    clientTimestamp: Date.now(),
    sessionId: 'sess_123',
    seq: 1,
  };

  const mockRequest = (user?: { uid: string; role: string }) => ({
    user,
    businessUser: user ? { id: `usr_${user.uid}`, role: user.role } : undefined,
  } as any);

  it('TC04.2: should accept valid GPS payload and publish to Pub/Sub returning 202 ACCEPTED', async () => {
    const req = mockRequest({ uid: 'drv_01', role: 'DRIVER' });
    const response = await controller.ingestLocation(validPayload, req);

    expect(response.status).toBe('ACCEPTED');
    expect(response.eventId).toMatch(/^evt_/);
    expect(response.receivedAt).toBeDefined();

    expect(mockTopic.publishMessage).toHaveBeenCalledOnce();
    const publishedCall = mockTopic.publishMessage.mock.calls[0][0];
    const publishedData = JSON.parse(publishedCall.data.toString('utf-8'));

    expect(publishedData.driverId).toBe('usr_drv_01');
    expect(publishedData.lat).toBe(21.0285);
    expect(publishedData.lng).toBe(105.8542);
    expect(publishedData.eventId).toBe(response.eventId);
  });

  it('TC04.1: should reject payload with out-of-range coordinates with 400 Bad Request', async () => {
    const invalidCoords: IngestLocationDto = {
      ...validPayload,
      latitude: 95.0, // Invalid lat > 90
    };
    const req = mockRequest({ uid: 'drv_01', role: 'DRIVER' });

    await expect(controller.ingestLocation(invalidCoords, req)).rejects.toThrow(BadRequestException);
    expect(mockTopic.publishMessage).not.toHaveBeenCalled();
  });

  it('TC04.5: should reject clock skew exceeding 60s future tolerance with 400 Bad Request', async () => {
    const futurePayload: IngestLocationDto = {
      ...validPayload,
      clientTimestamp: Date.now() + 65000, // +65s in the future
    };
    const req = mockRequest({ uid: 'drv_01', role: 'DRIVER' });

    await expect(controller.ingestLocation(futurePayload, req)).rejects.toThrow(BadRequestException);
    expect(mockTopic.publishMessage).not.toHaveBeenCalled();
  });

  it('TC04.2: should return 503 Service Unavailable when Pub/Sub broker fails to confirm', async () => {
    mockTopic.publishMessage.mockRejectedValueOnce(new Error('Broker connection timed out'));
    const req = mockRequest({ uid: 'drv_01', role: 'DRIVER' });

    await expect(controller.ingestLocation(validPayload, req)).rejects.toThrow(ServiceUnavailableException);
  });
});

