import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PubSub, Message } from '@google-cloud/pubsub';

@Injectable()
export class GpsSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GpsSubscriber.name);
  private pubSubClient: PubSub;
  private subscription: any;

  onModuleInit() {
    const subscriptionName = process.env.PUBSUB_SUBSCRIPTION || 'gps-events-sub';

    this.pubSubClient = new PubSub({
      projectId: process.env.GCP_PROJECT_ID || 'parcelflow-gps-worker',
    });

    this.logger.log(`Đang kết nối tới Pub/Sub Subscription: ${subscriptionName}`);

    this.subscription = this.pubSubClient.subscription(subscriptionName);

    // Lắng nghe sự kiện đẩy về từ Pub/Sub
    this.subscription.on('message', (message: Message) => {
      this.logger.log(`[Pub/Sub Received] ID: ${message.id} | Data: ${message.data.toString()}`);
      
      // Xác nhận đã nhận tin nhắn (Ack)
      message.ack();
    });

    this.subscription.on('error', (error: Error) => {
      this.logger.error(`[Pub/Sub Error] ${error.message}`, error.stack);
    });
  }

  onModuleDestroy() {
    if (this.subscription) {
      this.subscription.removeAllListeners('message');
      this.subscription.removeAllListeners('error');
    }
  }
}