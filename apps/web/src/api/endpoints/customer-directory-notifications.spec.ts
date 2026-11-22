import { afterEach, expect, it, vi } from 'vitest'
import { getCustomers } from './customers'
import { getNotifications } from './notifications'
import { shipmentFixture } from '../../features/customer/shipment-fixture'

vi.mock('../../features/auth/session', () => ({ readSessionToken: async () => 'local-test-token' }))
const notice = { id: '00000000-0000-4000-8000-000000000001', shipmentId: shipmentFixture.id,
  trackingNumber: shipmentFixture.trackingNumber, kind: 'PICKED_UP', title: 'Đã lấy hàng',
  body: 'Nội dung từ máy chủ', createdAt: '2026-11-22T05:00:00.000Z' }
const customer = { id: shipmentFixture.customerId, name: 'Khách thử', email: 'customer@example.invalid', phone: null }
const page = (data: unknown[], pagination = { limit: 20, hasMore: false, nextCursor: null as string | null }) => ({ data, pagination })
afterEach(() => vi.unstubAllGlobals())

it.each([
  [getNotifications, '/v1/notifications', notice],
  [getCustomers, '/v1/admin/customers', customer],
] as const)('reads a scoped endpoint with only limit/cursor and the current auth token', async (read, path, item) => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(page([item]))))
  vi.stubGlobal('fetch', fetcher)
  await expect(read('opaque+/=')).resolves.toMatchObject({ data: [item] })
  const [url, options] = fetcher.mock.calls[0]
  expect(new URL(url).pathname).toBe(path)
  expect([...new URL(url).searchParams]).toEqual([['limit', '20'], ['cursor', 'opaque+/=']])
  expect(options.method ?? 'GET').toBe('GET')
  expect(options.headers.get('Authorization')).toBe('Bearer local-test-token')
  expect(options.body).toBeUndefined()
})
it.each([getNotifications, getCustomers])('rejects malformed pagination, duplicate IDs and expanded response fields', async read => {
  const item = read === getCustomers ? customer : notice
  for (const value of [
    { ...page([item]), total: 1 }, page([item], { limit: 20, hasMore: true, nextCursor: null }),
    page([], { limit: 20, hasMore: true, nextCursor: 'cursor' }),
    page([item], { limit: 20, hasMore: false, nextCursor: 'cursor' }), page([item, item]),
    page([{ ...item, extra: true }]), page([{ ...item, id: 'bad' }]),
  ]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(value))))
    await expect(read()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  }
})
it('rejects notifications that would create broken order links or invent read state', async () => {
  for (const change of [
    { shipmentId: '../admin' }, { trackingNumber: 'bad' }, { kind: 'READ' },
    { readAt: null }, { createdAt: '2026-02-30T00:00:00.000Z' }, { body: null },
  ]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(page([{ ...notice, ...change }])))))
    await expect(getNotifications()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  }
})
it.each([401, 403, 409, 503])('keeps HTTP %s as an error rather than an empty list', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'UPSTREAM' }), { status })))
  await expect(getNotifications()).rejects.toMatchObject({ status })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'UPSTREAM' }), { status })))
  await expect(getCustomers()).rejects.toMatchObject({ status })
})
