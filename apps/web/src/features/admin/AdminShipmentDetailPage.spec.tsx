import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { failShipment, getShipmentById } from '../../api/endpoints/shipments'
import type { ShipmentDetail, ShipmentResponse } from '../../types/shipment-api'
import { shipmentFixture } from '../customer/shipment-fixture'
import { AdminShipmentDetailPage } from './AdminShipmentDetailPage'

vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }))
vi.mock('../../components/shipment/ShipmentTracking', () => ({ ShipmentTracking: () => null }))
vi.mock('../../api/endpoints/shipments', async original => ({ ...await original<object>(), getShipmentById: vi.fn(), failShipment: vi.fn() }))
const driver = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX'
const picked: ShipmentDetail = { ...shipmentFixture, status: 'PICKED_UP', driverId: driver, statusHistory: [] }
const failed: ShipmentResponse = { ...picked, status: 'DELIVERY_FAILED', failureReason: 'Người nhận từ chối', failedByRole: 'ADMIN', failedByUserId: driver }
let root: Root, node: HTMLDivElement
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(getShipmentById).mockResolvedValue(picked)
  vi.mocked(failShipment).mockResolvedValue(failed)
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })
async function mount() { await act(async () => root.render(<MemoryRouter initialEntries={['/admin/shipments/' + picked.id]}>
  <Routes><Route path="/admin/shipments/:id" element={<AdminShipmentDetailPage />} /></Routes></MemoryRouter>)) }
function button(text: string) {
  const value = [...node.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes(text))
  if (!value) throw new Error('Missing button: ' + text)
  return value
}
async function click(text: string) { await act(async () => button(text).click()) }
async function reason(value = 'Người nhận từ chối') {
  await act(async () => {
    const input = node.querySelector('textarea')!
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function review() { await reason(); await click('Xem lại báo cáo') }

describe('Admin lifecycle — mocked API', () => {
  it('requires reason and separate confirmation; success reloads server history', async () => {
    await mount(); await click('Xem lại báo cáo')
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('5 đến 500')
    expect(document.activeElement).toBe(node.querySelector('textarea'))
    await review()
    expect(failShipment).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(node.querySelector('.shipment-failure-review'))
    vi.mocked(getShipmentById).mockResolvedValue({ ...failed, statusHistory: [] })
    await click('Xác nhận giao thất bại')
    expect(failShipment).toHaveBeenCalledExactlyOnceWith(picked.id, 'Người nhận từ chối', expect.any(AbortSignal))
    expect(getShipmentById).toHaveBeenCalledTimes(2)
    expect(node.textContent).toContain('Máy chủ đã xác nhận giao thất bại')
    expect(node.querySelector('textarea')).toBeNull()
    expect(node.textContent).toContain(failed.failureReason)
  })
  it.each(['CREATED', 'ASSIGNED', 'DELIVERED', 'DELIVERY_FAILED'] as const)('does not offer Fail for %s', async status => {
    vi.mocked(getShipmentById).mockResolvedValue({ ...picked, status })
    await mount()
    expect(node.querySelector('textarea')).toBeNull()
    expect(failShipment).not.toHaveBeenCalled()
    expect(node.textContent).not.toContain('Xác nhận giao thất bại')
  })
  it('blocks duplicate writes and preserves a confirmed result when history reload fails', async () => {
    let finish!: (value: ShipmentResponse) => void
    vi.mocked(failShipment).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await mount(); await review()
    await act(async () => { button('Xác nhận giao thất bại').click(); button('Xác nhận giao thất bại').click() })
    expect(failShipment).toHaveBeenCalledTimes(1)
    vi.mocked(getShipmentById).mockRejectedValue(new ApiError(503, 'SERVICE_UNAVAILABLE'))
    await act(async () => finish(failed))
    expect(node.textContent).toContain('Máy chủ đã xác nhận giao thất bại')
    expect(node.textContent).toContain(failed.failureReason)
    expect(node.querySelector('[role="alert"]')).not.toBeNull()
    expect(node.querySelector('textarea')).toBeNull()
    await click('Đọc lại thông tin')
    expect(node.textContent).toContain('Máy chủ đã xác nhận giao thất bại')
    expect(node.textContent).toContain(failed.failureReason)
    expect(node.textContent).not.toContain('Chưa xác định được kết quả')
    expect(failShipment).toHaveBeenCalledTimes(1)
  })
  it.each([new ApiError(409, 'INVALID_STATE_TRANSITION'), new ApiError(0, 'REQUEST_TIMEOUT'),
    new ApiError(0, 'NETWORK_ERROR'), new ApiError(503, 'SERVICE_UNAVAILABLE'), new ApiError(0, 'INVALID_RESPONSE')])('only reads Detail after uncertain %s', async error => {
    await mount(); await review()
    vi.mocked(failShipment).mockRejectedValue(error)
    vi.mocked(getShipmentById).mockResolvedValue({ ...failed, statusHistory: [] })
    await click('Xác nhận giao thất bại')
    expect(failShipment).toHaveBeenCalledTimes(1)
    expect(getShipmentById).toHaveBeenCalledTimes(2)
    expect(node.textContent).toContain('Đã đọc lại trạng thái hiện tại')
    expect(node.textContent).not.toContain('Máy chủ đã xác nhận')
  })
  it('locks writes after failed reconciliation and clears the old reason before a new intent', async () => {
    await mount(); await review()
    vi.mocked(failShipment).mockRejectedValue(new ApiError(0, 'REQUEST_TIMEOUT'))
    vi.mocked(getShipmentById).mockRejectedValue(new ApiError(503, 'SERVICE_UNAVAILABLE'))
    await click('Xác nhận giao thất bại')
    expect(node.querySelector('textarea')).toBeNull()
    expect(document.activeElement).toBe(button('Đọc lại thông tin'))
    vi.mocked(getShipmentById).mockResolvedValue(picked)
    await click('Đọc lại thông tin')
    expect(node.querySelector('textarea')?.value).toBe('')
    expect(failShipment).toHaveBeenCalledTimes(1)
    await click('Xem lại báo cáo')
    expect(failShipment).toHaveBeenCalledTimes(1)
  })
  it('keeps linkage errors distinct from state conflicts', async () => {
    await mount(); await review()
    vi.mocked(failShipment).mockRejectedValue(new ApiError(409, 'USER_NOT_PROVISIONED'))
    await click('Xác nhận giao thất bại')
    expect(node.textContent).toContain('Tài khoản chưa được liên kết')
    expect(getShipmentById).toHaveBeenCalledTimes(1)
  })
  it('reports Fail validation without assignment wording or automatic retries', async () => {
    await mount(); await review()
    vi.mocked(failShipment).mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR'))
    await click('Xác nhận giao thất bại')
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('lý do')
    expect(node.querySelector('[role="alert"]')?.textContent).not.toContain('tài xế đã chọn')
    expect(getShipmentById).toHaveBeenCalledTimes(1)
    expect(failShipment).toHaveBeenCalledTimes(1)
    expect(node.querySelector('textarea')?.value).toBe('Người nhận từ chối')
  })
  it('aborts the initial detail read and ignores a response after unmount', async () => {
    let finish!: (value: ShipmentDetail) => void
    vi.mocked(getShipmentById).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await mount()
    const signal = vi.mocked(getShipmentById).mock.calls[0][1]!
    await act(async () => root.render(<p>Đã rời trang</p>))
    expect(signal.aborted).toBe(true)
    await act(async () => finish(picked))
    expect(node.textContent).toBe('Đã rời trang')
    expect(failShipment).not.toHaveBeenCalled()
  })
  it('aborts writes on unmount and ignores late success without reading again', async () => {
    let finish!: (value: ShipmentResponse) => void
    vi.mocked(failShipment).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await mount(); await review(); await click('Xác nhận giao thất bại')
    const signal = vi.mocked(failShipment).mock.calls[0][2]!
    await act(async () => root.render(<p>Đã rời trang</p>))
    expect(signal.aborted).toBe(true)
    await act(async () => finish(failed))
    expect(node.textContent).toBe('Đã rời trang')
    expect(getShipmentById).toHaveBeenCalledTimes(1)
  })
  it('shows 404 as an error with no invented detail or write form', async () => {
    vi.mocked(getShipmentById).mockRejectedValue(new ApiError(404, 'RESOURCE_NOT_FOUND'))
    await mount()
    expect(node.querySelector('[role="alert"]')).not.toBeNull()
    expect(node.querySelector('textarea')).toBeNull()
    expect(node.textContent).not.toContain(picked.trackingNumber)
  })
})
