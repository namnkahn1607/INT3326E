import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminLayout } from '../../layouts/AdminLayout'
import { AdminShipmentsPage } from './AdminShipmentsPage'
import { AdminDriversPage } from './AdminDriversPage'
import { AdminOverviewPage } from './AdminOverviewPage'
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
  localStorage.removeItem('parcelflow:admin-theme')
  localStorage.removeItem('parcelflow:customer-theme')
  vi.resetAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(getShipments).mockResolvedValue(page([shipment]))
  vi.mocked(getDrivers).mockResolvedValue(page([]))
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => {
  await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks()
  localStorage.removeItem('parcelflow:admin-theme'); localStorage.removeItem('parcelflow:customer-theme')
})
async function mount(path: string) {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin" element={<AdminLayout />}>
    <Route index element={<AdminOverviewPage />} />
    <Route path="accounts" element={<h1>Tài khoản minh họa</h1>} />
    <Route path="shipments" element={<AdminShipmentsPage />} /><Route path="drivers" element={<AdminDriversPage />} />
  </Route></Routes></MemoryRouter>))
}
describe('Admin API pages and demo boundaries', () => {
  it('keeps the shell accessible and labels only remaining demo pages', async () => {
    await mount('/admin/shipments')
    expect(node.querySelector('.ui-demo-notice')).toBeNull()
    expect(node.querySelector('.dashboard-topbar-title')).toBeNull()
    expect(node.querySelector('.admin-page-kicker')).toBeNull()
    expect(node.textContent).not.toContain('Không gian làm việc')
    expect(node.querySelector('a[href="#admin-main"]')).not.toBeNull()
    expect(node.querySelector('.ui-result-count')).toBeNull()
    expect(node.querySelector('.data-table-wrapper[tabindex="0"]')).not.toBeNull()
    expect(node.querySelector('a[href*="shipmentId=sh_"]')).not.toBeNull()
    expect(node.querySelector('a[href="/admin/shipments/' + shipment.id + '"]')).not.toBeNull()
  })
  it('collapses the Admin sidebar and restores focus without duplicate page labels', async () => {
    await mount('/admin/shipments')
    const sidebar = node.querySelector<HTMLElement>('#dashboard-sidebar')!
    const collapse = node.querySelector<HTMLButtonElement>('[aria-label="Thu gọn thanh bên"]')!
    await act(async () => collapse.click())
    expect(sidebar.hidden).toBe(true)
    const reopen = node.querySelector<HTMLButtonElement>('[aria-label="Mở thanh bên"]')!
    expect(document.activeElement).toBe(reopen)
    expect(node.querySelector('.dashboard-toolbar .dashboard-theme-toggle')).not.toBeNull()
    expect(node.querySelector('.dashboard-toolbar-title')).toBeNull()
    await act(async () => reopen.click())
    expect(sidebar.hidden).toBe(false)
    expect(document.activeElement).toBe(collapse)
  })
  it('counts only loaded API orders and never claims system-wide health', async () => {
    await mount('/admin')
    expect(node.querySelector('.ui-demo-notice')).toBeNull()
    expect([...node.querySelectorAll('.dashboard-metric > strong')].map(item => item.textContent)).toEqual(['1', '1', '0', '0'])
    expect(getShipments).toHaveBeenCalledWith({ limit: 20 }, expect.any(AbortSignal))
    expect(node.querySelector('.dashboard-metrics')?.getAttribute('aria-label')).toContain('tối đa 20 đơn gần nhất')
    expect(node.querySelector('.dashboard-metric small')).toBeNull()
    expect(node.textContent).not.toContain('đã tải')
    expect(node.textContent).not.toContain('Hệ thống ổn định')
    expect(node.textContent).not.toContain('92%')
  })
  it('persists Admin light mode across routes/remounts without changing Customer preferences', async () => {
    localStorage.setItem('parcelflow:customer-theme', 'light')
    await mount('/admin/shipments')
    expect(node.querySelector('.admin-layout')?.getAttribute('data-theme')).toBe('dark')
    await act(async () => node.querySelector<HTMLButtonElement>('.dashboard-sidebar .dashboard-theme-toggle')!.click())
    expect(node.querySelector('.admin-layout')?.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('parcelflow:admin-theme')).toBe('light')
    await act(async () => node.querySelector<HTMLAnchorElement>('a[href="/admin/drivers"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
    expect(node.querySelector('h1')?.textContent).toBe('Tài xế')
    expect(node.querySelector('.admin-layout')?.getAttribute('data-theme')).toBe('light')
    await act(async () => root.unmount()); root = createRoot(node)
    await mount('/admin/shipments')
    expect(node.querySelector('.admin-layout')?.getAttribute('data-theme')).toBe('light')
    await act(async () => node.querySelector<HTMLButtonElement>('[aria-label="Thu gọn thanh bên"]')!.click())
    await act(async () => node.querySelector<HTMLButtonElement>('.dashboard-toolbar .dashboard-theme-toggle')!.click())
    expect(node.querySelector('.admin-layout')?.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('parcelflow:customer-theme')).toBe('light')
  })
  it('can switch Admin themes when browser storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
    await mount('/admin')
    await act(async () => node.querySelector<HTMLButtonElement>('.dashboard-theme-toggle')!.click())
    expect(node.querySelector('.admin-layout')?.getAttribute('data-theme')).toBe('light')
  })
  it('retains the demo notice on unconnected account screens', async () => {
    await mount('/admin/accounts')
    expect(node.querySelector('.ui-demo-notice')?.textContent).toContain('dữ liệu mẫu')
  })
  it('renders charts and a readable breakdown from the loaded orders only', async () => {
    vi.mocked(getShipments).mockResolvedValue(page([
      shipment,
      { ...shipment, id: 'sh_01ARZ3NDEKTSV4RRFFQ69G5FAW', status: 'DELIVERED' },
    ]))
    await mount('/admin')
    expect(node.querySelectorAll('.admin-bar-chart rect')).toHaveLength(1)
    expect(node.querySelector('.admin-bar-chart rect title')?.textContent).toContain('2 đơn')
    expect(node.querySelector('.admin-donut strong')?.textContent).toBe('2')
    const legend = [...node.querySelectorAll('.admin-chart-legend li')].map(item => item.textContent)
    expect(legend).toContain('Chờ gán tài xế150%')
    expect(legend).toContain('Giao thành công150%')
    expect(node.querySelector('.admin-chart-data dd')?.textContent).toBe('2 đơn')
    expect(getShipments).toHaveBeenCalledTimes(1)
  })
  it('keeps empty charts empty without drawing fake activity or invalid SVG values', async () => {
    vi.mocked(getShipments).mockResolvedValue(page([]))
    await mount('/admin')
    expect(node.querySelector('.admin-bar-chart')).toBeNull()
    expect(node.querySelector('.admin-donut circle[data-status]')).toBeNull()
    expect(node.querySelector('.admin-chart-empty')?.textContent).toContain('Chưa có đơn')
    expect(node.querySelector('.admin-overview-charts')?.innerHTML).not.toMatch(/NaN|Infinity/)
  })
  it('shows an unavailable overview without fake metrics, and allows retry', async () => {
    vi.mocked(getShipments).mockRejectedValueOnce(new ApiError(503, 'SERVICE_UNAVAILABLE')).mockResolvedValue(page([]))
    await mount('/admin')
    expect(node.querySelector('[role="alert"]')).not.toBeNull()
    expect(node.querySelector('.dashboard-metrics')).toBeNull()
    await act(async () => node.querySelector<HTMLButtonElement>('[role="alert"] button')!.click())
    expect([...node.querySelectorAll('.dashboard-metric > strong')].map(item => item.textContent)).toEqual(['0', '0', '0', '0'])
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
    await act(async () => node.querySelector<HTMLButtonElement>('[aria-label^="Bỏ lọc Trạng thái"]')!.click())
    expect(getShipments).toHaveBeenLastCalledWith({ status: undefined, trackingNumber: 'PF20261018ABC234', cursor: undefined }, expect.any(AbortSignal))
  })
  it.each(['Xóa bộ lọc', 'Xóa tất cả'])('clears an unsubmitted tracking draft with %s', async label => {
    await mount('/admin/shipments?status=ASSIGNED')
    const input = node.querySelector<HTMLInputElement>('#admin-order-search')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'PF20261018ABC234')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const clear = [...node.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label)!
    await act(async () => clear.click())
    expect(node.querySelector<HTMLInputElement>('#admin-order-search')!.value).toBe('')
    expect(node.querySelector<HTMLSelectElement>('#admin-order-status')!.value).toBe('')
    expect(getShipments).toHaveBeenLastCalledWith({ status: undefined, trackingNumber: undefined, cursor: undefined }, expect.any(AbortSignal))
    expect(node.querySelector('.ui-applied-filters')).toBeNull()
  })
  it('shows a missing Admin business mapping without disguising it as an empty search', async () => {
    vi.mocked(getShipments).mockRejectedValue(new ApiError(409, 'USER_NOT_PROVISIONED'))
    await mount('/admin/shipments')
    expect(node.querySelector('[role=alert]')?.textContent).toContain('Tài khoản chưa được liên kết')
    expect(node.querySelector('tbody')).toBeNull()
    expect(node.textContent).not.toContain('Không có đơn hàng')
    expect(node.querySelector('#admin-order-search')).not.toBeNull()
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
