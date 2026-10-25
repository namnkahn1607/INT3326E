import { ApiError, apiClient } from '../client'
import { isCoordinates, isUserId } from './shipments'
import type { DriverPage, DriverResponse } from '../../types/driver-api'

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value))
const keys = ['id', 'name', 'activeShipmentCount', 'currentLocation', 'lastLocationUpdatedAt', 'locationClientTimestamp', 'isLocationStale']
const invalid = () => new ApiError(0, 'INVALID_RESPONSE')

function driver(value: unknown): DriverResponse {
  if (!object(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key)) ||
    !isUserId(value.id) || typeof value.name !== 'string' || !value.name.trim() ||
    !Number.isSafeInteger(value.activeShipmentCount) || (value.activeShipmentCount as number) < 0) throw invalid()
  const metadata = [value.lastLocationUpdatedAt, value.locationClientTimestamp, value.isLocationStale]
  if (value.currentLocation === null) {
    if (metadata.some(field => field !== null)) throw invalid()
  } else if (value.activeShipmentCount === 0 || !isCoordinates(value.currentLocation) ||
    !date(value.lastLocationUpdatedAt) || !date(value.locationClientTimestamp) || typeof value.isLocationStale !== 'boolean') throw invalid()
  return value as unknown as DriverResponse
}

export async function getDrivers(query: { limit?: number; cursor?: string } = {}, signal?: AbortSignal): Promise<DriverPage> {
  const params = new URLSearchParams({ limit: String(query.limit ?? 20) })
  if (query.cursor) params.set('cursor', query.cursor)
  const value = await apiClient<unknown>('/drivers?' + params, { signal, expectedStatus: 200 })
  if (!object(value) || Object.keys(value).length !== 2 || !Array.isArray(value.data) || !object(value.pagination)) throw invalid()
  const p = value.pagination
  if (Object.keys(p).length !== 3 || !['limit', 'hasMore', 'nextCursor'].every(key => Object.hasOwn(p, key)) ||
    !Number.isInteger(p.limit) || (p.limit as number) < 1 || (p.limit as number) > 100 || value.data.length > (p.limit as number) ||
    typeof p.hasMore !== 'boolean' || !(p.hasMore ? typeof p.nextCursor === 'string' && !!p.nextCursor && value.data.length > 0 : p.nextCursor === null)) throw invalid()
  const data = value.data.map(driver)
  if (new Set(data.map(item => item.id)).size !== data.length) throw invalid()
  return { data, pagination: p as unknown as DriverPage['pagination'] }
}
