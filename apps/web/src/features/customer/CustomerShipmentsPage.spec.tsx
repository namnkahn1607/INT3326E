import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerShipmentsPage } from './CustomerShipmentsPage'
import { CustomerShipmentDetailPage } from './CustomerShipmentDetailPage'
import { CustomerLayout } from '../../layouts/CustomerLayout'
import { shipmentFixture } from './shipment-fixture'
import { ApiError } from '../../api/client'

const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }))
vi.mock('../../api/endpoints/shipments', () => ({ getShipments: api.list, getShipmentById: api.detail }))
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { id: 'customer-a' } }) }))
vi.mock('../../components/shipment/ShipmentTracking', () => ({ ShipmentTracking: () => null }))
let node: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  api.list.mockReset(); api.detail.mockReset()
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })
async function mount(path = '/customer/shipments') {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/customer/shipments" element={<CustomerShipmentsPage />} />
    <Route path="/customer/shipments/:id" element={<CustomerShipmentDetailPage />} />
  </Routes></MemoryRouter>))
}
const page = (data: unknown[], nextCursor: string | null = null) => ({ data, pagination: { limit: 20, hasMore: !!nextCursor, nextCursor } })

describe('Customer reads (mock only)', () => {
  it.each([
    ['populated', '/customer/shipments', [shipmentFixture]],
    ['empty', '/customer/shipments', []],
    ['filtered empty', '/customer/shipments?status=DELIVERED', []],
  ])('keeps only the navigation create action for a %s list', async (_state, path, data) => {
    api.list.mockResolvedValue(page(data))
    await act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/customer" element={<CustomerLayout />}>
        <Route path="shipments" element={<CustomerShipmentsPage />} />
      </Route>
    </Routes></MemoryRouter>))
    expect(node.querySelectorAll('a[href="/customer/create"]')).toHaveLength(1)
    expect(node.querySelector('header .pf-header-send')?.textContent).toBe('Tạo đơn mới')
    expect(node.querySelector('main a[href="/customer/create"]')).toBeNull()
    if (data.length) expect(node.textContent).toContain(shipmentFixture.trackingNumber)
    else if (!path.includes('?')) expect(node.querySelector('.customer-empty p')?.textContent).toContain('trên thanh điều hướng')
  })

  it('renders an empty state without invented shipments or totals', async () => {
    api.list.mockResolvedValue(page([])); await mount()
    expect(node.textContent).toContain('Chưa có đơn hàng')
    expect(node.textContent).not.toContain('PF-2026-001')
  })
  it('uses the tracking number from the URL instead of ignoring the home search', async () => {
    api.list.mockResolvedValue(page([])); await mount('/customer/shipments?trackingNumber=PF20261018ABC234')
    expect(api.list.mock.calls[0][0]).toMatchObject({ trackingNumber: 'PF20261018ABC234' })
    expect(node.textContent).toContain('PF20261018ABC234')
  })
  it('uses the server cursor and resets pagination after a status change', async () => {
    api.list.mockResolvedValueOnce(page([shipmentFixture], 'opaque')).mockResolvedValue(page([]))
    await mount()
    await act(async () => node.querySelector<HTMLButtonElement>('[data-testid="next-page"]')!.click())
    expect(api.list.mock.calls[1][0]).toMatchObject({ cursor: 'opaque' })
    await act(async () => {
      const select = node.querySelector('select')!; select.value = 'CREATED'; select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(api.list.mock.calls.at(-1)![0]).toEqual({ status: 'CREATED', cursor: undefined })
  })
  it('aborts and ignores a stale result after changing the filter', async () => {
    let finish!: (value: unknown) => void
    api.list.mockReturnValueOnce(new Promise(resolve => { finish = resolve })).mockResolvedValue(page([]))
    await mount()
    const signal = api.list.mock.calls[0][1] as AbortSignal
    await act(async () => {
      const select = node.querySelector('select')!; select.value = 'ASSIGNED'; select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(signal.aborted).toBe(true)
    await act(async () => finish(page([shipmentFixture])))
    expect(node.textContent).not.toContain(shipmentFixture.trackingNumber)
  })
  it('combines tracking and status, removes one chip without clearing the other, and resets the cursor', async () => {
    api.list.mockResolvedValue(page([shipmentFixture], 'next-filtered'))
    await mount('/customer/shipments?trackingNumber=PF20261018ABC234&status=CREATED')
    expect(node.querySelectorAll('.ui-filter-token')).toHaveLength(2)
    expect(api.list.mock.calls[0][0]).toMatchObject({ status: 'CREATED', trackingNumber: 'PF20261018ABC234' })
    await act(async () => node.querySelector<HTMLButtonElement>('[data-testid="next-page"]')!.click())
    expect(api.list.mock.calls.at(-1)![0].cursor).toBe('next-filtered')
    await act(async () => node.querySelector<HTMLButtonElement>('[aria-label^="Bỏ lọc Mã vận đơn"]')!.click())
    expect(api.list.mock.calls.at(-1)![0]).toEqual({ status: 'CREATED', cursor: undefined })
    expect(node.querySelector('select')?.value).toBe('CREATED')
    expect(node.querySelectorAll('.ui-filter-token')).toHaveLength(1)
    await act(async () => node.querySelector<HTMLButtonElement>('.ui-clear-filters')!.click())
    expect(api.list.mock.calls.at(-1)![0]).toEqual({ status: undefined, cursor: undefined })
    expect(node.querySelector('.ui-applied-filters')).toBeNull()
  })
  it('distinguishes a filtered empty result and provides a clear-filter action, not a fake total', async () => {
    api.list.mockResolvedValue(page([])); await mount('/customer/shipments?status=DELIVERED')
    expect(node.querySelector('.customer-empty h2')?.textContent).toBe('Không có kết quả phù hợp')
    expect(node.querySelector('.customer-empty a[href="/customer/create"]')).toBeNull()
    expect(node.querySelector('.customer-empty button')?.textContent).toBe('Xóa bộ lọc')
    expect(node.querySelector('.data-note')?.textContent).toContain('Không phải tổng số')
  })
  it('submits exact tracking search while preserving the active status', async () => {
    api.list.mockResolvedValue(page([])); await mount('/customer/shipments?status=ASSIGNED')
    await act(async () => {
      const input = node.querySelector<HTMLInputElement>('[name="trackingNumber"]')!
      input.value = ' PF20261018ABC234 '
      node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(api.list.mock.calls.at(-1)![0]).toEqual({ status: 'ASSIGNED', cursor: undefined, trackingNumber: 'PF20261018ABC234' })
  })
  it('shows a layout skeleton while loading and recovers from a failed request', async () => {
    let fail!: (cause: Error) => void
    api.list.mockReturnValueOnce(new Promise((_, reject) => { fail = reject })).mockResolvedValue(page([]))
    await mount(); expect(node.querySelector('.ui-data-skeleton')).not.toBeNull()
    await act(async () => fail(new ApiError(0, 'NETWORK_ERROR')))
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('Kiểm tra mạng')
    await act(async () => node.querySelector<HTMLButtonElement>('[role="alert"] button')!.click())
    expect(node.textContent).toContain('Chưa có đơn hàng')
  })
  it('reads a direct detail URL, independent of the Create snapshot', async () => {
    api.detail.mockResolvedValue({ ...shipmentFixture, driverId: shipmentFixture.customerId, status: 'ASSIGNED', statusHistory: [] })
    await mount('/customer/shipments/' + shipmentFixture.id)
    expect(api.detail.mock.calls[0][0]).toBe(shipmentFixture.id)
    expect(node.textContent).toContain(shipmentFixture.trackingNumber)
    expect(node.textContent).toContain('Đã gán tài xế')
  })
  it.each([403, 404])('does not invent data on detail %s', async status => {
    api.detail.mockRejectedValue(new ApiError(status, 'HTTP_ERROR'))
    await mount('/customer/shipments/' + shipmentFixture.id)
    expect(node.querySelector('[role="alert"]')).not.toBeNull()
    expect(node.textContent).not.toContain(shipmentFixture.trackingNumber)
  })
  it('shows server lifecycle audit on Customer Detail without any mutation controls', async () => {
    api.detail.mockResolvedValue({ ...shipmentFixture, status: 'DELIVERY_FAILED', driverId: shipmentFixture.customerId,
      failureReason: 'Người nhận từ chối', failedByRole: 'ADMIN', failedByUserId: shipmentFixture.customerId,
      statusHistory: [{ id: 'event', action: 'DELIVERY_FAILED', fromStatus: 'PICKED_UP', toStatus: 'DELIVERY_FAILED',
        actorRole: 'ADMIN', actorUserId: shipmentFixture.customerId, previousDriverId: shipmentFixture.customerId,
        newDriverId: shipmentFixture.customerId, reason: 'Người nhận từ chối', occurredAt: shipmentFixture.updatedAt }] })
    await mount('/customer/shipments/' + shipmentFixture.id)
    expect(node.querySelector('.shipment-history li')?.textContent).toContain('Giao thất bại')
    expect(node.textContent).toContain('Người nhận từ chối')
    expect(node.textContent).toContain('Quản trị viên')
    expect(node.querySelector('textarea')).toBeNull()
    expect(node.textContent).not.toContain('Xác nhận giao thất bại')
  })
})
