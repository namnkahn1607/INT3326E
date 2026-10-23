import type { ShipmentStatus } from './shipment'

export interface Coordinates { lat: number; lng: number }
export interface CreateShipmentPayload {
  pickupAddress: string
  pickupLocation: Coordinates
  dropoffAddress: string
  dropoffLocation: Coordinates
  recipientName: string
  recipientPhone: string
  notes?: string
  packageDescription?: string
  packageWeightKg?: number
  expectedDeliveryAt?: string
}
export interface ShipmentResponse {
  id: string
  trackingNumber: string
  customerId: string
  driverId: string | null
  status: ShipmentStatus
  pickupAddress: string
  pickupLocation: Coordinates
  dropoffAddress: string
  dropoffLocation: Coordinates
  recipientName: string
  recipientPhone: string
  notes: string | null
  packageDescription: string | null
  packageWeightKg: number | null
  expectedDeliveryAt: string | null
  isLate: boolean | null
  failureReason: string | null
  failedByRole: 'DRIVER' | 'ADMIN' | null
  failedByUserId: string | null
  proofOfDeliveryNotes: string | null
  createdAt: string
  updatedAt: string
}
export interface StatusEventResponse {
  id: string; shipmentId: string
  action: ShipmentStatus | 'REASSIGNED'
  fromStatus: ShipmentStatus | null; toStatus: ShipmentStatus
  actorUserId: string; actorRole: 'CUSTOMER' | 'DRIVER' | 'ADMIN'
  previousDriverId: string | null; newDriverId: string | null
  reason: string | null; occurredAt: string
}
export interface ShipmentDetail extends ShipmentResponse { statusHistory: StatusEventResponse[] }
export interface ShipmentPage {
  data: ShipmentResponse[]
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null }
}
