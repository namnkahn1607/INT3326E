import { ApiError, apiClient } from '../client'
import { SHIPMENT_STATUS_MAP, type ShipmentStatus } from '../../types/shipment'
import type { Coordinates, CreateShipmentPayload, ShipmentDetail, ShipmentPage, ShipmentResponse, StatusEventResponse } from '../../types/shipment-api'
import { characterCount } from '../../utils'

export type { CreateShipmentPayload } from '../../types/shipment-api'
const ulid = '[0-7][0-9A-HJKMNP-TV-Z]{25}'
export const isShipmentId = (value: unknown): value is string => typeof value === 'string' && new RegExp('^sh_' + ulid + '$').test(value)
export const isUserId = (value: unknown): value is string => typeof value === 'string' && new RegExp('^usr_' + ulid + '$').test(value)
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const nullableText = (value: unknown) => value === null || typeof value === 'string'
const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value))
const status = (value: unknown): value is ShipmentStatus => typeof value === 'string' && Object.hasOwn(SHIPMENT_STATUS_MAP, value)
const invalid = () => new ApiError(0, 'INVALID_RESPONSE')
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

export function isCoordinates(value: unknown): value is Coordinates {
  return object(value) && exact(value, ['lat', 'lng']) &&
    typeof value.lat === 'number' && Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90 &&
    typeof value.lng === 'number' && Number.isFinite(value.lng) && value.lng >= -180 && value.lng <= 180
}

const shipmentKeys = ['id', 'trackingNumber', 'customerId', 'driverId', 'status', 'pickupAddress', 'pickupLocation',
  'dropoffAddress', 'dropoffLocation', 'recipientName', 'recipientPhone', 'notes', 'packageDescription',
  'packageWeightKg', 'expectedDeliveryAt', 'isLate', 'failureReason', 'failedByRole', 'failedByUserId',
  'proofOfDeliveryNotes', 'createdAt', 'updatedAt']

function shipment(value: unknown, detail = false): ShipmentResponse {
  if (!object(value) || !exact(value, detail ? [...shipmentKeys, 'statusHistory'] : shipmentKeys) ||
    !isShipmentId(value.id) || typeof value.trackingNumber !== 'string' || !/^PF\d{8}[0-9A-HJKMNP-TV-Z]{6}$/.test(value.trackingNumber) ||
    !isUserId(value.customerId) || !status(value.status) || !(value.driverId === null || isUserId(value.driverId)) ||
    !['pickupAddress', 'dropoffAddress', 'recipientName', 'recipientPhone'].every(key => typeof value[key] === 'string') ||
    !isCoordinates(value.pickupLocation) || !isCoordinates(value.dropoffLocation) ||
    !['notes', 'packageDescription', 'failureReason', 'proofOfDeliveryNotes'].every(key => nullableText(value[key])) ||
    !(value.packageWeightKg === null || (typeof value.packageWeightKg === 'number' && Number.isFinite(value.packageWeightKg) && value.packageWeightKg > 0)) ||
    !(value.expectedDeliveryAt === null || date(value.expectedDeliveryAt)) ||
    !(value.isLate === null || typeof value.isLate === 'boolean') ||
    !(value.failedByRole === null || value.failedByRole === 'DRIVER' || value.failedByRole === 'ADMIN') ||
    !(value.failedByUserId === null || isUserId(value.failedByUserId)) ||
    !date(value.createdAt) || !date(value.updatedAt)) throw invalid()
  if ((value.status === 'CREATED') !== (value.driverId === null) ||
    (value.expectedDeliveryAt === null) !== (value.isLate === null)) throw invalid()
  if (value.status !== 'DELIVERY_FAILED' && [value.failureReason, value.failedByRole, value.failedByUserId].some(field => field !== null)) throw invalid()
  if (value.status === 'DELIVERY_FAILED' && [value.failureReason, value.failedByRole, value.failedByUserId].some(field => field === null)) throw invalid()
  if (value.status !== 'DELIVERED' && value.proofOfDeliveryNotes !== null) throw invalid()
  return value as unknown as ShipmentResponse
}

function history(value: unknown, shipmentId: string): StatusEventResponse {
  const keys = ['id', 'shipmentId', 'action', 'fromStatus', 'toStatus', 'actorUserId', 'actorRole',
    'previousDriverId', 'newDriverId', 'reason', 'occurredAt']
  if (!object(value) || !exact(value, keys) || typeof value.id !== 'string' ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.id) || value.shipmentId !== shipmentId ||
    !(status(value.action) || value.action === 'REASSIGNED') ||
    !(value.fromStatus === null || status(value.fromStatus)) || !status(value.toStatus) ||
    !isUserId(value.actorUserId) || !['CUSTOMER', 'DRIVER', 'ADMIN'].includes(String(value.actorRole)) ||
    !(value.previousDriverId === null || isUserId(value.previousDriverId)) ||
    !(value.newDriverId === null || isUserId(value.newDriverId)) || !nullableText(value.reason) || !date(value.occurredAt)) throw invalid()
  return value as unknown as StatusEventResponse
}

export interface ShipmentQuery { status?: ShipmentStatus; cursor?: string; limit?: number; trackingNumber?: string }

export async function getShipments(query: ShipmentQuery = {}, signal?: AbortSignal): Promise<ShipmentPage> {
  const params = new URLSearchParams({ limit: String(query.limit ?? 20) })
  if (query.status) params.set('status', query.status)
  if (query.cursor) params.set('cursor', query.cursor)
  if (query.trackingNumber) params.set('trackingNumber', query.trackingNumber)
  const value = await apiClient<unknown>('/shipments?' + params, { signal, expectedStatus: 200 })
  if (!object(value) || !exact(value, ['data', 'pagination']) || !Array.isArray(value.data) || !object(value.pagination)) throw invalid()
  const p = value.pagination
  if (!exact(p, ['limit', 'hasMore', 'nextCursor']) || typeof p.limit !== 'number' || !Number.isInteger(p.limit) ||
    p.limit < 1 || p.limit > 100 || value.data.length > p.limit || typeof p.hasMore !== 'boolean' ||
    !(p.hasMore ? typeof p.nextCursor === 'string' && p.nextCursor.length > 0 && value.data.length > 0 : p.nextCursor === null)) throw invalid()
  return { data: value.data.map(item => shipment(item)), pagination: p as unknown as ShipmentPage['pagination'] }
}

export async function getShipmentById(id: string, signal?: AbortSignal): Promise<ShipmentDetail> {
  if (!isShipmentId(id)) throw new ApiError(400, 'INVALID_SHIPMENT_ID')
  const value = await apiClient<unknown>('/shipments/' + encodeURIComponent(id), { signal, expectedStatus: 200 })
  const parsed = shipment(value, true)
  if (!object(value) || parsed.id !== id || !Array.isArray(value.statusHistory)) throw invalid()
  return { ...parsed, statusHistory: value.statusHistory.map(event => history(event, id)) }
}

export async function createShipment(payload: CreateShipmentPayload, idempotencyKey: string, signal?: AbortSignal): Promise<ShipmentResponse> {
  const value = await apiClient<unknown>('/shipments', { method: 'POST', body: JSON.stringify(payload),
    headers: { 'Idempotency-Key': idempotencyKey }, signal, expectedStatus: 201 })
  const result = shipment(value)
  if (result.status !== 'CREATED') throw invalid()
  return result
}

export async function assignShipment(id: string, driverId: string, signal?: AbortSignal): Promise<ShipmentResponse> {
  if (!isShipmentId(id) || !isUserId(driverId)) throw new ApiError(400, 'INVALID_ASSIGNMENT_ID')
  const value = await apiClient<unknown>(`/shipments/${encodeURIComponent(id)}/assign`, {
    method: 'POST', body: JSON.stringify({ driverId }), signal, expectedStatus: 200,
  })
  const result = shipment(value)
  if (result.id !== id || result.driverId !== driverId || result.status !== 'ASSIGNED') throw invalid()
  return result
}

export function normalizeFailureReason(reason: string): string {
  const value = reason.trim()
  if (characterCount(value) < 5 || characterCount(value) > 500) {
    throw new ApiError(400, 'VALIDATION_ERROR', [{ field: 'reason', message: 'Nhập lý do từ 5 đến 500 ký tự.' }])
  }
  return value
}

export async function failShipment(id: string, reason: string, signal?: AbortSignal): Promise<ShipmentResponse> {
  if (!isShipmentId(id)) throw new ApiError(400, 'INVALID_SHIPMENT_ID')
  const body = JSON.stringify({ reason: normalizeFailureReason(reason) })
  const value = await apiClient<unknown>(`/shipments/${encodeURIComponent(id)}/fail`, {
    method: 'POST', body, signal, expectedStatus: 200,
  })
  const result = shipment(value)
  if (result.id !== id || result.status !== 'DELIVERY_FAILED') throw invalid()
  return result
}
