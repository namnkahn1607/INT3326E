import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { getNotifications, type NotificationPage } from '../../api/endpoints/notifications'
import { AuthContext, type AuthContextType, type UserProfile } from '../auth/context'
import { CustomerNotificationsPage } from './CustomerNotificationsPage'
import { shipmentFixture } from './shipment-fixture'

vi.mock('../../api/endpoints/notifications', () => ({ getNotifications: vi.fn() }))
const user: UserProfile = { id: 'customer-a', role: 'CUSTOMER', email: 'a@example.invalid', displayName: 'Khách' }
const item = { id: '00000000-0000-4000-8000-000000000001', shipmentId: shipmentFixture.id,
  trackingNumber: shipmentFixture.trackingNumber, kind: 'CREATED' as const,
  title: 'Đơn vừa tạo', body: 'Nội dung từ API', createdAt: shipmentFixture.createdAt }
const page = (data = [item], nextCursor: string | null = null): NotificationPage =>
  ({ data, pagination: { limit: 20, hasMore: nextCursor !== null, nextCursor } })
let root: Root, node: HTMLDivElement
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(getNotifications).mockResolvedValue(page())
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })
async function mount(account: UserProfile | null = user) {
  const auth: AuthContextType = { user: account, token: null, loading: false, error: null, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() }
  await act(async () => root.render(<AuthContext.Provider value={auth}><MemoryRouter><CustomerNotificationsPage /></MemoryRouter></AuthContext.Provider>))
}
const button = (text: string) => [...node.querySelectorAll<HTMLButtonElement>('button')].find(x => x.textContent === text)!
async function click(text: string) { await act(async () => button(text).click()) }

it('renders server content and order links without demo/read receipts, then polls after 10s', async () => {
  await mount()
  expect(node.textContent).toContain(item.body)
  expect(node.querySelector('h2 a')?.getAttribute('href')).toBe('/customer/shipments/' + item.shipmentId)
  expect(node.querySelector('time')?.dateTime).toBe(item.createdAt)
  expect(node.querySelector('.unread')).toBeNull()
  expect(node.textContent).not.toMatch(/dữ liệu mẫu|Tuần 6|15 phút trước/)
  await act(async () => vi.advanceTimersByTimeAsync(10_000))
  expect(getNotifications).toHaveBeenCalledTimes(2)
})
it('keeps slow requests serial and clears timers/requests when leaving', async () => {
  let finish!: (value: NotificationPage) => void
  vi.mocked(getNotifications).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await mount()
  const signal = vi.mocked(getNotifications).mock.calls[0][1]!
  expect(button('Đang cập nhật…').disabled).toBe(true)
  await act(async () => vi.advanceTimersByTimeAsync(30_000))
  expect(getNotifications).toHaveBeenCalledTimes(1)
  await mount(null)
  expect(signal.aborted).toBe(true)
  await act(async () => finish(page()))
  expect(node.textContent).not.toContain(item.body)
  expect(vi.getTimerCount()).toBe(0)
})
it('paginates with an opaque cursor and returns to the first page', async () => {
  vi.mocked(getNotifications).mockResolvedValue(page([item], 'opaque+/='))
  await mount(); await click('Trang sau')
  expect(getNotifications).toHaveBeenLastCalledWith('opaque+/=', expect.any(AbortSignal))
  await click('Trang trước')
  expect(getNotifications).toHaveBeenLastCalledWith(undefined, expect.any(AbortSignal))
})
it('shows read errors without an empty-state claim and recovers on retry', async () => {
  vi.mocked(getNotifications).mockRejectedValue(new ApiError(503, 'SERVICE_UNAVAILABLE'))
  await mount()
  expect(node.querySelector('[role=alert]')).not.toBeNull()
  expect(node.textContent).not.toContain('Chưa có thông báo.')
  vi.mocked(getNotifications).mockResolvedValue(page([]))
  await click('Thử lại')
  expect(node.textContent).toContain('Chưa có thông báo.')
})
it('clears the previous account and discards late results', async () => {
  let finish!: (value: NotificationPage) => void
  vi.mocked(getNotifications).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await mount()
  const signal = vi.mocked(getNotifications).mock.calls[0][1]!
  vi.mocked(getNotifications).mockResolvedValue(page([]))
  await mount({ ...user, id: 'customer-b' })
  expect(signal.aborted).toBe(true)
  await act(async () => finish(page()))
  expect(node.textContent).not.toContain(item.body)
  expect(node.textContent).toContain('Chưa có thông báo.')
})
it.each([401, 403, 409])('stops polling after account error %s and does not fetch without a Customer', async status => {
  vi.mocked(getNotifications).mockRejectedValue(new ApiError(status, status === 409 ? 'USER_NOT_PROVISIONED' : 'DENIED'))
  await mount()
  await act(async () => vi.advanceTimersByTimeAsync(30_000))
  expect(getNotifications).toHaveBeenCalledTimes(1)
  await mount({ ...user, role: 'ADMIN' })
  expect(getNotifications).toHaveBeenCalledTimes(1)
})
