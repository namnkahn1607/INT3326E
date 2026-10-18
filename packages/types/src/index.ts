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

/**
 * EVT01 - GPS Telemetry payload sent by Driver App (Client).
 */
export interface GpsLocationPayload {
  /** [Bắt buộc] String - Mã định danh tài xế (VD: "drv_123456789") */
  driverId: string
  /** [Bắt buộc] Number (Float) - Tọa độ vĩ độ (VD: 21.028511) */
  latitude: number
  /** [Bắt buộc] Number (Float) - Tọa độ kinh độ (VD: 105.804817) */
  longitude: number
  /** [Bắt buộc] Number (Integer/Epoch MS) - Thời gian UTC mili-giây (VD: Date.now()) */
  clientTimestamp: number
  /** [Tùy chọn] String - Mã phiên di chuyển chẩn đoán (VD: "sess_987654321") */
  sessionId?: string
  /** [Tùy chọn] Number (Integer) - Số thứ tự gói tin trong phiên (VD: 1) */
  seq?: number
}

/**
 * Pub/Sub event schema published by API and consumed by GPS Worker.
 */
export interface GpsTelemetryEvent extends GpsLocationPayload {
  eventId: string
  receivedAt: string
  /** Tương thích ngược */
  lat?: number
  lng?: number
}

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
