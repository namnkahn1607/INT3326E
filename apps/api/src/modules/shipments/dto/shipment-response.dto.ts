import type { CreateShipmentDto } from './create-shipment.dto';

export const SHIPMENT_STATUSES = ['CREATED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'DELIVERY_FAILED'] as const;
export type ShipmentStatus = typeof SHIPMENT_STATUSES[number];

export interface ShipmentResponseDto extends CreateShipmentDto {
  id: string;
  trackingNumber: string;
  customerId: string;
  driverId: string | null;
  status: ShipmentStatus;
  isLate: boolean | null;
  failureReason: string | null;
  failedByRole: 'DRIVER' | 'ADMIN' | null;
  failedByUserId: string | null;
  proofOfDeliveryNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatusEventResponseDto {
  id: string;
  shipmentId: string;
  action: ShipmentStatus | 'REASSIGNED';
  fromStatus: ShipmentStatus | null;
  toStatus: ShipmentStatus;
  actorUserId: string;
  actorRole: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
  previousDriverId: string | null;
  newDriverId: string | null;
  reason: string | null;
  occurredAt: string;
}

export interface ShipmentDetailDto extends ShipmentResponseDto {
  statusHistory: StatusEventResponseDto[];
}
