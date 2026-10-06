import { apiClient } from '../client'

export interface TrackingData {
  shipmentId: string
  status: string
  driverId?: string
  currentDriverLocation?: {
    lat: number
    lng: number
  }
  lastLocationUpdatedAt?: string
  eta?: {
    distanceMeters: number
    estimatedSeconds: number
    estimatedArrivalAt: string
  }
}

export async function getShipmentTracking(
  shipmentId: string,
  token?: string | null
): Promise<TrackingData> {
  return apiClient<TrackingData>(`/shipments/${shipmentId}/tracking`, { token })
}
