import { HttpException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Pool } from 'pg';
import { ApiProblem } from '../../common/api-problem';
import type { ShipmentTrackingResponse } from '../location/dto/tracking-response.dto';
import type { BusinessUser } from '../users/entities/user.entity';
import { USER_DATABASE } from '../users/user-database.provider';
import { encodeShipmentCursor, shipmentScope, type ShipmentListQuery } from './dto/shipment-list-query';
import type { ShipmentDetailDto } from './dto/shipment-response.dto';
import { SHIPMENT_PROJECTION, shipmentResponse, shipmentTrackingResponse, type ShipmentRow, type ShipmentTrackingRow } from './shipment-response.mapper';

@Injectable()
export class ShipmentsReadRepository {
  constructor(@Inject(USER_DATABASE) private readonly pool: Pool | null) {}

  async list(actor: BusinessUser, query: ShipmentListQuery) {
    if (!this.pool) throw new ServiceUnavailableException();
    try {
      const result = await this.pool.query<ShipmentRow>(`
        SELECT ${SHIPMENT_PROJECTION} FROM shipments s
        WHERE ($1::text = 'ADMIN' OR ($1 = 'CUSTOMER' AND s."senderId" = $2)
          OR ($1 = 'DRIVER' AND s."driverId" = $2))
          AND ($3::text IS NULL OR s.status::text = $3::text)
          AND ($4::text IS NULL OR s."trackingCode" = $4)
          AND ($5::timestamptz IS NULL OR (s."createdAt", s.id) < ($5::timestamptz, $6::text))
        ORDER BY s."createdAt" DESC, s.id DESC LIMIT $7`,
      [...shipmentScope(actor), query.status, query.trackingNumber, query.after?.createdAt ?? null,
        query.after?.id ?? null, query.limit + 1]);
      const hasMore = result.rows.length > query.limit;
      const page = result.rows.slice(0, query.limit);
      const last = page.at(-1);
      return { data: page.map(shipmentResponse), pagination: { limit: query.limit, hasMore,
        nextCursor: hasMore && last ? encodeShipmentCursor(actor, query, { createdAt: last.cursorCreatedAt, id: last.id }) : null } };
    } catch {
      throw new ServiceUnavailableException();
    }
  }

  async detail(actor: BusinessUser, id: string): Promise<ShipmentDetailDto> {
    if (!this.pool) throw new ServiceUnavailableException();
    try {
      // Một câu SQL đọc cùng phiên bản dữ liệu cho tài xế, quyền xem và lịch sử, tránh lệch khi gán lại.
      const { rows } = await this.pool.query<ShipmentRow & { allowed: boolean; statusHistory: ShipmentDetailDto['statusHistory'] }>(`
        SELECT ${SHIPMENT_PROJECTION},
          ($2::text = 'ADMIN' OR ($2 = 'CUSTOMER' AND s."senderId" = $3)
            OR ($2 = 'DRIVER' AND s."driverId" = $3)) AS allowed,
          COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id', e.id, 'shipmentId', e."shipmentId", 'action', e.action,
            'fromStatus', e."fromStatus", 'toStatus', e."toStatus",
            'actorUserId', e."actorUserId", 'actorRole', e."actorRole",
            'previousDriverId', e."previousDriverId", 'newDriverId', e."newDriverId", 'reason', e.reason,
            'occurredAt', to_char(e."occurredAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
            ORDER BY e."occurredAt", e.id)
            FROM shipment_status_events e WHERE e."shipmentId" = s.id), '[]'::jsonb) AS "statusHistory"
        FROM shipments s WHERE s.id = $1`, [id, ...shipmentScope(actor)]);
      const row = rows[0];
      if (!row) throw new ApiProblem(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy đơn hàng');
      if (!row.allowed) throw new ApiProblem(403, 'FORBIDDEN_RESOURCE', 'Không có quyền truy cập');
      return { ...shipmentResponse(row), statusHistory: row.statusHistory };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    }
  }

  async tracking(actor: BusinessUser, id: string): Promise<ShipmentTrackingResponse> {
    if (!this.pool) throw new ServiceUnavailableException();
    try {
      // Đọc đơn, quyền xem và vị trí hiện hành trong cùng một câu SQL (MVCC snapshot) để không lộ vị trí tài xế cũ sau khi gán lại.
      const { rows } = await this.pool.query<ShipmentTrackingRow & { allowed: boolean }>(`
        SELECT ${SHIPMENT_PROJECTION},
          ($2::text = 'ADMIN' OR ($2 = 'CUSTOMER' AND s."senderId" = $3)
            OR ($2 = 'DRIVER' AND s."driverId" = $3)) AS allowed,
          c."driverId" AS "locationDriverId",
          c.lat AS "currentLat",
          c.lng AS "currentLng",
          c."clientTimestamp" AS "locationClientTimestamp",
          c."receivedAt" AS "lastLocationUpdatedAt"
        FROM shipments s
        LEFT JOIN current_locations c ON c."driverId" = s."driverId"
        WHERE s.id = $1`, [id, ...shipmentScope(actor)]);
      const row = rows[0];
      if (!row) throw new ApiProblem(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy đơn hàng');
      if (!row.allowed) throw new ApiProblem(403, 'FORBIDDEN_RESOURCE', 'Không có quyền truy cập');
      return shipmentTrackingResponse(row);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    }
  }
}
