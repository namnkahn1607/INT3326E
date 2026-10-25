import type { Coordinates } from './shipment-api'

export interface DriverResponse {
  id: string
  name: string
  activeShipmentCount: number
  currentLocation: Coordinates | null
  lastLocationUpdatedAt: string | null
  locationClientTimestamp: string | null
  isLocationStale: boolean | null
}

export interface DriverPage {
  data: DriverResponse[]
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null }
}
