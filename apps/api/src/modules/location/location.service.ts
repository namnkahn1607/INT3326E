import { Injectable, Logger, OnModuleDestroy, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PubSub, Topic } from '@google-cloud/pubsub';
import { randomUUID } from 'node:crypto';
import { normalizeLocation } from './dto/ingest-location.dto';

export interface AsyncAcceptedResponse {
  status: 'ACCEPTED';
  eventId: string;
  receivedAt: string;
}

@Injectable()
export class LocationService implements OnModuleDestroy {
  private readonly logger = new Logger(LocationService.name);
  private pubSubClient: PubSub;
  private topic: Pick<Topic, 'publishMessage'>;
  private readonly MAX_CLOCK_SKEW_MS = 60000;

  constructor() {
    const projectId = process.env.GCP_PROJECT_ID || process.env.PUBSUB_PROJECT_ID || 'int3326e';
    const topicName = process.env.PUBSUB_TOPIC || process.env.PUBSUB_TOPIC_GPS_EVENTS || 'gps-events';

    this.pubSubClient = new PubSub({ projectId });
    this.topic = this.pubSubClient.topic(topicName);
  }

  setTopic(topic: Pick<Topic, 'publishMessage'>): void {
    this.topic = topic;
  }

  async ingestLocation(body: unknown, authenticatedDriverId: string): Promise<AsyncAcceptedResponse> {
    const serverNow = Date.now();
    const receivedAt = new Date(serverNow).toISOString();
    const dto = normalizeLocation(body);
    const clientTimestampMs = Date.parse(dto.clientTimestamp);

    if (clientTimestampMs > serverNow + this.MAX_CLOCK_SKEW_MS) {
      throw new BadRequestException('Thời gian GPS vượt quá thời gian máy chủ hơn 60 giây');
    }

    const eventId = `evt_${randomUUID()}`;
    // Chỉ publish các trường EVT01; mã Driver đến từ BusinessUserGuard.
    const eventPayload = { ...dto, eventId, driverId: authenticatedDriverId, receivedAt };

    // Chỉ trả 202 sau khi broker xác nhận; không tự gửi lại request REST.
    try {
      const dataBuffer = Buffer.from(JSON.stringify(eventPayload), 'utf-8');
      await this.topic.publishMessage({ data: dataBuffer });
      this.logger.log(`[API08 Broker Confirmed] eventId: ${eventId} | driver: ${authenticatedDriverId}`);
    } catch {
      this.logger.error(`Không publish được sự kiện GPS ${eventId}`);
      throw new ServiceUnavailableException('Dịch vụ gửi GPS tạm thời không khả dụng');
    }

    return {
      status: 'ACCEPTED',
      eventId,
      receivedAt,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.pubSubClient.close();
  }

}
