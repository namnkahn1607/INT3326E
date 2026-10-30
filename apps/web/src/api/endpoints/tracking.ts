import { ApiError, apiClient } from '../client'
import { isCoordinates, isShipmentId, isUserId } from './shipments'
import { SHIPMENT_STATUS_MAP, type ShipmentStatus } from '../../types/shipment'
import type { Coordinates } from '../../types/shipment-api'

export interface TrackingData {
  shipmentId: string
  status: ShipmentStatus
  driverId: string | null
  pickupLocation: Coordinates
  dropoffLocation: Coordinates
  currentDriverLocation: Coordinates | null
  lastLocationUpdatedAt: string | null
  locationClientTimestamp: string | null
  isLocationStale: boolean | null
  eta: {
    distanceMeters: number
    estimatedSeconds: number
    estimatedArrivalAt: string
  } | null
  etaUnavailableReason: 'NOT_PICKED_UP' | 'LOCATION_MISSING' | 'LOCATION_STALE' | 'CONFIG_INVALID' | null
  expectedDeliveryAt: string | null
  isLate: boolean | null
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const keys = ['shipmentId', 'status', 'driverId', 'pickupLocation', 'dropoffLocation', 'currentDriverLocation',
  'lastLocationUpdatedAt', 'locationClientTimestamp', 'isLocationStale', 'eta', 'etaUnavailableReason', 'expectedDeliveryAt', 'isLate']

function parseTracking(value: unknown, id: string): TrackingData {
  const invalid = () => new ApiError(0, 'INVALID_RESPONSE')
  if (!object(value) || !exact(value, keys) || value.shipmentId !== id ||
    typeof value.status !== 'string' || !Object.hasOwn(SHIPMENT_STATUS_MAP, value.status) ||
    !(value.driverId === null || isUserId(value.driverId)) ||
    (value.status === 'CREATED') !== (value.driverId === null) ||
    !isCoordinates(value.pickupLocation) || !isCoordinates(value.dropoffLocation) ||
    !(value.expectedDeliveryAt === null || timestamp(value.expectedDeliveryAt)) ||
    !(value.isLate === null || typeof value.isLate === 'boolean') ||
    (value.expectedDeliveryAt === null) !== (value.isLate === null)) throw invalid()
  const hidden = !['ASSIGNED', 'PICKED_UP'].includes(value.status)
  if (value.currentDriverLocation === null) {
    if ([value.lastLocationUpdatedAt, value.locationClientTimestamp, value.isLocationStale].some(field => field !== null)) throw invalid()
  } else if (hidden || !isCoordinates(value.currentDriverLocation) || !timestamp(value.lastLocationUpdatedAt) ||
    !timestamp(value.locationClientTimestamp) || typeof value.isLocationStale !== 'boolean' ||
    Date.parse(value.locationClientTimestamp) > Date.parse(value.lastLocationUpdatedAt)) throw invalid()
  if (value.eta !== null) {
    if (value.status !== 'PICKED_UP' || value.currentDriverLocation === null || value.isLocationStale !== false ||
      value.etaUnavailableReason !== null || !object(value.eta) ||
      !exact(value.eta, ['distanceMeters', 'estimatedSeconds', 'estimatedArrivalAt']) ||
      typeof value.eta.distanceMeters !== 'number' || !Number.isFinite(value.eta.distanceMeters) || value.eta.distanceMeters < 0 ||
      !Number.isSafeInteger(value.eta.estimatedSeconds) || (value.eta.estimatedSeconds as number) < 0 ||
      !timestamp(value.eta.estimatedArrivalAt)) throw invalid()
  } else {
    const reason = value.status !== 'PICKED_UP' ? 'NOT_PICKED_UP' : value.currentDriverLocation === null ? 'LOCATION_MISSING'
      : value.isLocationStale ? 'LOCATION_STALE' : 'CONFIG_INVALID'
    if (value.etaUnavailableReason !== reason) throw invalid()
  }
  return value as unknown as TrackingData
}

export async function getShipmentTracking(
  shipmentId: string,
  token?: string | null,
  signal?: AbortSignal
): Promise<TrackingData> {
  if (!isShipmentId(shipmentId)) throw new ApiError(400, 'INVALID_SHIPMENT_ID')
  const value = await apiClient<unknown>(`/shipments/${encodeURIComponent(shipmentId)}/tracking`, { token, signal, expectedStatus: 200 })
  return parseTracking(value, shipmentId)
}
