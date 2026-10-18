import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerCreatePage } from './CustomerCreatePage'
import { shipmentFixture } from './shipment-fixture'
import { ApiError } from '../../api/client'

const api = vi.hoisted(() => ({ create: vi.fn(), identity: 'customer-a' }))
vi.mock('../../api/endpoints/shipments', () => ({ createShipment: api.create }))
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { id: api.identity } }) }))
vi.mock('./ShipmentLocationPicker', () => ({ ShipmentLocationPicker: ({ kind, point, query, disabled, error, onSelect }: {
  kind: 'pickup' | 'dropoff'; point: { lat: number; lng: number } | null; disabled: boolean; error?: string
  query?: string
  onSelect: (point: { lat: number; lng: number }) => void
}) => <button type="button" id={'shipment-' + kind + 'Location'} data-testid={'choose-' + kind}
  data-selected={!!point} data-query={query} disabled={disabled} aria-invalid={!!error}
  onClick={() => onSelect(kind === 'pickup' ? { lat: 0, lng: 0 } : { lat: 21, lng: 105 })}>Chọn vị trí</button> }))
let node: HTMLDivElement
let root: Root
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  api.create.mockReset(); api.identity = 'customer-a'
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  await act(async () => root.render(<MemoryRouter><CustomerCreatePage /></MemoryRouter>))
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); vi.useRealTimers() })
async function fill(name: string, value: string) {
  await act(async () => {
    const input = node.querySelector<HTMLInputElement>(`[name="${name}"]`)!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function valid() {
  for (const [name, value] of Object.entries({ pickupAddress: '144 Xuan Thuy',
    dropoffAddress: '1 Dai Co Viet', recipientName: 'Nguoi nhan', recipientPhone: '0901234567' })) await fill(name, value)
  for (const kind of ['pickup', 'dropoff']) await act(async () => node.querySelector<HTMLButtonElement>('[data-testid="choose-' + kind + '"]')!.click())
}
async function submit() { await act(async () => { node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }

describe('Customer Create journey (mock only)', () => {
  it('focuses the first invalid field and retains the linked error summary without a request', async () => {
    await submit()
    expect(api.create).not.toHaveBeenCalled()
    expect(document.activeElement?.id).toBe('shipment-pickupAddress')
    expect(node.querySelector('#shipment-pickupLocation')?.getAttribute('aria-invalid')).toBe('true')
    expect(node.querySelector('input[name="pickupLat"]')).toBeNull()
    expect(node.querySelector('input[name="dropoffLng"]')).toBeNull()
  })
  it('sends map-selected points, including zero, without asking for coordinate inputs', async () => {
    api.create.mockResolvedValue(shipmentFixture)
    await valid(); await submit()
    expect(api.create.mock.calls[0][0]).toMatchObject({ pickupLocation: { lat: 0, lng: 0 }, dropoffLocation: { lat: 21, lng: 105 } })
    expect(node.textContent).toContain(shipmentFixture.trackingNumber)
  })
  it('keeps private address details out of geocoding while including them in the shipment', async () => {
    api.create.mockResolvedValue(shipmentFixture)
    await valid(); await fill('pickupAddress', 'Duong Xuan Thuy'); await fill('pickupArea', 'Ha Noi'); await fill('pickupDetails', 'So 144, can ho 2')
    expect(node.querySelector('#shipment-pickupLocation')?.getAttribute('data-query')).toBe('Duong Xuan Thuy, Ha Noi')
    await act(async () => node.querySelector<HTMLButtonElement>('#shipment-pickupLocation')!.click())
    await submit()
    expect(api.create.mock.calls[0][0].pickupAddress).toBe('So 144, can ho 2, Duong Xuan Thuy, Ha Noi')
    expect(api.create.mock.calls[0][0]).not.toHaveProperty('pickupDetails')
  })
  it('clears only the corresponding point when an address changes and requires selecting it again', async () => {
    await valid(); await fill('pickupAddress', 'Dia chi lay hang moi')
    expect(node.querySelector('#shipment-pickupLocation')?.getAttribute('data-selected')).toBe('false')
    expect(node.querySelector('#shipment-dropoffLocation')?.getAttribute('data-selected')).toBe('true')
    await submit()
    expect(api.create).not.toHaveBeenCalled()
    expect(document.activeElement?.id).toBe('shipment-pickupLocation')
  })
  it('identifies a missing Create endpoint instead of claiming an order is missing', async () => {
    api.create.mockRejectedValue(new ApiError(404, 'RESOURCE_NOT_FOUND'))
    await valid(); await submit()
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('POST /v1/shipments, HTTP 404')
    expect(node.textContent).not.toContain('Đã tạo đơn thành công')
  })
  it('focuses the map picker for server-side coordinate errors', async () => {
    api.create.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', [{ field: 'dropoffLocation.lng', message: 'invalid' }]))
    await valid(); await submit()
    expect(document.activeElement?.id).toBe('shipment-dropoffLocation')
    expect(node.querySelector('#shipment-dropoffLocation')?.getAttribute('aria-invalid')).toBe('true')
  })
  it('waits for blur, retains an error while invalid, and does not steal focus while correcting it', async () => {
    await fill('recipientPhone', '09')
    expect(node.querySelector('[name="recipientPhone"]')?.getAttribute('aria-invalid')).toBe('false')
    const phone = node.querySelector<HTMLInputElement>('[name="recipientPhone"]')!
    await act(async () => phone.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(phone.getAttribute('aria-invalid')).toBe('true')
    phone.focus()
    await fill('recipientPhone', '091')
    expect(phone.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(phone)
    await fill('recipientPhone', '0901234567')
    expect(phone.getAttribute('aria-invalid')).toBe('false')
    expect(node.querySelector('#shipment-recipientPhone-error')).toBeNull()
    expect(document.activeElement).toBe(phone)
    expect(api.create).not.toHaveBeenCalled()
  })
  it('blocks double submit and only confirms a server tracking number', async () => {
    let finish!: (value: unknown) => void
    api.create.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await valid(); await submit(); await submit()
    expect(api.create).toHaveBeenCalledTimes(1)
    expect(api.create.mock.calls[0][1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    await act(async () => finish(shipmentFixture))
    expect(node.textContent).toContain(shipmentFixture.trackingNumber)
    expect(node.querySelector(`a[href="/customer/shipments/${shipmentFixture.id}"]`)).not.toBeNull()
  })
  it('retains key/body after a timeout even when the original deadline passes', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-18T04:00:00Z'))
    api.create.mockRejectedValueOnce(new ApiError(0, 'REQUEST_TIMEOUT')).mockResolvedValueOnce(shipmentFixture)
    const future = new Date(Date.now() + 60_000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const local = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`
    await valid(); await fill('expectedDeliveryAt', local); await submit()
    expect(node.querySelector<HTMLInputElement>('[name="pickupAddress"]')!.disabled).toBe(true)
    vi.setSystemTime(new Date('2026-10-18T04:02:00Z'))
    await submit()
    expect(api.create).toHaveBeenCalledTimes(2)
    expect(api.create.mock.calls[1].slice(0, 2)).toEqual(api.create.mock.calls[0].slice(0, 2))
  })
  it('does not mix a draft with a different user or apply an old response', async () => {
    let finish!: (value: unknown) => void
    api.create.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await valid(); await submit(); api.identity = 'customer-b'
    await act(async () => root.render(<MemoryRouter><CustomerCreatePage /></MemoryRouter>))
    await act(async () => finish(shipmentFixture))
    expect(node.textContent).not.toContain(shipmentFixture.trackingNumber)
    expect(node.querySelector<HTMLInputElement>('[name="pickupAddress"]')!.value).toBe('')
  })
  it.each([
    [401, 'UNAUTHENTICATED', 'đăng nhập'], [403, 'FORBIDDEN_RESOURCE', 'không có quyền'],
    [409, 'USER_NOT_PROVISIONED', 'chưa được liên kết'],
    [409, 'IDEMPOTENCY_KEY_CONFLICT', 'dữ liệu khác'],
  ])('shows a safe recovery message for %s %s', async (status, code, message) => {
    api.create.mockRejectedValue(new ApiError(status, code))
    await valid(); await submit()
    expect(node.querySelector('[role="alert"]')!.textContent).toContain(message)
    expect(node.textContent).not.toContain('Đã tạo đơn thành công')
  })
  it('links backend validation to known fields and allows editing', async () => {
    api.create.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', [{ field: 'recipientPhone', message: 'private diagnostic' }]))
    await valid(); await submit()
    expect(node.querySelector('[name="recipientPhone"]')?.getAttribute('aria-invalid')).toBe('true')
    expect(node.querySelector<HTMLInputElement>('[name="recipientPhone"]')!.disabled).toBe(false)
    expect(document.activeElement?.id).toBe('shipment-recipientPhone')
    expect(node.textContent).not.toContain('private diagnostic')
  })
  it('does not retry beyond the idempotency window', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-18T04:00:00Z'))
    api.create.mockRejectedValue(new ApiError(503, 'SERVICE_UNAVAILABLE'))
    await valid(); await submit()
    vi.setSystemTime(new Date('2026-10-19T04:00:00Z')); await submit()
    expect(api.create).toHaveBeenCalledTimes(1)
    expect(node.textContent).toContain('quá 24 giờ')
  })
  it('also expires an unchanged intent after a definitive validation error', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-18T04:00:00Z'))
    api.create.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR'))
    await valid(); await submit()
    vi.setSystemTime(new Date('2026-10-19T04:00:00Z')); await submit()
    expect(api.create).toHaveBeenCalledTimes(1)
    expect(node.textContent).toContain('quá 24 giờ')
  })
})
