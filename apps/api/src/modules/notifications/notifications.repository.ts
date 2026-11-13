import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { Pool } from 'pg';
import { logDependencyFailure } from '../../common/dependency-diagnostics';
import { USER_DATABASE } from '../users/user-database.provider';
import type { NotificationQuery } from './dto/notification-query';
import type { NotificationKind } from './dto/notification-response.dto';

export interface NotificationRow {
  id: string;
  shipmentId: string;
  trackingCode: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: Date;
  cursorCreatedAt: string;
}

@Injectable()
export class NotificationsRepository {
  private readonly logger = new Logger(NotificationsRepository.name);
  constructor(@Inject(USER_DATABASE) private readonly pool: Pool | null) {}

  async list(customerId: string, query: NotificationQuery): Promise<NotificationRow[]> {
    if (!this.pool) {
      logDependencyFailure(this.logger, 'notifications.list', { code: 'DATABASE_URL_MISSING' });
      throw new ServiceUnavailableException();
    }
    try {
      // limit + 1 detects another page without a total count; microseconds survive in cursorCreatedAt.
      const result = await this.pool.query<NotificationRow>(`
        SELECT n.id, n."shipmentId", s."trackingCode", n.kind, n.title, n.body, n."createdAt",
          to_char(n."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorCreatedAt"
        FROM notifications n
        JOIN shipments s ON s.id = n."shipmentId"
        WHERE n."customerId" = $1
          AND ($2::timestamptz IS NULL OR (n."createdAt", n.id) < ($2::timestamptz, $3::uuid))
        ORDER BY n."createdAt" DESC, n.id DESC
        LIMIT $4
      `, [customerId, query.after?.createdAt ?? null, query.after?.id ?? null, query.limit + 1]);
      return result.rows;
    } catch (error) {
      logDependencyFailure(this.logger, 'notifications.list', error);
      throw new ServiceUnavailableException();
    }
  }
}
