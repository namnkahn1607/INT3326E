import { describe, it, expect, beforeEach } from 'vitest';
import { GpsProcessorService } from './gps-processor.service';

describe('GpsProcessorService', () => {
  let service: GpsProcessorService;

  beforeEach(() => {
    service = new GpsProcessorService();
  });

  describe('Hello World detection', () => {
    it('should identify plain string "Hello World" message', () => {
      const result = service.processMessage('Hello World');
      expect(result.type).toBe('HELLO_WORLD');
      if (result.type === 'HELLO_WORLD') {
        expect(result.raw).toBe('Hello World');
      }
    });

    it('should identify "Hello World" with surrounding whitespace', () => {
      const result = service.processMessage('   Hello World \n');
      expect(result.type).toBe('HELLO_WORLD');
    });

    it('should identify Buffer containing "Hello World"', () => {
      const result = service.processMessage(Buffer.from('Hello World'));
      expect(result.type).toBe('HELLO_WORLD');
    });
  });

  describe('EVT01 GPS payload parsing & validation', () => {
    const validCanonicalPayload = {
      eventId: 'evt_test_123',
      driverId: 'drv_test_001',
      latitude: 21.028511,
      longitude: 105.804817,
      clientTimestamp: 1760800000000,
      receivedAt: '2026-10-18T14:40:00.100Z',
      sessionId: 'sess_123',
      seq: 1,
    };

    it('should successfully parse and normalize a valid EVT01 payload', () => {
      const result = service.processMessage(JSON.stringify(validCanonicalPayload));
      expect(result.type).toBe('VALID_GPS');

      if (result.type === 'VALID_GPS') {
        expect(result.event.eventId).toBe('evt_test_123');
        expect(result.event.driverId).toBe('drv_test_001');
        expect(result.event.lat).toBe(21.028511);
        expect(result.event.latitude).toBe(21.028511);
        expect(result.event.lng).toBe(105.804817);
        expect(result.event.longitude).toBe(105.804817);
        expect(result.event.clientTimestamp).toBe(1760800000000);
        expect(result.event.seq).toBe(1);
        expect(result.isHistoryOnly).toBe(false);
        expect(result.clockSkew).toBe(false);
      }
    });

    it('should accept lat/lng field names as alternative to latitude/longitude', () => {
      const payload = {
        eventId: 'evt_alias_1',
        driverId: 'drv_002',
        lat: 21.0378,
        lng: 105.7829,
        clientTimestamp: '2026-10-10T04:00:00.000Z',
        receivedAt: '2026-10-10T04:00:00.120Z',
      };

      const result = service.processMessage(JSON.stringify(payload));
      expect(result.type).toBe('VALID_GPS');
      if (result.type === 'VALID_GPS') {
        expect(result.event.latitude).toBe(21.0378);
        expect(result.event.longitude).toBe(105.7829);
      }
    });

    it('should reject malformed JSON', () => {
      const result = service.processMessage('{ not valid json ');
      expect(result.type).toBe('INVALID_PAYLOAD');
      if (result.type === 'INVALID_PAYLOAD') {
        expect(result.error).toContain('Malformed JSON payload');
      }
    });

    it('should reject missing eventId or driverId', () => {
      const withoutEventId = { ...validCanonicalPayload, eventId: '' };
      expect(service.processMessage(JSON.stringify(withoutEventId)).type).toBe('INVALID_PAYLOAD');

      const withoutDriverId = { ...validCanonicalPayload, driverId: '   ' };
      expect(service.processMessage(JSON.stringify(withoutDriverId)).type).toBe('INVALID_PAYLOAD');
    });

    it('should reject coordinates outside valid bounds', () => {
      const invalidLat = { ...validCanonicalPayload, latitude: 95.0 };
      expect(service.processMessage(JSON.stringify(invalidLat)).type).toBe('INVALID_PAYLOAD');

      const invalidLng = { ...validCanonicalPayload, longitude: -185.0 };
      expect(service.processMessage(JSON.stringify(invalidLng)).type).toBe('INVALID_PAYLOAD');
    });

    it('should reject non-finite coordinates', () => {
      const nanLat = { ...validCanonicalPayload, latitude: 'not-a-number' as any };
      expect(service.processMessage(JSON.stringify(nanLat)).type).toBe('INVALID_PAYLOAD');
    });
  });

  describe('Clock Skew handling (D02 & SD05)', () => {
    const baseTimeMs = 1760800000000;
    const baseReceivedAtIso = new Date(baseTimeMs).toISOString();

    it('should mark event as history-only if clientTimestamp is slightly in the future (<= 60s)', () => {
      // 30 seconds into future (<= 60s tolerance)
      const payload = {
        eventId: 'evt_skew_tolerance',
        driverId: 'drv_003',
        lat: 21.0285,
        lng: 105.8542,
        clientTimestamp: baseTimeMs + 30000,
        receivedAt: baseReceivedAtIso,
      };

      const result = service.processMessage(JSON.stringify(payload));
      expect(result.type).toBe('VALID_GPS');
      if (result.type === 'VALID_GPS') {
        expect(result.isHistoryOnly).toBe(true);
        expect(result.clockSkew).toBe(true);
      }
    });

    it('should reject event if clock skew exceeds 60 seconds', () => {
      // 61 seconds into future (> 60s tolerance)
      const payload = {
        eventId: 'evt_skew_exceeded',
        driverId: 'drv_003',
        lat: 21.0285,
        lng: 105.8542,
        clientTimestamp: baseTimeMs + 61000,
        receivedAt: baseReceivedAtIso,
      };

      const result = service.processMessage(JSON.stringify(payload));
      expect(result.type).toBe('CLOCK_SKEW_EXCEEDED');
      if (result.type === 'CLOCK_SKEW_EXCEEDED') {
        expect(result.error).toContain('exceeds receivedAt');
      }
    });
  });
});

