import { Injectable, Logger } from '@nestjs/common';

export interface NormalizedGpsEvent {
  eventId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  lat: number;
  lng: number;
  clientTimestamp: number; // UTC Epoch ms
  clientTimestampIso: string;
  receivedAt: string; // ISO 8601
  receivedAtMs: number;
  sessionId?: string;
  seq?: number;
}

export type GpsProcessingResult =
  | { type: 'HELLO_WORLD'; raw: string }
  | { type: 'VALID_GPS'; event: NormalizedGpsEvent; isHistoryOnly: boolean; clockSkew: boolean }
  | { type: 'CLOCK_SKEW_EXCEEDED'; error: string; rawEvent?: Record<string, any> }
  | { type: 'INVALID_PAYLOAD'; error: string; raw?: string };

@Injectable()
export class GpsProcessorService {
  private readonly logger = new Logger(GpsProcessorService.name);

  // Maximum allowed future clock skew tolerance in milliseconds (60 seconds per D02 & EVT01 spec)
  private readonly MAX_CLOCK_SKEW_MS = 60000;

  processMessage(raw: string | Buffer | object): GpsProcessingResult {
    const rawString = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString('utf-8') : null;

    // 1. Check for legacy Hello World probe
    if (rawString && rawString.trim() === 'Hello World') {
      return { type: 'HELLO_WORLD', raw: rawString.trim() };
    }

    // 2. Parse payload
    let data: any;
    if (rawString !== null) {
      try {
        data = JSON.parse(rawString);
      } catch {
        return { type: 'INVALID_PAYLOAD', error: 'Malformed JSON payload', raw: rawString };
      }
    } else if (typeof raw === 'object' && raw !== null) {
      data = raw;
    } else {
      return { type: 'INVALID_PAYLOAD', error: 'Unsupported message payload type' };
    }

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { type: 'INVALID_PAYLOAD', error: 'GPS payload must be a JSON object' };
    }

    // 3. Validate required identifiers
    const eventId = data.eventId;
    if (typeof eventId !== 'string' || !eventId.trim()) {
      return { type: 'INVALID_PAYLOAD', error: 'Missing or invalid eventId' };
    }

    const driverId = data.driverId;
    if (typeof driverId !== 'string' || !driverId.trim()) {
      return { type: 'INVALID_PAYLOAD', error: 'Missing or invalid driverId' };
    }

    // 4. Validate coordinates (accept latitude/longitude or lat/lng)
    const lat = typeof data.latitude === 'number' ? data.latitude : data.lat;
    const lng = typeof data.longitude === 'number' ? data.longitude : data.lng;

    if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
      return { type: 'INVALID_PAYLOAD', error: `Invalid latitude: ${lat}. Must be a finite number between -90 and 90` };
    }

    if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return { type: 'INVALID_PAYLOAD', error: `Invalid longitude: ${lng}. Must be a finite number between -180 and 180` };
    }

    // 5. Parse and validate timestamps
    const rawClientTimestamp = data.clientTimestamp;
    let clientTimestampMs: number;
    let clientTimestampIso: string;

    if (typeof rawClientTimestamp === 'number' && Number.isFinite(rawClientTimestamp) && rawClientTimestamp > 0) {
      clientTimestampMs = Math.floor(rawClientTimestamp);
      clientTimestampIso = new Date(clientTimestampMs).toISOString();
    } else if (typeof rawClientTimestamp === 'string' && !isNaN(Date.parse(rawClientTimestamp))) {
      clientTimestampMs = Date.parse(rawClientTimestamp);
      clientTimestampIso = new Date(clientTimestampMs).toISOString();
    } else {
      return { type: 'INVALID_PAYLOAD', error: 'Missing or invalid clientTimestamp' };
    }

    const rawReceivedAt = data.receivedAt;
    let receivedAtMs: number;
    let receivedAtIso: string;

    if (typeof rawReceivedAt === 'number' && Number.isFinite(rawReceivedAt) && rawReceivedAt > 0) {
      receivedAtMs = Math.floor(rawReceivedAt);
      receivedAtIso = new Date(receivedAtMs).toISOString();
    } else if (typeof rawReceivedAt === 'string' && !isNaN(Date.parse(rawReceivedAt))) {
      receivedAtMs = Date.parse(rawReceivedAt);
      receivedAtIso = new Date(receivedAtMs).toISOString();
    } else {
      // Default to current server time if missing on ingested message
      receivedAtMs = Date.now();
      receivedAtIso = new Date(receivedAtMs).toISOString();
    }

    // 6. Optional diagnostics metadata
    const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : undefined;
    const seq = Number.isInteger(data.seq) && data.seq > 0 ? data.seq : undefined;

    // 7. Clock skew validation (Section 5.1 & 5.3)
    // t > r + 60s: clock skew exceeded -> reject
    if (clientTimestampMs > receivedAtMs + this.MAX_CLOCK_SKEW_MS) {
      return {
        type: 'CLOCK_SKEW_EXCEEDED',
        error: `clientTimestamp (${clientTimestampIso}) exceeds receivedAt (${receivedAtIso}) by more than ${this.MAX_CLOCK_SKEW_MS / 1000}s`,
        rawEvent: data,
      };
    }

    // r < t <= r + 60s: within tolerance but future -> history-only (cannot occupy current_location)
    const clockSkew = clientTimestampMs > receivedAtMs;
    const isHistoryOnly = clockSkew;

    const event: NormalizedGpsEvent = {
      eventId: eventId.trim(),
      driverId: driverId.trim(),
      latitude: lat,
      longitude: lng,
      lat,
      lng,
      clientTimestamp: clientTimestampMs,
      clientTimestampIso,
      receivedAt: receivedAtIso,
      receivedAtMs,
      sessionId,
      seq,
    };

    return {
      type: 'VALID_GPS',
      event,
      isHistoryOnly,
      clockSkew,
    };
  }
}

