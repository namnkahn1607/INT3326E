import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PubSub, Topic } from '@google-cloud/pubsub';
import { randomUUID } from 'node:crypto';
import { IngestLocationDto } from './dto/ingest-location.dto';

export interface AsyncAcceptedResponse {
  status: 'ACCEPTED';
  eventId: string;
  receivedAt: string;
}

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);
  private pubSubClient: PubSub;
  private topic: Topic;
  private readonly MAX_CLOCK_SKEW_MS = 60000;

  constructor() {
    const projectId = process.env.GCP_PROJECT_ID || process.env.PUBSUB_PROJECT_ID || 'int3326e';
    const topicName = process.env.PUBSUB_TOPIC_GPS_EVENTS || 'gps-events';


    this.pubSubClient = new PubSub({ projectId });
    this.topic = this.pubSubClient.topic(topicName);
  }

  setTopic(topic: any): void {
    this.topic = topic;
  }

  async ingestLocation(dto: IngestLocationDto, authenticatedDriverId?: string): Promise<AsyncAcceptedResponse> {
    const serverNow = Date.now();
    const receivedAt = new Date(serverNow).toISOString();

    // 1. Resolve coordinates
    const lat = typeof dto.lat === 'number' ? dto.lat : dto.latitude;
    const lng = typeof dto.lng === 'number' ? dto.lng : dto.longitude;

    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Coordinates (lat, lng) are required and must be finite numbers');
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException('Coordinates out of range (lat: [-90, 90], lng: [-180, 180])');
    }

    // 2. Parse clientTimestamp (supports number ms or ISO string)
    let clientTimestampMs: number;
    let clientTimestampIso: string;
    if (typeof dto.clientTimestamp === 'number' && Number.isFinite(dto.clientTimestamp) && dto.clientTimestamp > 0) {
      clientTimestampMs = Math.floor(dto.clientTimestamp);
      clientTimestampIso = new Date(clientTimestampMs).toISOString();
    } else if (typeof dto.clientTimestamp === 'string' && !isNaN(Date.parse(dto.clientTimestamp))) {
      clientTimestampMs = Date.parse(dto.clientTimestamp);
      clientTimestampIso = new Date(clientTimestampMs).toISOString();
    } else {
      throw new BadRequestException('clientTimestamp must be a valid UTC timestamp (number ms or ISO string)');
    }

    // 3. Clock skew validation per Section 5.1 (t > r + 60s -> 400 Bad Request, do not publish)
    if (clientTimestampMs > serverNow + this.MAX_CLOCK_SKEW_MS) {
      throw new BadRequestException(
        `clientTimestamp (${clientTimestampIso}) exceeds receivedAt (${receivedAt}) by more than ${this.MAX_CLOCK_SKEW_MS / 1000}s`,
      );
    }

    // 4. Resolve driverId
    const driverId = authenticatedDriverId || dto.driverId;
    if (!driverId || !driverId.trim()) {
      throw new BadRequestException('driverId is required (must be authenticated as DRIVER or provide driverId)');
    }

    // 5. Construct canonical EVT01 payload
    const eventId = `evt_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const eventPayload = {
      eventId,
      driverId: driverId.trim(),
      lat,
      lng,
      latitude: lat,
      longitude: lng,
      clientTimestamp: clientTimestampMs,
      clientTimestampIso,
      receivedAt,
      receivedAtMs: serverNow,
      sessionId: dto.sessionId?.trim() || undefined,
      seq: dto.seq && dto.seq > 0 ? dto.seq : undefined,
    };

    // 6. Publish to Pub/Sub with broker confirmation (TC04.2)
    try {
      const dataBuffer = Buffer.from(JSON.stringify(eventPayload), 'utf-8');
      await this.topic.publishMessage({ data: dataBuffer });
      this.logger.log(`[API08 Broker Confirmed] eventId: ${eventId} | driver: ${driverId} | coords: (${lat}, ${lng})`);
    } catch (error: any) {
      this.logger.error(`[API08 Publish Failed] Error publishing event ${eventId}: ${error.message}`);
      throw new ServiceUnavailableException('GPS broker temporarily unavailable');
    }

    // 7. Return SC04 AsyncAcceptedResponse
    return {
      status: 'ACCEPTED',
      eventId,
      receivedAt,
    };
  }
}

