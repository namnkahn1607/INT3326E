/**
 * Core shipment status enum (Single flow).
 * CREATED -> ASSIGNED -> PICKED_UP -> DELIVERED / DELIVERY_FAILED
 */
export type ShipmentStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'

export type UserRole = 'CUSTOMER' | 'DRIVER' | 'ADMIN'

export interface Coordinates {
  lat: number
  lng: number
}

export { MAX_GPS_SEQUENCE, assertGpsLocationRequest, assertGpsTelemetryEvent } from './gps'
export type { GpsLocationRequest, GpsTelemetryEvent } from './gps'

export interface ShipmentEntity {
  id: string
  trackingCode: string
  senderId: string
  driverId?: string | null
  status: ShipmentStatus
  pickupAddress: string
  pickupLocation: Coordinates
  deliveryAddress: string
  deliveryLocation: Coordinates
  packageDescription: string
  packageWeightKg: number
  createdAt: string
  updatedAt: string
}
