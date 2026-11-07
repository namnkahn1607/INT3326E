import { assertGpsLocationRequest, type GpsLocationRequest } from '@parcelflow/types'
import { ApiError, apiClient } from '../client'

export interface LocationAccepted {
  status: 'ACCEPTED'
  eventId: string
  receivedAt: string
}

export async function sendLocation(payload: GpsLocationRequest, signal?: AbortSignal): Promise<LocationAccepted> {
  assertGpsLocationRequest(payload)
  const value = await apiClient<unknown>('/locations', {
    method: 'POST', body: JSON.stringify(payload), expectedStatus: 202, timeoutMs: 7000, signal,
  })
  if (!value || typeof value !== 'object') throw new ApiError(202, 'INVALID_RESPONSE')
  const response = value as Record<string, unknown>
  if (response.status !== 'ACCEPTED' || typeof response.eventId !== 'string' || !response.eventId.trim() ||
    typeof response.receivedAt !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(response.receivedAt) ||
    !Number.isFinite(Date.parse(response.receivedAt)) ||
    new Date(response.receivedAt).toISOString() !== response.receivedAt) throw new ApiError(202, 'INVALID_RESPONSE')
  return response as unknown as LocationAccepted
}
