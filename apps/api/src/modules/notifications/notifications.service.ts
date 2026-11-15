import { Inject, Injectable } from '@nestjs/common';
import { encodeNotificationCursor, type NotificationQuery } from './dto/notification-query';
import type { NotificationPage } from './dto/notification-response.dto';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(@Inject(NotificationsRepository) private readonly repository: NotificationsRepository) {}

  async list(customerId: string, query: NotificationQuery): Promise<NotificationPage> {
    const rows = await this.repository.list(customerId, query);
    const items = rows.slice(0, query.limit);
    const hasMore = rows.length > query.limit;
    const last = items.at(-1);
    return {
      data: items.map((row) => ({
        id: row.id, shipmentId: row.shipmentId, trackingNumber: row.trackingCode, kind: row.kind,
        title: row.title, body: row.body, createdAt: row.createdAt.toISOString(),
      })),
      pagination: {
        limit: query.limit, hasMore,
        nextCursor: hasMore && last
          ? encodeNotificationCursor(customerId, { id: last.id, createdAt: last.cursorCreatedAt }) : null,
      },
    };
  }
}
