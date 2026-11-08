import type { CreateShipmentDto } from './create-shipment.dto';

export interface ShipmentResponseDto extends CreateShipmentDto {
  id: string;
  trackingNumber: string;
  customerId: string;
  driverId: null;
  status: 'CREATED';
  isLate: boolean | null;
  failureReason: null;
  failedByRole: null;
  failedByUserId: null;
  proofOfDeliveryNotes: null;
  createdAt: string;
  updatedAt: string;
}
