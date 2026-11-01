import { ServiceUnavailableException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { BUSINESS_USER_ID, SHIPMENT_ID } from './dto/shipment-list-query';
import { SHIPMENT_STATUSES, type ShipmentResponseDto, type ShipmentStatus } from './dto/shipment-response.dto';

export interface ShipmentRow extends QueryResultRow {
  id: string; trackingCode: string; senderId: string; driverId: string | null; status: ShipmentStatus;
  pickupAddress: string; pickupLat: number; pickupLng: number;
  deliveryAddress: string; deliveryLat: number; deliveryLng: number;
  recipientName: string; recipientPhone: string; notes: string | null;
  packageDescription: string | null; packageWeightKg: number | null; expectedDeliveryAt: Date | null;
  failureReason: string | null; failedByRole: 'DRIVER' | 'ADMIN' | null; failedByUserId: string | null;
  proofOfDeliveryNotes: string | null; createdAt: Date; updatedAt: Date;
  cursorCreatedAt: string; observedAt: Date; terminalAt: Date | null;
}

// Đơn đã kết thúc: tính giao trễ theo sự kiện kết thúc, tránh đổi kết quả khi đọc lại sau đó.
export const SHIPMENT_PROJECTION = `s.*,
  to_char(s."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorCreatedAt",
  statement_timestamp() AS "observedAt",
  (SELECT e."occurredAt" FROM shipment_status_events e
   WHERE e."shipmentId" = s.id AND e.action::text = s.status::text AND e."toStatus"::text = s.status::text
     AND e.action IN ('DELIVERED', 'DELIVERY_FAILED')
   ORDER BY e."occurredAt", e.id LIMIT 1) AS "terminalAt"`;

const iso = (value: Date) => new Date(value).toISOString();

export function shipmentResponse(row: ShipmentRow): ShipmentResponseDto {
  const terminal = row.status === 'DELIVERED' || row.status === 'DELIVERY_FAILED';
  if (!SHIPMENT_ID.test(row.id) || !BUSINESS_USER_ID.test(row.senderId) ||
      !SHIPMENT_STATUSES.includes(row.status) || (row.status === 'CREATED') !== (row.driverId === null) ||
      (row.driverId !== null && !BUSINESS_USER_ID.test(row.driverId)) || (terminal && !row.terminalAt)) {
    throw new ServiceUnavailableException();
  }
  const comparisonTime = terminal ? row.terminalAt! : row.observedAt;
  // Ánh xạ rõ từng trường để response đúng contract và không lộ cột nội bộ của database.
  return {
    id: row.id, trackingNumber: row.trackingCode, customerId: row.senderId, driverId: row.driverId, status: row.status,
    pickupAddress: row.pickupAddress, pickupLocation: { lat: row.pickupLat, lng: row.pickupLng },
    dropoffAddress: row.deliveryAddress, dropoffLocation: { lat: row.deliveryLat, lng: row.deliveryLng },
    recipientName: row.recipientName, recipientPhone: row.recipientPhone, notes: row.notes,
    packageDescription: row.packageDescription, packageWeightKg: row.packageWeightKg,
    expectedDeliveryAt: row.expectedDeliveryAt === null ? null : iso(row.expectedDeliveryAt),
    isLate: row.expectedDeliveryAt === null ? null : new Date(comparisonTime).getTime() > new Date(row.expectedDeliveryAt).getTime(),
    failureReason: row.failureReason, failedByRole: row.failedByRole, failedByUserId: row.failedByUserId,
    proofOfDeliveryNotes: row.proofOfDeliveryNotes, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
  };
}
