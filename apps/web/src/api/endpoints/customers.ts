import { apiClient } from '../client'
import { isUserId } from './shipments'
import { hasExactKeys, invalidPage, isRecord, parseCursorPage, type CursorPage } from './pagination'

export interface CustomerSummary { id: string; name: string; email: string; phone: string | null }

function customer(value: unknown): CustomerSummary {
  if (!isRecord(value) || !hasExactKeys(value, ['id', 'name', 'email', 'phone']) || !isUserId(value.id) ||
    typeof value.name !== 'string' || typeof value.email !== 'string' ||
    !(value.phone === null || typeof value.phone === 'string')) throw invalidPage()
  return value as unknown as CustomerSummary
}

export async function getCustomers(cursor?: string, signal?: AbortSignal): Promise<CursorPage<CustomerSummary>> {
  const query = new URLSearchParams({ limit: '20' })
  if (cursor) query.set('cursor', cursor)
  return parseCursorPage(await apiClient<unknown>('/admin/customers?' + query, { signal, expectedStatus: 200 }), customer)
}
