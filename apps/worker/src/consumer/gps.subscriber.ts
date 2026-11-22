import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PubSub, Message } from '@google-cloud/pubsub';
import { GpsProcessorService } from './gps-processor.service';
import { GpsWriterRepository } from '../storage/gps-writer.repository';

/**
 * PostgreSQL SQLSTATE codes that indicate a permanent (non-retryable) error.
 * These errors will not resolve on retry, so the message should be published
 * to gps-events-dlq and then ACKed instead of being NACKed for redelivery.
 */
const PERMANENT_PG_ERROR_CLASSES = new Set([
  '23503', // foreign_key_violation
  '23502', // not_null_violation
  '23514', // check_violation
  '23P01', // exclusion_violation
]);

/** Returns true when the error is permanent and retrying will never succeed. */
export function isPermanentDatabaseError(error: any): boolean {
  const code: string | undefined = error?.code;
  if (!code || typeof code !== 'string') return false;
  return PERMANENT_PG_ERROR_CLASSES.has(code);
}

@Injectable()
export class GpsSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GpsSubscriber.name);
  private pubSubClient: PubSub;
  private subscription: any;
  private dlqTopic: any;

  constructor(
    private readonly processor: GpsProcessorService,
    private readonly repository: GpsWriterRepository,
  ) {}

  setDlqTopic(topic: any): void {
    this.dlqTopic = topic;
  }

  onModuleInit() {
    const subscriptionName =
      process.env.PUBSUB_SUB_GPS_EVENTS ||
      'gps-events-sub';


    this.pubSubClient = new PubSub({
      projectId:
        process.env.GCP_PROJECT_ID ||
        process.env.PUBSUB_PROJECT_ID ||
        'int3326e',
    });

    this.logger.log(`Đang kết nối tới Pub/Sub Subscription: ${subscriptionName}`);

    this.subscription = this.pubSubClient.subscription(subscriptionName);

    const dlqTopicName =
      process.env.PUBSUB_TOPIC_GPS_DLQ ||
      'gps-events-dlq';
    this.dlqTopic = this.pubSubClient.topic(dlqTopicName);

    // Lắng nghe sự kiện đẩy về từ Pub/Sub
    this.subscription.on('message', async (message: Message) => {
      try {
        await this.handleIncomingMessage(message);
      } catch (error: any) {
        this.logger.error(`[Pub/Sub Unhandled Processing Error] ID: ${message.id} - ${error.message}`, error.stack);
      }
    });

    this.subscription.on('error', (error: Error) => {
      this.logger.error(`[Pub/Sub Connection Error] ${error.message}`, error.stack);
    });
  }

  async handleIncomingMessage(
    message: Message | { id: string; data: Buffer; ack: () => void; nack?: () => void },
  ): Promise<void> {
    const rawData = message.data.toString('utf-8');
    const result = this.processor.processMessage(rawData);

    switch (result.type) {
      case 'HELLO_WORLD':
        // Log riêng biệt cho tin nhắn Hello World probe (tuần 1)
        this.logger.log(`[Hello World Received] ID: ${message.id} | Body: ${result.raw}`);
        message.ack();
        break;

      case 'VALID_GPS': {
        const { event, isHistoryOnly, clockSkew } = result;
        const tag = clockSkew ? ' [history-only: clock_skew]' : '';
        this.logger.log(
          `[EVT01 GPS Event] ID: ${message.id} | eventId: ${event.eventId} | driverId: ${event.driverId} | coords: (${event.lat}, ${event.lng}) | time: ${event.clientTimestampIso}${tag}`,
        );

        try {
          // Lưu dữ liệu vào repository GPS (Transaction atomic)
          await this.repository.recordGpsEvent(event, isHistoryOnly);

          // Quy tắc D08: Chỉ ACK sau khi commit database thành công
          message.ack();
        } catch (error: any) {
          if (isPermanentDatabaseError(error)) {
            // (1) Lỗi vĩnh viễn (FK violation 23503...): Publish sang gps-events-dlq rồi mới ACK
            this.logger.error(
              `[GPS Persistence Permanent] ID: ${message.id} | code: ${error.code} - ${error.message}. Publishing to DLQ before ACK.`,
              error.stack,
            );
            try {
              await this.forwardToDlq(message, error);
            } catch (dlqErr: any) {
              // Chưa đưa được vào DLQ thì không ACK: NACK để Pub/Sub thử lại, hết maxDeliveryAttempts sẽ tự chuyển DLQ.
              this.logger.error(
                `[DLQ Publish Failed] ID: ${message.id} - ${dlqErr.message}. NACKing so the message is not lost.`,
                dlqErr.stack,
              );
              if (typeof message.nack === 'function') message.nack();
              break;
            }
            message.ack();
          } else {
            // Lỗi tạm thời (connection timeout, ECONNREFUSED…): NACK để Pub/Sub redeliver.
            this.logger.error(
              `[GPS Persistence Failed] ID: ${message.id} - ${error.message}. Transaction rolled back; message not acknowledged.`,
              error.stack,
            );
            if (typeof message.nack === 'function') {
              message.nack();
            }
            throw error;
          }
        }
        break;
      }

      case 'CLOCK_SKEW_EXCEEDED':
        // Lỗi độ lệch thời gian vượt quá 60s so với receivedAt (theo SD05 / D02)
        this.logger.warn(`[EVT01 Clock Skew Exceeded] ID: ${message.id} | ${result.error}`);
        message.ack();
        break;

      case 'INVALID_PAYLOAD':
        // Lỗi payload sai định dạng hoặc thiếu trường bắt buộc
        this.logger.error(`[EVT01 Invalid Payload] ID: ${message.id} | ${result.error}`);
        message.ack();
        break;
    }
  }

  async forwardToDlq(
    message: Message | { id: string; data: Buffer; ack: () => void; nack?: () => void },
    error: any,
  ): Promise<void> {
    if (!this.dlqTopic && this.pubSubClient) {
      const dlqTopicName = process.env.PUBSUB_TOPIC_GPS_DLQ || 'gps-events-dlq';
      this.dlqTopic = this.pubSubClient.topic(dlqTopicName);
    }
    if (!this.dlqTopic || typeof this.dlqTopic.publishMessage !== 'function') {
      throw new Error('DLQ topic is not configured');
    }
    const dataBuffer = Buffer.isBuffer(message.data)
      ? message.data
      : Buffer.from(typeof message.data === 'string' ? message.data : JSON.stringify(message.data), 'utf-8');
    await this.dlqTopic.publishMessage({
      data: dataBuffer,
      attributes: {
        originalMessageId: String(message.id),
        errorCode: String(error?.code || 'UNKNOWN'),
        errorMessage: String(error?.message || ''),
        failedAt: new Date().toISOString(),
      },
    });
    this.logger.log(`[DLQ Forwarded] ID: ${message.id} -> gps-events-dlq | code: ${error?.code}`);
  }

  onModuleDestroy() {
    if (this.subscription) {
      this.subscription.removeAllListeners('message');
      this.subscription.removeAllListeners('error');
    }
  }
}
