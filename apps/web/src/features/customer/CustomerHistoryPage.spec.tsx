import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { CustomerHistoryPage } from './CustomerHistoryPage'
import { CustomerShipmentDetailPage } from './CustomerShipmentDetailPage'
import { shipmentFixture } from './shipment-fixture'

const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), user: { id: 'customer-a' } }))
vi.mock('../../api/endpoints/shipments', () => ({ getShipments: api.list, getShipmentById: api.detail }))
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: api.user }) }))
vi.mock('../../components/shipment/ShipmentTracking', () => ({ ShipmentTracking: () => null }))

const delivered = { ...shipmentFixture, driverId: shipmentFixture.customerId, status: 'DELIVERED',
  updatedAt: '2026-11-09T04:00:00.000Z', proofOfDeliveryNotes: 'Giao tận tay' }
const page = (data: unknown[] = [], nextCursor: string | null = null) => ({ data,
  pagination: { limit: 20, hasMore: !!nextCursor, nextCursor } })
let node: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  api.list.mockReset(); api.detail.mockReset(); api.user = { id: 'customer-a' }
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })

function Navigation() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>Quay lại trong trình duyệt</button>
}
async function mount(path = '/customer/history') {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}>
    <Navigation /><Routes>
      <Route path="/customer/history" element={<CustomerHistoryPage />} />
      <Route path="/customer/shipments/:id" element={<CustomerShipmentDetailPage />} />
    </Routes>
  </MemoryRouter>))
}
async function click(label: string) {
  const button = [...node.querySelectorAll('button')].find(item => item.textContent === label)
  expect(button).toBeTruthy()
  await act(async () => button!.click())
}
async function select(value: string) {
  await act(async () => {
    const input = node.querySelector('select')!
    input.value = value; input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('Customer delivery history (API fixture)', () => {
  it('loads completed orders from the API and labels updatedAt without inventing completion time', async () => {
    api.list.mockResolvedValue(page([delivered])); await mount()
    expect(api.list.mock.calls[0][0]).toEqual({ status: 'DELIVERED', cursor: undefined })
    expect(node.querySelector('h1')?.textContent).toBe('Lịch sử giao hàng')
    expect(node.querySelector('tbody')?.textContent).toContain(delivered.trackingNumber)
    expect(node.querySelector('time')?.dateTime).toBe(delivered.updatedAt)
    expect(node.querySelector('th')?.textContent).toContain('Cập nhật')
    expect(node.querySelector('.demo-notice')).toBeNull()
    expect(node.textContent).not.toMatch(/dữ liệu mẫu|PF-88901|Thời gian hoàn tất|đơn trên trang|Không phải tổng số/)
    expect(api.detail).not.toHaveBeenCalled()
  })

  it('restores failed status and exact tracking from a direct URL, with only terminal options', async () => {
    api.list.mockResolvedValue(page()); await mount('/customer/history?status=DELIVERY_FAILED&trackingNumber=PF20261018ABC234')
    expect(api.list.mock.calls[0][0]).toEqual({ status: 'DELIVERY_FAILED', trackingNumber: delivered.trackingNumber, cursor: undefined })
    expect([...node.querySelectorAll<HTMLOptionElement>('select option')].map(item => item.value)).toEqual(['DELIVERED', 'DELIVERY_FAILED'])
    expect(node.querySelector('select')?.value).toBe('DELIVERY_FAILED')
  })

  it.each(['CREATED', 'ASSIGNED', 'PICKED_UP', 'unknown'])('never queries active orders for URL status %s', async status => {
    api.list.mockResolvedValue(page()); await mount('/customer/history?status=' + status)
    expect(api.list.mock.calls[0][0].status).toBe('DELIVERED')
  })

  it('uses server cursors and resets them on status change and browser Back', async () => {
    api.list.mockResolvedValue(page([delivered], 'cursor-delivered')); await mount()
    await click('Trang tiếp')
    expect(api.list.mock.calls.at(-1)![0].cursor).toBe('cursor-delivered')
    await select('DELIVERY_FAILED')
    expect(api.list.mock.calls.at(-1)![0]).toEqual({ status: 'DELIVERY_FAILED', cursor: undefined })
    await click('Quay lại trong trình duyệt')
    expect(api.list.mock.calls.at(-1)![0]).toEqual({ status: 'DELIVERED', cursor: undefined })
    expect(node.querySelector<HTMLButtonElement>('.customer-pagination button')?.disabled).toBe(true)
  })

  it('submits trimmed exact tracking while preserving the terminal status', async () => {
    api.list.mockResolvedValue(page()); await mount('/customer/history?status=DELIVERY_FAILED')
    await act(async () => {
      node.querySelector<HTMLInputElement>('[name=trackingNumber]')!.value = ' ' + delivered.trackingNumber + ' '
      node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(api.list.mock.calls.at(-1)![0]).toEqual({ status: 'DELIVERY_FAILED', trackingNumber: delivered.trackingNumber, cursor: undefined })
  })

  it('removes one filter independently and clearing filters resets history to delivered', async () => {
    api.list.mockResolvedValue(page()); await mount('/customer/history?status=DELIVERY_FAILED&trackingNumber=' + delivered.trackingNumber)
    await act(async () => node.querySelector<HTMLButtonElement>('[aria-label^="Bỏ lọc Mã vận đơn"]')!.click())
    expect(api.list.mock.calls.at(-1)![0]).toEqual({ status: 'DELIVERY_FAILED', cursor: undefined })
    await click('Xóa tất cả')
    expect(api.list.mock.calls.at(-1)![0]).toEqual({ status: 'DELIVERED', cursor: undefined })
    expect(node.querySelector('.ui-applied-filters')).toBeNull()
  })

  it('clears an unsubmitted search draft along with the active filter', async () => {
    api.list.mockResolvedValue(page()); await mount('/customer/history?status=DELIVERY_FAILED')
    node.querySelector<HTMLInputElement>('[name=trackingNumber]')!.value = 'draft'
    await click('Xóa tất cả')
    expect(node.querySelector<HTMLInputElement>('[name=trackingNumber]')!.value).toBe('')
    expect(node.querySelector('select')?.value).toBe('DELIVERED')
  })

  it('shows loading, errors and retry instead of sample rows, and refreshes the current cursor', async () => {
    let reject!: (error: Error) => void
    api.list.mockReturnValueOnce(new Promise((_, fail) => { reject = fail })).mockResolvedValue(page([delivered], 'next'))
    await mount(); expect(node.querySelector('.ui-data-skeleton')).not.toBeNull()
    await act(async () => reject(new ApiError(503, 'SERVICE_UNAVAILABLE')))
    expect(node.querySelector('[role=alert]')).not.toBeNull()
    expect(node.querySelector('tbody')).toBeNull()
    await click('Thử lại'); await click('Trang tiếp'); await click('Làm mới')
    expect(api.list.mock.calls.at(-1)![0]).toEqual({ status: 'DELIVERED', cursor: 'next' })
  })

  it('aborts stale reads and ignores their rows after changing status', async () => {
    let finish!: (value: unknown) => void
    api.list.mockReturnValueOnce(new Promise(resolve => { finish = resolve })).mockResolvedValue(page())
    await mount(); const signal = api.list.mock.calls[0][1] as AbortSignal
    await select('DELIVERY_FAILED'); expect(signal.aborted).toBe(true)
    await act(async () => finish(page([delivered])))
    expect(node.textContent).not.toContain(delivered.trackingNumber)
    expect(node.querySelector('.customer-empty h2')?.textContent).toBe('Chưa có đơn giao thất bại')
  })

  it('clears the previous account and cancels pending reads on account change and unmount', async () => {
    api.list.mockResolvedValueOnce(page([delivered])).mockReturnValue(new Promise(() => {}))
    await mount(); expect(node.textContent).toContain(delivered.trackingNumber)
    api.user = { id: 'customer-b' }; await mount()
    expect(node.textContent).not.toContain(delivered.trackingNumber)
    expect(node.querySelector('.ui-data-skeleton')).not.toBeNull()
    const signal = api.list.mock.calls.at(-1)![1] as AbortSignal
    await act(async () => root.render(<p>Đã rời trang</p>))
    expect(signal.aborted).toBe(true)
  })

  it('opens the existing detail route and reads server history and delivery notes', async () => {
    api.list.mockResolvedValue(page([delivered]))
    api.detail.mockResolvedValue({ ...delivered, statusHistory: [{ id: 'event', action: 'DELIVERED',
      fromStatus: 'PICKED_UP', toStatus: 'DELIVERED', actorUserId: delivered.driverId, actorRole: 'DRIVER',
      previousDriverId: delivered.driverId, newDriverId: delivered.driverId, reason: null, occurredAt: delivered.updatedAt }] })
    await mount()
    const link = node.querySelector<HTMLAnchorElement>('tbody a')!
    expect(link.getAttribute('href')).toBe('/customer/shipments/' + delivered.id)
    await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
    expect(api.detail.mock.calls[0][0]).toBe(delivered.id)
    expect(node.querySelector('.shipment-history')?.textContent).toContain('Giao thành công')
    expect(node.textContent).toContain('Giao tận tay')
    expect(node.querySelector('textarea')).toBeNull()
  })
})
