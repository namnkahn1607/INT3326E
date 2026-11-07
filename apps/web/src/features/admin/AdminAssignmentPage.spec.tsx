import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDrivers } from '../../api/endpoints/drivers'
import { assignShipment, getShipmentById, getShipments } from '../../api/endpoints/shipments'
import { ApiError } from '../../api/client'
import { shipmentFixture } from '../customer/shipment-fixture'
import type { ShipmentDetail, ShipmentResponse } from '../../types/shipment-api'
import { AdminAssignmentPage } from './AdminAssignmentPage'

vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }))
vi.mock('../../api/endpoints/drivers', () => ({ getDrivers: vi.fn() }))
vi.mock('../../api/endpoints/shipments', async original => ({ ...await original<object>(), getShipments: vi.fn(), getShipmentById: vi.fn(), assignShipment: vi.fn() }))
const d1 = { id: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX', name: 'Tài xế An', activeShipmentCount: 3,
  currentLocation: null, lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null }
const d2 = { ...d1, id: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAY', name: 'Tài xế Bình' }
const detail: ShipmentDetail = { ...shipmentFixture, status: 'CREATED', statusHistory: [] }
const page = <T,>(data: T[], nextCursor: string | null = null) => ({ data, pagination: { limit: 20, hasMore: !!nextCursor, nextCursor } })
let root: Root, node: HTMLDivElement
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(getShipments).mockResolvedValue(page([detail]))
  vi.mocked(getDrivers).mockResolvedValue(page([d1, d2]))
  vi.mocked(getShipmentById).mockResolvedValue(detail)
  vi.mocked(assignShipment).mockResolvedValue({ ...shipmentFixture, status: 'ASSIGNED', driverId: d1.id })
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })
async function mount(path = '/admin/assignment') { await act(async () => root.render(<MemoryRouter initialEntries={[path]}><AdminAssignmentPage /></MemoryRouter>)) }
function button(text: string) {
  const found = [...node.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes(text))
  if (!found) throw new Error('Missing button: ' + text)
  return found
}
async function click(text: string) { await act(async () => button(text).click()) }
async function ready() { await mount(); await click(shipmentFixture.trackingNumber); await click(d1.name) }

describe('Admin assignment integration — mocked endpoints', () => {
  it('reads Detail, permits a driver with multiple orders, and requires separate confirmation', async () => {
    await ready()
    expect(getShipmentById).toHaveBeenCalledWith(shipmentFixture.id, expect.any(AbortSignal))
    expect(assignShipment).not.toHaveBeenCalled()
    await click('Xem lại phân công')
    expect(node.querySelector('[aria-labelledby="assignment-review-title"]')).not.toBeNull()
    await click('Xác nhận phân công')
    expect(assignShipment).toHaveBeenCalledTimes(1)
    expect(assignShipment).toHaveBeenCalledWith(shipmentFixture.id, d1.id, expect.any(AbortSignal))
    expect(node.textContent).toContain('Máy chủ đã xác nhận')
    expect(node.textContent).not.toContain('Đang online')
  })
  it('blocks duplicate clicks while a request is pending', async () => {
    let finish!: (value: ShipmentResponse) => void
    vi.mocked(assignShipment).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await ready(); await click('Xem lại phân công')
    await act(async () => { button('Xác nhận phân công').click(); button('Xác nhận phân công').click() })
    expect(assignShipment).toHaveBeenCalledTimes(1)
    expect(button('Đang phân công').disabled).toBe(true)
    await act(async () => finish({ ...shipmentFixture, status: 'ASSIGNED', driverId: d1.id }))
  })
  it('allows explicit reassignment but explains the current-driver no-op', async () => {
    vi.mocked(getShipmentById).mockResolvedValue({ ...detail, status: 'ASSIGNED', driverId: d1.id })
    await mount('/admin/assignment?shipmentId=' + detail.id)
    await click(d1.name)
    expect(button('Xem lại phân công').disabled).toBe(true)
    expect(node.textContent).toContain('đã là tài xế hiện hành')
    await click(d2.name); await click('Xem lại phân công')
    expect(node.textContent).toContain('Gán lại')
    await click('Hủy xác nhận')
    expect(assignShipment).not.toHaveBeenCalled()
  })
  it.each(['PICKED_UP', 'DELIVERED', 'DELIVERY_FAILED'] as const)('does not allow assigning %s', async status => {
    vi.mocked(getShipmentById).mockResolvedValue({ ...detail, status, driverId: d1.id })
    await mount('/admin/assignment?shipmentId=' + detail.id)
    expect(button('Xem lại phân công').disabled).toBe(true)
    expect(node.textContent).toContain('không còn cho phép phân công')
  })
  it.each([new ApiError(409, 'CONFLICT'), new ApiError(0, 'REQUEST_TIMEOUT'), new ApiError(0, 'NETWORK_ERROR'),
    new ApiError(503, 'SERVICE_UNAVAILABLE'), new ApiError(0, 'INVALID_RESPONSE')])('reconciles %s with GET only and clears old intent', async error => {
    await ready()
    vi.mocked(assignShipment).mockRejectedValue(error)
    vi.mocked(getShipmentById).mockResolvedValue({ ...detail, status: 'ASSIGNED', driverId: d2.id })
    await click('Xem lại phân công'); await click('Xác nhận phân công')
    expect(assignShipment).toHaveBeenCalledTimes(1)
    expect(getShipmentById).toHaveBeenCalledTimes(2)
    expect(node.textContent).toContain('Đã đọc lại trạng thái hiện tại')
    expect(node.textContent).not.toContain('Máy chủ đã xác nhận')
    expect(button('Xem lại phân công').disabled).toBe(true)
  })
  it('keeps writing locked when reconciliation fails; retry is GET, not POST', async () => {
    await ready()
    vi.mocked(assignShipment).mockRejectedValue(new ApiError(0, 'REQUEST_TIMEOUT'))
    vi.mocked(getShipmentById).mockRejectedValue(new ApiError(503, 'SERVICE_UNAVAILABLE'))
    await click('Xem lại phân công'); await click('Xác nhận phân công')
    expect(button('Xem lại phân công').disabled).toBe(true)
    vi.mocked(getShipmentById).mockResolvedValue(detail)
    await click('Đọc lại chi tiết')
    expect(assignShipment).toHaveBeenCalledTimes(1)
    expect(button('Xem lại phân công').disabled).toBe(true)
    await click(d1.name); await click('Xem lại phân công')
    expect(assignShipment).toHaveBeenCalledTimes(1)
  })
  it('shows USER_NOT_PROVISIONED as an account issue, not a pickup conflict', async () => {
    await ready(); vi.mocked(assignShipment).mockRejectedValue(new ApiError(409, 'USER_NOT_PROVISIONED'))
    await click('Xem lại phân công'); await click('Xác nhận phân công')
    expect(node.textContent).toContain('Tài khoản chưa được liên kết')
    expect(getShipmentById).toHaveBeenCalledTimes(1)
  })
  it('does not show sample data when shipments fail or allow an invalid deep-link ID', async () => {
    vi.mocked(getShipments).mockRejectedValue(new ApiError(404, 'RESOURCE_NOT_FOUND'))
    await mount('/admin/assignment?shipmentId=bad')
    expect(node.textContent).toContain('API chưa được triển khai')
    expect(getShipmentById).not.toHaveBeenCalled()
    expect(assignShipment).not.toHaveBeenCalled()
  })
  it('paginates drivers independently and discards selections on page change', async () => {
    vi.mocked(getDrivers).mockResolvedValueOnce(page([d1], 'opaque+/=')).mockResolvedValue(page([d2]))
    await ready()
    const next = node.querySelector<HTMLElement>('[aria-label="Phân trang tài xế"]')!
    await act(async () => [...next.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === 'Trang sau')!.click())
    expect(getDrivers).toHaveBeenLastCalledWith({ cursor: 'opaque+/=' }, expect.any(AbortSignal))
    expect(button('Xem lại phân công').disabled).toBe(true)
    expect(getShipments).toHaveBeenCalledTimes(1)
  })
  it('ignores old Detail responses after the Admin selects a different shipment', async () => {
    const second: ShipmentDetail = { ...detail, id: 'sh_01ARZ3NDEKTSV4RRFFQ69G5FAW', trackingNumber: 'PF20261024BCD234' }
    let finish!: (value: ShipmentDetail) => void
    vi.mocked(getShipments).mockResolvedValue(page([detail, second]))
    vi.mocked(getShipmentById).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockResolvedValue(second)
    await mount(); await click(detail.trackingNumber)
    const oldSignal = vi.mocked(getShipmentById).mock.calls[0][1]!
    await click(second.trackingNumber)
    expect(oldSignal.aborted).toBe(true)
    await act(async () => finish(detail))
    const editor = node.querySelector('.admin-assignment-editor')!
    expect(editor.textContent).toContain(second.trackingNumber)
    expect(editor.textContent).not.toContain(detail.trackingNumber)
    expect(assignShipment).not.toHaveBeenCalled()
  })
  it('aborts a pending write on leaving the editor without replay or late success', async () => {
    let finish!: (value: ShipmentResponse) => void
    vi.mocked(assignShipment).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await ready(); await click('Xem lại phân công'); await click('Xác nhận phân công')
    const writeSignal = vi.mocked(assignShipment).mock.calls[0][2]!
    await act(async () => root.render(<p>Đã rời trang phân công</p>))
    expect(writeSignal.aborted).toBe(true)
    await act(async () => finish({ ...detail, status: 'ASSIGNED', driverId: d1.id }))
    expect(node.textContent).toBe('Đã rời trang phân công')
    expect(assignShipment).toHaveBeenCalledTimes(1)
    expect(getShipmentById).toHaveBeenCalledTimes(1)
  })
})
