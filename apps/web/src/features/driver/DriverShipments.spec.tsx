import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { deliverShipment, getShipmentById, getShipments, pickupShipment } from '../../api/endpoints/shipments'
import type { ShipmentDetail, ShipmentPage, ShipmentResponse } from '../../types/shipment-api'
import { AuthContext, type AuthContextType, type UserProfile } from '../auth/context'
import { shipmentFixture } from '../customer/shipment-fixture'
import { DriverPlaceholderPage } from './DriverPlaceholderPage'
import { DriverShipmentDetailPage } from './DriverShipmentDetailPage'

vi.mock('../../api/endpoints/shipments', async original => ({ ...await original<object>(),
  getShipments: vi.fn(), getShipmentById: vi.fn(), pickupShipment: vi.fn(), deliverShipment: vi.fn() }))
const driver: UserProfile = { id: 'firebase-uid', displayName: 'An', email: 'an@example.test', role: 'DRIVER' }
const assigned: ShipmentDetail = { ...shipmentFixture, driverId: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX', status: 'ASSIGNED', statusHistory: [] }
const picked: ShipmentDetail = { ...assigned, status: 'PICKED_UP' }
const delivered: ShipmentDetail = { ...picked, status: 'DELIVERED', proofOfDeliveryNotes: 'Gửi lễ tân' }
let root: Root, node: HTMLDivElement
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(getShipments).mockResolvedValue({ data: [assigned], pagination: { limit: 20, hasMore: false, nextCursor: null } })
  vi.mocked(getShipmentById).mockResolvedValue(assigned)
  vi.mocked(pickupShipment).mockResolvedValue(picked)
  vi.mocked(deliverShipment).mockResolvedValue(delivered)
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })
async function mount(path = '/driver/shipments/' + assigned.id, user: UserProfile | null = driver) {
  const auth: AuthContextType = { user, token: 'test-token', loading: false, error: null, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() }
  await act(async () => root.render(<StrictMode><AuthContext.Provider value={auth}>
    <MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/driver" element={<DriverPlaceholderPage />} />
      <Route path="/driver/shipments/:id" element={<DriverShipmentDetailPage />} />
      <Route path="/other" element={<p>Trang khác</p>} />
    </Routes><Link to="/other">Rời trang</Link></MemoryRouter>
  </AuthContext.Provider></StrictMode>))
}
function button(label: string) {
  const result = [...node.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label)
  if (!result) throw new Error('Missing button: ' + label)
  return result
}
async function click(label: string) { await act(async () => button(label).click()) }
async function notes(value: string) {
  await act(async () => {
    const input = node.querySelector('textarea')!
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

describe('Driver assigned shipments (mock API)', () => {
  it('uses server scope without Firebase UID filters and links real shipment IDs', async () => {
    await mount('/driver')
    expect(getShipments).toHaveBeenLastCalledWith({ status: undefined, cursor: undefined, limit: 20 }, expect.any(AbortSignal))
    expect(node.textContent).toContain(assigned.trackingNumber)
    expect(node.querySelector('a[href="/driver/shipments/' + assigned.id + '"]')).not.toBeNull()
    expect(node.textContent).not.toContain('Danh sách đơn chưa được kết nối')
  })
  it('paginates with opaque cursors and resets paging when status changes', async () => {
    vi.mocked(getShipments).mockResolvedValue({ data: [assigned], pagination: { limit: 20, hasMore: true, nextCursor: 'opaque+/=' } })
    await mount('/driver'); await click('Trang tiếp')
    expect(getShipments).toHaveBeenLastCalledWith({ status: undefined, cursor: 'opaque+/=', limit: 20 }, expect.any(AbortSignal))
    await act(async () => {
      const select = node.querySelector<HTMLSelectElement>('#driver-shipment-status')!
      select.value = 'PICKED_UP'; select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(getShipments).toHaveBeenLastCalledWith({ status: 'PICKED_UP', cursor: undefined, limit: 20 }, expect.any(AbortSignal))
    expect(button('Trang trước').disabled).toBe(true)
  })
  it('shows loading, read error, retry and a genuine empty state', async () => {
    const pending = deferred<ShipmentPage>(); vi.mocked(getShipments).mockReturnValue(pending.promise)
    await mount('/driver'); expect(node.textContent).toContain('Đang tải đơn được phân công')
    vi.mocked(getShipments).mockRejectedValue(new ApiError(503, 'UNAVAILABLE'))
    await click('Làm mới danh sách'); expect(node.querySelector('[role="alert"]')).not.toBeNull()
    vi.mocked(getShipments).mockResolvedValue({ data: [], pagination: { limit: 20, hasMore: false, nextCursor: null } })
    await click('Thử tải lại danh sách'); expect(node.textContent).toContain('Chưa có đơn trên trang này')
    await act(async () => pending.resolve({ data: [assigned], pagination: { limit: 20, hasMore: false, nextCursor: null } }))
    expect(node.textContent).not.toContain(assigned.trackingNumber)
  })
  it('aborts the old account list and ignores its late result', async () => {
    const pending = deferred<ShipmentPage>(); vi.mocked(getShipments).mockReturnValue(pending.promise)
    await mount('/driver')
    const signal = vi.mocked(getShipments).mock.calls.at(-1)![1]!
    vi.mocked(getShipments).mockResolvedValue({ data: [], pagination: { limit: 20, hasMore: false, nextCursor: null } })
    await mount('/driver', { ...driver, id: 'other-firebase-uid' })
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve({ data: [assigned], pagination: { limit: 20, hasMore: false, nextCursor: null } }))
    expect(node.textContent).not.toContain(assigned.trackingNumber)
  })
})

describe('Driver pickup/delivery UI (mock API)', () => {
  it('requires confirmation, supports cancel, and reads server state/history after pickup', async () => {
    await mount(); await click('Đã lấy hàng')
    expect(pickupShipment).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(node.querySelector('.driver-shipment-review'))
    await click('Hủy xác nhận'); expect(document.activeElement).toBe(button('Đã lấy hàng'))
    await click('Đã lấy hàng'); vi.mocked(getShipmentById).mockResolvedValue(picked)
    await click('Xác nhận đã lấy hàng')
    expect(pickupShipment).toHaveBeenCalledExactlyOnceWith(assigned.id, expect.any(AbortSignal))
    expect(node.textContent).toContain('Máy chủ đã xác nhận lấy hàng')
    expect(node.querySelector('textarea')).not.toBeNull()
    expect(node.textContent).toContain('Lịch sử trạng thái')
  })
  it('validates notes, confirms delivery and keeps the server notes on a no-op', async () => {
    vi.mocked(getShipmentById).mockResolvedValue(picked); await mount()
    await notes('🚚'.repeat(256)); await click('Giao thành công')
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('255')
    expect(deliverShipment).not.toHaveBeenCalled()
    await notes('  Giao cho người nhận  '); await click('Giao thành công')
    vi.mocked(getShipmentById).mockResolvedValue(delivered)
    await click('Xác nhận giao thành công')
    expect(deliverShipment).toHaveBeenCalledExactlyOnceWith(picked.id, 'Giao cho người nhận', expect.any(AbortSignal))
    expect(node.textContent).toContain('Máy chủ đã xác nhận giao thành công')
    expect(node.textContent).toContain('Gửi lễ tân'); expect(node.querySelector('textarea')).toBeNull()
  })
  it.each(['CREATED', 'DELIVERED', 'DELIVERY_FAILED'] as const)('does not offer pickup/deliver for %s', async status => {
    vi.mocked(getShipmentById).mockResolvedValue({ ...assigned, status }); await mount()
    expect(node.querySelector('form')).toBeNull()
    expect(pickupShipment).not.toHaveBeenCalled(); expect(deliverShipment).not.toHaveBeenCalled()
  })
  it.each([new ApiError(404, 'NOT_FOUND'), new ApiError(409, 'INVALID_STATE_TRANSITION'),
    new ApiError(0, 'REQUEST_TIMEOUT'), new ApiError(0, 'NETWORK_ERROR'), new ApiError(503, 'UNAVAILABLE'),
    new ApiError(0, 'INVALID_RESPONSE')])('only reads again after rejected/uncertain POST %s', async cause => {
    await mount(); await click('Đã lấy hàng')
    vi.mocked(pickupShipment).mockRejectedValue(cause); vi.mocked(getShipmentById).mockResolvedValue(picked)
    const before = vi.mocked(getShipmentById).mock.calls.length
    await click('Xác nhận đã lấy hàng')
    expect(pickupShipment).toHaveBeenCalledTimes(1)
    expect(getShipmentById).toHaveBeenCalledTimes(before + 1)
    expect(node.textContent).toContain('Đã đọc lại trạng thái hiện tại')
    expect(node.textContent).not.toContain('Máy chủ đã xác nhận')
    expect(node.querySelector('textarea')?.value).toBe('')
  })
  it('blocks double clicks and preserves a confirmed result through failed history reads', async () => {
    const pending = deferred<ShipmentResponse>(); vi.mocked(pickupShipment).mockReturnValue(pending.promise)
    await mount(); await click('Đã lấy hàng')
    await act(async () => { button('Xác nhận đã lấy hàng').click(); button('Xác nhận đã lấy hàng').click() })
    expect(pickupShipment).toHaveBeenCalledTimes(1)
    vi.mocked(getShipmentById).mockRejectedValue(new ApiError(503, 'UNAVAILABLE'))
    await act(async () => pending.resolve(picked))
    expect(node.textContent).toContain('Máy chủ đã xác nhận lấy hàng')
    expect(node.textContent).toContain(assigned.trackingNumber)
    expect(node.querySelector('form')).toBeNull()
    await click('Đọc lại thông tin đơn')
    expect(node.textContent).toContain('Máy chủ đã xác nhận lấy hàng')
  })
  it('clears stale shipment and notes and locks writes after failed reconciliation', async () => {
    vi.mocked(getShipmentById).mockResolvedValue(picked); await mount()
    await notes('Ghi chú cũ'); await click('Giao thành công')
    vi.mocked(deliverShipment).mockRejectedValue(new ApiError(0, 'REQUEST_TIMEOUT'))
    vi.mocked(getShipmentById).mockRejectedValue(new ApiError(503, 'UNAVAILABLE'))
    await click('Xác nhận giao thành công')
    expect(node.textContent).not.toContain(assigned.trackingNumber)
    expect(node.querySelector('form')).toBeNull()
    vi.mocked(getShipmentById).mockResolvedValue(picked); await click('Đọc lại thông tin đơn')
    expect(node.querySelector('textarea')?.value).toBe('')
    expect(deliverShipment).toHaveBeenCalledTimes(1)
  })
  it('removes even a confirmed snapshot after access is revoked and does not restore it on later network errors', async () => {
    await mount(); await click('Đã lấy hàng')
    vi.mocked(getShipmentById).mockRejectedValue(new ApiError(403, 'FORBIDDEN_RESOURCE'))
    await click('Xác nhận đã lấy hàng')
    expect(node.textContent).not.toContain(assigned.recipientPhone)
    expect(node.textContent).not.toContain(assigned.trackingNumber)
    vi.mocked(getShipmentById).mockRejectedValue(new ApiError(503, 'UNAVAILABLE'))
    await click('Đọc lại thông tin đơn')
    expect(node.textContent).not.toContain(assigned.trackingNumber)
  })
  it.each([401, 403, 404])('does not show shipment data when Detail rejects with %s', async status => {
    vi.mocked(getShipmentById).mockRejectedValue(new ApiError(status, 'DENIED')); await mount()
    expect(node.querySelector('[role="alert"]')).not.toBeNull()
    expect(node.textContent).not.toContain(assigned.recipientPhone)
    expect(node.querySelector('form')).toBeNull()
  })
  it('aborts a pending POST when leaving the route and ignores late success', async () => {
    const pending = deferred<ShipmentResponse>(); vi.mocked(pickupShipment).mockReturnValue(pending.promise)
    await mount(); await click('Đã lấy hàng'); await click('Xác nhận đã lấy hàng')
    const signal = vi.mocked(pickupShipment).mock.calls[0][1]!
    await act(async () => node.querySelector<HTMLAnchorElement>('a[href="/other"]')!.click())
    expect(signal.aborted).toBe(true)
    const before = vi.mocked(getShipmentById).mock.calls.length
    await act(async () => pending.resolve(picked))
    expect(getShipmentById).toHaveBeenCalledTimes(before)
    expect(node.textContent).not.toContain(assigned.trackingNumber)
  })
  it('clears old account Detail and ignores a late response after sign-out', async () => {
    const pending = deferred<ShipmentDetail>(); vi.mocked(getShipmentById).mockReturnValue(pending.promise)
    await mount(); const signal = vi.mocked(getShipmentById).mock.calls.at(-1)![1]!
    await mount(undefined, null); expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve(assigned))
    expect(node.textContent).toContain('Cần đăng nhập bằng tài khoản Driver')
    expect(node.textContent).not.toContain(assigned.trackingNumber)
  })
  it('aborts a pending write when the Driver account changes', async () => {
    const pending = deferred<ShipmentResponse>(); vi.mocked(pickupShipment).mockReturnValue(pending.promise)
    await mount(); await click('Đã lấy hàng'); await click('Xác nhận đã lấy hàng')
    const signal = vi.mocked(pickupShipment).mock.calls[0][1]!
    vi.mocked(getShipmentById).mockRejectedValue(new ApiError(403, 'FORBIDDEN_RESOURCE'))
    await mount(undefined, { ...driver, id: 'new-firebase-uid' })
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve(picked))
    expect(node.textContent).not.toContain('Máy chủ đã xác nhận')
    expect(node.textContent).not.toContain(assigned.trackingNumber)
  })
})
