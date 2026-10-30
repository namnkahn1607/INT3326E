import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PubSub, Message } from '@google-cloud/pubsub';
import { GpsProcessorService } from './gps-processor.service';
import { GpsWriterRepository } from '../storage/gps-writer.repository';

@Injectable()
export class GpsSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GpsSubscriber.name);
  private pubSubClient: PubSub;
  private subscription: any;

  constructor(
    private readonly processor: GpsProcessorService,
    private readonly repository: GpsWriterRepository,
  ) {}

  onModuleInit() {
    const subscriptionName =
      process.env.PUBSUB_SUBSCRIPTION ||
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
          this.logger.error(
            `[GPS Persistence Failed] ID: ${message.id} - ${error.message}. Transaction rolled back; message not acknowledged.`,
            error.stack,
          );
          if (typeof message.nack === 'function') {
            message.nack();
          }
          throw error;
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

  onModuleDestroy() {
    if (this.subscription) {
      this.subscription.removeAllListeners('message');
      this.subscription.removeAllListeners('error');
    }
  }
}
