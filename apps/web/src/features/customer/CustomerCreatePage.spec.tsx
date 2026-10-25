import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerCreatePage } from './CustomerCreatePage'
import { shipmentFixture } from './shipment-fixture'
import { ApiError } from '../../api/client'
import type { ShipmentAddressValue } from './ShipmentAddressModal'

const api = vi.hoisted(() => ({ create: vi.fn(), identity: 'customer-a',
  value: null as ShipmentAddressValue | null,
  save: undefined as undefined | ((value: ShipmentAddressValue) => void),
  close: undefined as undefined | (() => void),
}))
vi.mock('../../api/endpoints/shipments', () => ({ createShipment: api.create }))
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { id: api.identity } }) }))
vi.mock('./ShipmentAddressModal', () => ({ ShipmentAddressModal: ({ value, onSave, onClose }: {
  value: ShipmentAddressValue; onSave: (value: ShipmentAddressValue) => void; onClose: () => void
}) => { api.value = value; api.save = onSave; api.close = onClose; return <div data-testid="address-modal" /> } }))
let node: HTMLDivElement
let root: Root
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  api.create.mockReset(); api.identity = 'customer-a'; api.value = null
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  await act(async () => root.render(<MemoryRouter><CustomerCreatePage /></MemoryRouter>))
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); vi.useRealTimers() })
async function fill(name: string, value: string) {
  await act(async () => {
    const input = node.querySelector<HTMLInputElement>('[name="' + name + '"]')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const address = (kind: 'pickup' | 'dropoff'): ShipmentAddressValue => ({ street: kind === 'pickup' ? '144 Xuan Thuy' : '1 Dai Co Viet',
  area: '', details: '', point: kind === 'pickup' ? { lat: 0, lng: 0 } : { lat: 21, lng: 105 }, divisions: null })
async function open(kind: 'pickup' | 'dropoff') { await act(async () => node.querySelector<HTMLButtonElement>('#shipment-' + kind + 'Location')!.click()) }
async function save(kind: 'pickup' | 'dropoff', patch: Partial<ShipmentAddressValue> = {}) {
  await open(kind); await act(async () => api.save!({ ...address(kind), ...patch }))
}
async function valid() {
  await save('pickup'); await save('dropoff')
  await fill('recipientName', 'Nguoi nhan'); await fill('recipientPhone', '0901234567')
  await fill('senderName', 'Nguoi gui'); await fill('senderPhone', '0912345678')
}
async function submit() { await act(async () => node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))) }

describe('Customer Create journey (mock address dialog/API)', () => {
  it('shows compact address triggers without coordinate or address inputs on the main form', () => {
    expect(node.querySelectorAll('[aria-haspopup="dialog"]')).toHaveLength(2)
    expect(node.querySelector('[name="pickupAddress"]')).toBeNull()
    expect(node.querySelector('[name="pickupLat"]')).toBeNull()
    expect(node.textContent).toContain('Bên gửi'); expect(node.textContent).toContain('Bên nhận')
    expect(node.querySelector<HTMLInputElement>('[name=senderName]')!.required).toBe(true)
    expect(node.querySelector<HTMLInputElement>('[name=senderPhone]')!.type).toBe('tel')
    for (const label of node.querySelectorAll('.form-group label')) {
      const control = document.getElementById(label.getAttribute('for')!) as HTMLInputElement | HTMLButtonElement
      if ((control instanceof HTMLInputElement && control.required) || control?.getAttribute('aria-haspopup') === 'dialog') {
        expect(label.querySelector('.shipment-required')?.textContent).toContain('*')
      }
    }
  })
  it('focuses the address trigger for invalid or missing address/coordinates', async () => {
    await submit()
    expect(api.create).not.toHaveBeenCalled()
    expect(document.activeElement?.id).toBe('shipment-pickupLocation')
    expect(node.querySelector('#shipment-pickupLocation')?.getAttribute('aria-invalid')).toBe('true')
  })
  it('keeps the existing submit action in the same form without unsupported pricing or draft controls', () => {
    const panel = node.querySelector('aside[aria-label="Thao tác tạo đơn"]')!
    const submitButton = panel.querySelector<HTMLButtonElement>('button[type=submit]')!
    expect(submitButton.form).toBe(node.querySelector('form'))
    expect(node.querySelectorAll('button[type=submit]')).toHaveLength(1)
    expect(node.querySelector('.shipment-party-card')?.textContent).toContain('Bên nhận')
    expect(node.querySelector('.shipment-extra-card')?.textContent).toContain('Thông tin bổ sung')
    for (const unsupported of ['Phí dịch vụ', 'Tổng phí', 'Mã khuyến mãi', 'Lưu nháp', 'Bên trả phí']) {
      expect(node.textContent).not.toContain(unsupported)
    }
  })
  it('opens the saved address snapshot and applies changes only on save', async () => {
    await save('pickup', { details: 'So 144, can ho 2', area: 'Ha Noi' }); await open('pickup')
    expect(api.value).toMatchObject({ details: 'So 144, can ho 2', area: 'Ha Noi', point: { lat: 0, lng: 0 } })
    await act(async () => api.close!())
    expect(node.querySelector('#shipment-pickupLocation')?.textContent).toContain('So 144, can ho 2')
    expect(node.querySelector('#shipment-pickupLocation')?.getAttribute('title')).toBe('So 144, can ho 2, 144 Xuan Thuy, Ha Noi')
    expect(node.querySelector('[data-testid="address-modal"]')).toBeNull()
    expect(api.create).not.toHaveBeenCalled()
  })
  it('sends map points including zero and composed private instructions without UI-only fields', async () => {
    api.create.mockResolvedValue(shipmentFixture)
    await valid(); await save('pickup', { street: 'Duong Xuan Thuy', area: 'Ha Noi', details: 'Tang 2, cong sau',
      divisions: { province: { code: 1, name: 'Ha Noi' }, district: { code: 5, name: 'Cau Giay' }, ward: { code: 160, name: 'Quan Hoa' } } })
    await submit()
    expect(api.create.mock.calls[0][0]).toMatchObject({ pickupAddress: 'Tang 2, cong sau, Duong Xuan Thuy, Ha Noi',
      pickupLocation: { lat: 0, lng: 0 }, dropoffLocation: { lat: 21, lng: 105 } })
    for (const key of ['pickupDetails', 'province', 'district', 'ward', 'divisions']) expect(api.create.mock.calls[0][0]).not.toHaveProperty(key)
    expect(node.textContent).toContain(shipmentFixture.trackingNumber)
  })
  it('blocks main submission while editing an address', async () => {
    await valid(); await open('pickup'); await submit(); expect(api.create).not.toHaveBeenCalled()
    await act(async () => api.close!()); api.create.mockResolvedValue(shipmentFixture); await submit()
    expect(api.create).toHaveBeenCalledTimes(1)
  })
  it('keeps sender inputs local until dedicated API fields exist and never appends them to notes', async () => {
    api.create.mockResolvedValue(shipmentFixture)
    await valid(); await fill('notes', 'Ghi chu TEST'); await submit()
    expect(api.create.mock.calls[0][0]).not.toHaveProperty('senderName')
    expect(api.create.mock.calls[0][0]).not.toHaveProperty('senderPhone')
    expect(api.create.mock.calls[0][0].notes).toBe('Ghi chu TEST')
  })
  it('retains editable saved addresses after a definitive missing endpoint response', async () => {
    api.create.mockRejectedValue(new ApiError(404, 'RESOURCE_NOT_FOUND')); await valid(); await submit()
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('POST /v1/shipments, HTTP 404')
    expect(node.textContent).not.toContain('Yêu cầu bị từ chối')
    expect(node.querySelector<HTMLButtonElement>('#shipment-pickupLocation')!.disabled).toBe(false)
    await open('pickup'); expect(api.value!.street).toBe('144 Xuan Thuy')
  })
  it('focuses the address trigger for server coordinate errors', async () => {
    api.create.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', [{ field: 'dropoffLocation.lng', message: 'invalid' }]))
    await valid(); await submit()
    expect(document.activeElement?.id).toBe('shipment-dropoffLocation')
    expect(node.querySelector('#shipment-dropoffLocation')?.getAttribute('aria-invalid')).toBe('true')
  })
  it('validates phone on blur and preserves focus while correcting it', async () => {
    await fill('recipientPhone', '09')
    const phone = node.querySelector<HTMLInputElement>('[name="recipientPhone"]')!
    expect(phone.getAttribute('aria-invalid')).toBe('false')
    await act(async () => phone.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    phone.focus(); await fill('recipientPhone', '091')
    expect(phone.getAttribute('aria-invalid')).toBe('true'); expect(document.activeElement).toBe(phone)
    await fill('recipientPhone', '0901234567')
    expect(phone.getAttribute('aria-invalid')).toBe('false'); expect(document.activeElement).toBe(phone)
    expect(api.create).not.toHaveBeenCalled()
  })
  it('blocks double submit, generates an idempotency key and only confirms a server tracking number', async () => {
    let finish!: (value: unknown) => void
    api.create.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await valid(); await submit(); await submit()
    expect(api.create).toHaveBeenCalledTimes(1)
    expect(api.create.mock.calls[0][1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    await act(async () => finish(shipmentFixture))
    expect(node.querySelector('a[href="/customer/shipments/' + shipmentFixture.id + '"]')).not.toBeNull()
  })
  it('retains key/body and locks editing after a timeout even when the deadline passes', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-18T04:00:00Z'))
    api.create.mockRejectedValueOnce(new ApiError(0, 'REQUEST_TIMEOUT')).mockResolvedValueOnce(shipmentFixture)
    const future = new Date(Date.now() + 60_000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const local = future.getFullYear() + '-' + pad(future.getMonth() + 1) + '-' + pad(future.getDate()) + 'T' + pad(future.getHours()) + ':' + pad(future.getMinutes())
    await valid(); await fill('expectedDeliveryAt', local); await submit()
    expect(node.querySelector<HTMLButtonElement>('#shipment-pickupLocation')!.disabled).toBe(true)
    vi.setSystemTime(new Date('2026-10-18T04:02:00Z')); await submit()
    expect(api.create.mock.calls[1].slice(0, 2)).toEqual(api.create.mock.calls[0].slice(0, 2))
  })
  it('does not mix drafts between users or apply an old response', async () => {
    let finish!: (value: unknown) => void
    api.create.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await valid(); await submit(); api.identity = 'customer-b'
    await act(async () => root.render(<MemoryRouter><CustomerCreatePage /></MemoryRouter>))
    await act(async () => finish(shipmentFixture))
    expect(node.textContent).not.toContain(shipmentFixture.trackingNumber)
    await open('pickup'); expect(api.value!.street).toBe('')
  })
  it.each([[401, 'UNAUTHENTICATED', 'đăng nhập'], [403, 'FORBIDDEN_RESOURCE', 'không có quyền'],
    [409, 'USER_NOT_PROVISIONED', 'chưa được liên kết'], [409, 'IDEMPOTENCY_KEY_CONFLICT', 'dữ liệu khác']])(
    'shows safe recovery for %s %s', async (status, code, message) => {
      api.create.mockRejectedValue(new ApiError(status, code)); await valid(); await submit()
      expect(node.querySelector('[role="alert"]')!.textContent).toContain(message)
      expect(node.textContent).not.toContain('Đã tạo đơn thành công')
    })
  it('links server validation to known fields without exposing diagnostics', async () => {
    api.create.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', [{ field: 'recipientPhone', message: 'private diagnostic' }]))
    await valid(); await submit()
    expect(node.querySelector('[name="recipientPhone"]')?.getAttribute('aria-invalid')).toBe('true')
    expect(node.querySelector<HTMLInputElement>('[name="recipientPhone"]')!.disabled).toBe(false)
    expect(document.activeElement?.id).toBe('shipment-recipientPhone')
    expect(node.textContent).not.toContain('private diagnostic')
  })
  it.each([400, 503])('does not reuse an expired unchanged intent after HTTP %s', async status => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-18T04:00:00Z'))
    api.create.mockRejectedValue(new ApiError(status, status === 400 ? 'VALIDATION_ERROR' : 'SERVICE_UNAVAILABLE'))
    await valid(); await submit()
    vi.setSystemTime(new Date('2026-10-19T04:00:00Z')); await submit()
    expect(api.create).toHaveBeenCalledTimes(1); expect(node.textContent).toContain('quá 24 giờ')
  })
})
