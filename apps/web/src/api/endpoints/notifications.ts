import { apiClient } from '../client'
import { isShipmentId } from './shipments'
import { hasExactKeys, invalidPage, isRecord, parseCursorPage, type CursorPage } from './pagination'

export interface NotificationResponse {
  id: string
  shipmentId: string
  trackingNumber: string
  kind: 'CREATED' | 'ASSIGNED' | 'REASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'DELIVERY_FAILED'
  title: string
  body: string
  createdAt: string
}
export type NotificationPage = CursorPage<NotificationResponse>

function notification(value: unknown): NotificationResponse {
  if (!isRecord(value) || !hasExactKeys(value, ['id', 'shipmentId', 'trackingNumber', 'kind', 'title', 'body', 'createdAt']) ||
    typeof value.id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.id) ||
    !isShipmentId(value.shipmentId) || typeof value.trackingNumber !== 'string' || !/^PF\d{8}[0-9A-HJKMNP-TV-Z]{6}$/.test(value.trackingNumber) ||
    !['CREATED', 'ASSIGNED', 'REASSIGNED', 'PICKED_UP', 'DELIVERED', 'DELIVERY_FAILED'].includes(String(value.kind)) ||
    typeof value.title !== 'string' || typeof value.body !== 'string' || typeof value.createdAt !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.createdAt) ||
    !Number.isFinite(Date.parse(value.createdAt)) || new Date(value.createdAt).toISOString() !== value.createdAt) throw invalidPage()
  return value as unknown as NotificationResponse
}

export async function getNotifications(cursor?: string, signal?: AbortSignal): Promise<NotificationPage> {
  const query = new URLSearchParams({ limit: '20' })
  if (cursor) query.set('cursor', cursor)
  return parseCursorPage(await apiClient<unknown>('/notifications?' + query, { signal, expectedStatus: 200 }), notification)
}
