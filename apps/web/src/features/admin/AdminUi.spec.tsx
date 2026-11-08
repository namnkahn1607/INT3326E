import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminLayout } from '../../layouts/AdminLayout'
import { AdminShipmentsPage } from './AdminShipmentsPage'
import { AdminDriversPage } from './AdminDriversPage'
import { getShipments } from '../../api/endpoints/shipments'
import { getDrivers } from '../../api/endpoints/drivers'
import { ApiError } from '../../api/client'
import { shipmentFixture } from '../customer/shipment-fixture'
import type { ShipmentPage, ShipmentResponse } from '../../types/shipment-api'

vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin', displayName: 'Admin' }, logout: vi.fn() }) }))
vi.mock('../../api/endpoints/shipments', () => ({ getShipments: vi.fn() }))
vi.mock('../../api/endpoints/drivers', () => ({ getDrivers: vi.fn() }))
const page = <T,>(data: T[], nextCursor: string | null = null) => ({ data, pagination: { limit: 20, hasMore: !!nextCursor, nextCursor } })
const shipment: ShipmentResponse = { ...shipmentFixture, status: 'CREATED' }
let root: Root, node: HTMLDivElement
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(getShipments).mockResolvedValue(page([shipment]))
  vi.mocked(getDrivers).mockResolvedValue(page([]))
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })
async function mount(path: string) {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin" element={<AdminLayout />}>
    <Route index element={<h1>Tổng quan minh họa</h1>} />
    <Route path="shipments" element={<AdminShipmentsPage />} /><Route path="drivers" element={<AdminDriversPage />} />
  </Route></Routes></MemoryRouter>))
}
describe('Admin API pages and demo boundaries', () => {
  it('keeps the shell accessible and labels only remaining demo pages', async () => {
    await mount('/admin/shipments')
    expect(node.querySelector('.ui-demo-notice')).toBeNull()
    expect(node.querySelector('a[href="#admin-main"]')).not.toBeNull()
    expect(node.textContent).toContain('1 đơn trong trang đang hiển thị')
    expect(node.querySelector('.data-table-wrapper[tabindex="0"]')).not.toBeNull()
    expect(node.querySelector('a[href*="shipmentId=sh_"]')).not.toBeNull()
  })
  it('keeps overview demo notice and does not claim true system health', async () => {
    await mount('/admin')
    expect(node.querySelector('.ui-demo-notice')?.textContent).toContain('dữ liệu mẫu')
    expect(node.textContent).not.toContain('Hệ thống ổn định')
  })
  it('sends filters to the server and resets pagination instead of filtering one mock page', async () => {
    await mount('/admin/shipments')
    const select = node.querySelector<HTMLSelectElement>('#admin-order-status')!
    await act(async () => { select.value = 'ASSIGNED'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(getShipments).toHaveBeenLastCalledWith({ status: 'ASSIGNED', trackingNumber: undefined, cursor: undefined }, expect.any(AbortSignal))
    const input = node.querySelector<HTMLInputElement>('#admin-order-search')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'PF20261018ABC234')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(getShipments).toHaveBeenLastCalledWith({ status: 'ASSIGNED', trackingNumber: 'PF20261018ABC234', cursor: undefined }, expect.any(AbortSignal))
  })
  it('uses opaque cursors, back navigation, and page-only counts', async () => {
    vi.mocked(getShipments).mockResolvedValueOnce(page([shipment], 'cursor+/=')).mockResolvedValue(page([]))
    await mount('/admin/shipments')
    const pager = () => node.querySelector('[aria-label="Phân trang đơn hàng"]')!
    await act(async () => [...pager().querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === 'Trang sau')!.click())
    expect(getShipments).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'cursor+/=' }), expect.any(AbortSignal))
    expect(pager().textContent).toContain('Trang 2')
    await act(async () => [...pager().querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === 'Trang trước')!.click())
    expect(getShipments).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined }), expect.any(AbortSignal))
  })
  it.each([401, 403, 404, 503])('shows HTTP %s as an error, never an empty list or demo fallback', async status => {
    vi.mocked(getShipments).mockRejectedValue(new ApiError(status, 'HTTP_ERROR'))
    await mount('/admin/shipments')
    expect(node.querySelector('[role="alert"]')).not.toBeNull()
    expect(node.querySelector('tbody')).toBeNull()
    expect(node.textContent).not.toContain('Không có đơn hàng')
    expect(node.textContent).not.toContain('PF-89025')
  })
  it('loads DriverResponse without inventing phone, vehicle or online state', async () => {
    vi.mocked(getDrivers).mockResolvedValue(page([{ id: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX', name: 'Tài xế thật',
      activeShipmentCount: 2, currentLocation: null, lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null }]))
    await mount('/admin/drivers')
    expect(node.textContent).toContain('Tài xế thật')
    expect(node.textContent).toContain('Chưa có vị trí được phép hiển thị')
    expect(node.querySelector('.ui-demo-notice')).toBeNull()
    expect(node.textContent).not.toContain('Số điện thoại')
    expect(node.querySelector('.admin-page')?.textContent).not.toContain('Đang hoạt động')
  })
  it('aborts stale list requests and ignores responses that arrive after filters change', async () => {
    let finish!: (value: ShipmentPage) => void
    vi.mocked(getShipments).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockResolvedValue(page([]))
    await mount('/admin/shipments')
    const oldSignal = vi.mocked(getShipments).mock.calls[0][1]!
    await act(async () => {
      const select = node.querySelector<HTMLSelectElement>('#admin-order-status')!
      select.value = 'DELIVERED'; select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(oldSignal.aborted).toBe(true)
    await act(async () => finish(page([shipment])))
    expect(node.textContent).not.toContain(shipmentFixture.trackingNumber)
    expect(node.textContent).toContain('Không có đơn hàng')
  })
})
