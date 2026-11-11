import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { assignShipment, createShipment, deliverShipment, pickupShipment } from '../src/api/endpoints/shipments'
import { AdminAssignmentPage } from '../src/features/admin/AdminAssignmentPage'
import { AdminShipmentsPage } from '../src/features/admin/AdminShipmentsPage'
import { AdminShipmentDetailPage } from '../src/features/admin/AdminShipmentDetailPage'
import { CustomerCreatePage } from '../src/features/customer/CustomerCreatePage'
import { CustomerShipmentsPage } from '../src/features/customer/CustomerShipmentsPage'
import { CustomerShipmentDetailPage } from '../src/features/customer/CustomerShipmentDetailPage'
import { CustomerHistoryPage } from '../src/features/customer/CustomerHistoryPage'
import { DriverShipments } from '../src/features/driver/DriverShipments'
import { DriverShipmentDetailPage } from '../src/features/driver/DriverShipmentDetailPage'
import type { ShipmentAddressValue } from '../src/features/customer/ShipmentAddressModal'
import { startServer, userId } from './fixture-client'

const session = vi.hoisted(() => ({ actor: 'customer', saveAddress: null as null | ((value: ShipmentAddressValue) => void) }))
vi.mock('../src/features/auth/useAuth', () => ({ useAuth: () => ({ user: { id: session.actor, displayName: session.actor,
  role: session.actor.startsWith('driver') ? 'DRIVER' : session.actor === 'admin' ? 'ADMIN' : 'CUSTOMER' } }) }))
vi.mock('../src/features/auth/session', () => ({ readSessionToken: async () => session.actor }))
vi.mock('../src/features/customer/ShipmentAddressModal', () => ({ ShipmentAddressModal: ({ onSave }: {
  onSave: (value: ShipmentAddressValue) => void
}) => { session.saveAddress = onSave; return <div data-testid="address-fixture" /> } }))
vi.mock('../src/components/shipment/ShipmentTracking', () => ({ ShipmentTracking: () => null }))

const payload = {
  pickupAddress: '144 Xuan Thuy', pickupLocation: { lat: 21.037, lng: 105.783 },
  dropoffAddress: '1 Dai Co Viet', dropoffLocation: { lat: 21.008, lng: 105.842 },
  recipientName: 'Nguoi nhan', recipientPhone: '0901234567',
}
let server: Awaited<ReturnType<typeof startServer>>
let root: Root, node: HTMLDivElement
let version = 0
let loseAssignmentResponse = false
let failDetail = false
let requests: { method: string; path: string; status?: number }[] = []
const nativeFetch = globalThis.fetch

beforeAll(async () => { server = await startServer() })
afterAll(async () => { await server?.close() })
beforeEach(async () => {
  await server.reset()
  session.actor = 'customer'; session.saveAddress = null
  loseAssignmentResponse = false; failDetail = false; requests = []
  vi.stubEnv('VITE_API_URL', server.base)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url)
    if (url.origin !== new URL(server.base).origin) throw new Error('Integration tests only access the isolated local API')
    const record = { method: init?.method ?? 'GET', path: url.pathname + url.search, status: undefined as number | undefined }
    requests.push(record)
    if (failDetail && record.method === 'GET' && /^\/v1\/shipments\/sh_/.test(url.pathname)) {
      record.status = 503
      return Response.json({ code: 'SERVICE_UNAVAILABLE' }, { status: 503 })
    }
    const response = await nativeFetch(input, init)
    record.status = response.status
    if (loseAssignmentResponse && record.method === 'POST' && url.pathname.endsWith('/assign')) {
      loseAssignmentResponse = false
      await response.text()
      throw new TypeError('Isolated lost response after server commit')
    }
    return response
  })
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  node?.remove(); vi.unstubAllGlobals(); vi.unstubAllEnvs()
})

async function eventually(assertion: () => void) {
  const until = Date.now() + 5000
  for (;;) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    try { assertion(); return } catch (error) { if (Date.now() > until) throw error }
  }
}
async function mount(path: string, actor = 'customer') {
  session.actor = actor
  await act(async () => root.render(<MemoryRouter key={++version} initialEntries={[path]}><Routes>
    <Route path="/customer/create" element={<CustomerCreatePage />} />
    <Route path="/customer/shipments" element={<CustomerShipmentsPage />} />
    <Route path="/customer/history" element={<CustomerHistoryPage />} />
    <Route path="/customer/shipments/:id" element={<CustomerShipmentDetailPage />} />
    <Route path="/admin/shipments" element={<AdminShipmentsPage />} />
    <Route path="/admin/shipments/:id" element={<AdminShipmentDetailPage />} />
    <Route path="/admin/assignment" element={<AdminAssignmentPage />} />
    <Route path="/driver" element={<DriverShipments />} />
    <Route path="/driver/shipments/:id" element={<DriverShipmentDetailPage />} />
  </Routes></MemoryRouter>))
}
function button(text: string) {
  const found = [...node.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes(text))
  if (!found) throw new Error('Missing button: ' + text)
  return found
}
async function click(text: string) { await act(async () => button(text).click()) }
async function follow(text: string) {
  const link = [...node.querySelectorAll<HTMLAnchorElement>('a')].find(item => item.textContent === text)!
  expect(link).toBeTruthy()
  await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
}
async function fill(name: string, value: string) {
  await act(async () => {
    const input = node.querySelector<HTMLInputElement>(`[name="${name}"]`)!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function create() {
  session.actor = 'customer'
  return createShipment(payload, crypto.randomUUID())
}
async function assignment(id: string) {
  await mount('/admin/assignment?shipmentId=' + id, 'admin')
  await eventually(() => expect(button('driver1').disabled).toBe(false))
  await click('driver1'); await click('Xem lại phân công')
}
const assignmentPosts = () => requests.filter(request => request.method === 'POST' && request.path.endsWith('/assign'))
async function effects() {
  const result = await server.query(`SELECT
    (SELECT count(*)::int FROM shipments) AS shipments,
    (SELECT count(*)::int FROM shipment_status_events WHERE action <> 'CREATED') AS events,
    (SELECT count(*)::int FROM notifications WHERE kind <> 'CREATED') AS notifications`)
  return result.rows[0]
}

describe('Week 6 UI → real Nest HTTP → isolated SQL (Firebase/address fixtures, no GPS)', () => {
  it('creates from the form and reads the same persisted order in Customer detail/list and Admin list', async () => {
    await mount('/customer/create')
    for (const kind of ['pickup', 'dropoff'] as const) {
      await act(async () => node.querySelector<HTMLButtonElement>(`#shipment-${kind}Location`)!.click())
      await act(async () => session.saveAddress!({ street: payload[`${kind}Address`], area: '', details: '',
        point: payload[`${kind}Location`], divisions: null }))
    }
    await fill('senderName', 'Nguoi gui'); await fill('senderPhone', '0912345678')
    await fill('recipientName', payload.recipientName); await fill('recipientPhone', payload.recipientPhone)
    await act(async () => node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    await eventually(() => expect(node.textContent).toContain('Đã tạo đơn thành công'))
    const trackingNumber = node.querySelector('.customer-tracking-number')!.textContent!
    expect(requests.filter(request => request.method === 'POST' && request.path === '/v1/shipments')).toHaveLength(1)
    await follow('Xem đơn vừa tạo')
    await eventually(() => expect(node.querySelector('.shipment-history')?.textContent).toContain('Đã tạo đơn'))
    expect(node.textContent).toContain(trackingNumber)
    await follow('Về danh sách đơn')
    await eventually(() => expect(node.querySelector('tbody')?.textContent).toContain(trackingNumber))
    await follow('Xem chi tiết')
    await eventually(() => expect(node.querySelector('.customer-result')?.textContent).toContain(trackingNumber))
    await mount('/admin/shipments', 'admin')
    await eventually(() => expect(node.querySelector('tbody')?.textContent).toContain(trackingNumber))
    await follow('Xem chi tiết')
    await eventually(() => expect(node.querySelector('.shipment-history')?.textContent).toContain('Đã tạo đơn'))
    await follow('Phân công tài xế')
    await eventually(() => expect(button('driver1').disabled).toBe(false))
    expect(node.querySelector('.admin-shipment-detail')?.textContent).toContain(trackingNumber)
    expect(await effects()).toEqual({ shipments: 1, events: 0, notifications: 0 })
  })

  it('assigns and reassigns through the UI, updates history and enforces Driver ownership', async () => {
    const shipment = await create()
    await assignment(shipment.id); await click('Xác nhận phân công')
    await eventually(() => expect(node.textContent).toContain('Máy chủ đã xác nhận'))
    await eventually(() => expect(button('driver1').disabled).toBe(false))
    await click('driver1')
    expect(button('Xem lại phân công').disabled).toBe(true)
    expect(assignmentPosts()).toHaveLength(1)
    await click('driver2'); await click('Xem lại phân công'); await click('Xác nhận phân công')
    await eventually(() => expect(node.querySelector('.admin-api-message[role=status]')?.textContent).toContain('driver2'))
    expect(assignmentPosts()).toHaveLength(2)
    expect(await effects()).toEqual({ shipments: 1, events: 2, notifications: 2 })
    await mount('/customer/shipments/' + shipment.id)
    await eventually(() => expect(node.querySelector('.shipment-history')?.textContent).toContain('Đã gán lại tài xế'))
    expect(node.querySelector('.shipment-history')?.textContent).toContain(userId(4))
    for (const [actor, expected] of [['driver1', 403], ['driver2', 200], ['other', 403]] as const) {
      const response = await fetch(server.base + '/shipments/' + shipment.id, { headers: { Authorization: 'Bearer ' + actor } })
      expect(response.status).toBe(expected)
    }
  })

  it('reconciles a lost response after a real commit without sending another assignment', async () => {
    const shipment = await create(); await assignment(shipment.id)
    loseAssignmentResponse = true
    await click('Xác nhận phân công')
    await eventually(() => expect(node.textContent).toContain('Đã đọc lại trạng thái hiện tại'))
    expect(node.textContent).not.toContain('Máy chủ đã xác nhận')
    expect(button('Xem lại phân công').disabled).toBe(true)
    expect(assignmentPosts()).toHaveLength(1)
    expect(await effects()).toEqual({ shipments: 1, events: 1, notifications: 1 })
  })

  it('rolls back a SQL write failure and blocks double-submit while recovering through GET', async () => {
    const shipment = await create(); await assignment(shipment.id)
    await server.failNextAssignment()
    await act(async () => { button('Xác nhận phân công').click(); button('Xác nhận phân công').click() })
    await eventually(() => expect(node.textContent).toContain('Đã đọc lại trạng thái hiện tại'))
    expect(assignmentPosts()).toHaveLength(1)
    expect(assignmentPosts()[0].status).toBe(503)
    expect(await effects()).toEqual({ shipments: 1, events: 0, notifications: 0 })
    expect(button('Xem lại phân công').disabled).toBe(true)
  })

  it('keeps writes locked after failed reconciliation; the recovery action only reads', async () => {
    const shipment = await create(); await assignment(shipment.id)
    loseAssignmentResponse = true; failDetail = true
    await click('Xác nhận phân công')
    await eventually(() => expect(node.textContent).toContain('thao tác ghi đang bị khóa'))
    expect(button('Xem lại phân công').disabled).toBe(true)
    failDetail = false
    await click('Đọc lại chi tiết')
    await eventually(() => expect(node.textContent).toContain('Đã đọc lại trạng thái hiện tại'))
    expect(assignmentPosts()).toHaveLength(1)
    expect(await effects()).toEqual({ shipments: 1, events: 1, notifications: 1 })
  })

  it('reads current state after a real 409 when pickup happens after review', async () => {
    const shipment = await create(); await assignment(shipment.id)
    // There is no Pickup handler yet; only the isolated fixture advances the persisted state.
    await server.query(`UPDATE shipments SET status='PICKED_UP', "driverId"=$2 WHERE id=$1`, [shipment.id, userId(3)])
    await click('Xác nhận phân công')
    await eventually(() => expect(node.textContent).toContain('Đã đọc lại trạng thái hiện tại'))
    expect(assignmentPosts()[0].status).toBe(409)
    expect(button('Xem lại phân công').disabled).toBe(true)
    expect(node.textContent).toContain('không còn cho phép phân công')
    expect(await effects()).toEqual({ shipments: 1, events: 0, notifications: 0 })
  })

  it('uses server cursors and exact tracking filters for persisted Customer orders', async () => {
    const shipments: Awaited<ReturnType<typeof create>>[] = []
    for (let index = 0; index < 21; index++) shipments.push(await create())
    await mount('/customer/shipments')
    await eventually(() => expect(node.querySelectorAll('tbody tr')).toHaveLength(20))
    await click('Trang tiếp')
    await eventually(() => expect(node.querySelectorAll('tbody tr')).toHaveLength(1))
    expect(requests.some(request => request.path.includes('cursor='))).toBe(true)
    await fill('trackingNumber', shipments[0].trackingNumber)
    await act(async () => node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    await eventually(() => expect(node.querySelector('tbody')?.textContent).toContain(shipments[0].trackingNumber))
    expect(node.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(button('Trang trước').disabled).toBe(true)
    const lastRead = requests.filter(request => request.path.startsWith('/v1/shipments?')).at(-1)!
    expect(lastRead.path).toContain('trackingNumber=' + shipments[0].trackingNumber)
    expect(lastRead.path).not.toContain('cursor=')
    await mount('/admin/shipments', 'admin')
    await eventually(() => expect(node.querySelectorAll('tbody tr')).toHaveLength(20))
    await click('Trang sau')
    await eventually(() => expect(node.querySelectorAll('tbody tr')).toHaveLength(1))
    await fill('trackingNumber', shipments[0].trackingNumber)
    await act(async () => node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    await eventually(() => expect(node.querySelector('tbody')?.textContent).toContain(shipments[0].trackingNumber))
    expect(node.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(button('Trang trước').disabled).toBe(true)
  })

  it('shows a real forbidden read as an error rather than old shipment data', async () => {
    const shipment = await create()
    await mount('/customer/shipments/' + shipment.id, 'other')
    await eventually(() => expect(node.querySelector('[role=alert]')).not.toBeNull())
    expect(requests.at(-1)?.status).toBe(403)
    expect(node.textContent).not.toContain(shipment.trackingNumber)
    expect(node.querySelector('.shipment-history')).toBeNull()
  })
})

describe('Driver list/detail → real Nest HTTP → isolated SQL (Firebase fixture)', () => {
  it('shows delivered orders in Customer history and the same lifecycle to Customer and Admin', async () => {
    const shipment = await create(), active = await create()
    session.actor = 'admin'; await assignShipment(shipment.id, userId(3))
    session.actor = 'driver1'; await pickupShipment(shipment.id)
    await mount('/admin/shipments/' + shipment.id, 'admin')
    await eventually(() => expect(node.querySelector('.shipment-history li:last-child')?.textContent).toContain('Đã lấy hàng'))
    expect(node.textContent).not.toContain('Xác nhận đã lấy hàng')
    session.actor = 'driver1'
    await deliverShipment(shipment.id, 'Giao tận tay')
    await mount('/customer/history')
    await eventually(() => expect(node.querySelector('tbody')?.textContent).toContain(shipment.trackingNumber))
    expect(node.textContent).not.toContain(active.trackingNumber)
    expect(requests.at(-1)?.path).toContain('status=DELIVERED')
    expect(node.querySelectorAll('tbody tr')).toHaveLength(1)
    await follow('Xem chi tiết')
    await eventually(() => expect(node.querySelector('.shipment-history li:last-child')?.textContent).toContain('Giao thành công'))
    expect(node.querySelectorAll('.shipment-history li')).toHaveLength(4)
    expect(node.textContent).toContain('Giao tận tay')
    expect(node.querySelector('textarea')).toBeNull()
    await mount('/admin/shipments/' + shipment.id, 'admin')
    await eventually(() => expect(node.querySelectorAll('.shipment-history li')).toHaveLength(4))
    expect(node.textContent).toContain('Giao thành công')
    expect(node.textContent).toContain('Giao tận tay')
    expect(node.querySelector('textarea')).toBeNull()
    await mount('/customer/history', 'other')
    await eventually(() => expect(node.querySelector('.customer-empty h2')?.textContent).toBe('Chưa có đơn giao thành công'))
    expect(node.textContent).not.toContain(shipment.trackingNumber)
    await mount('/customer/shipments/' + shipment.id, 'other')
    await eventually(() => expect(node.querySelector('[role=alert]')).not.toBeNull())
    expect(requests.at(-1)?.status).toBe(403)
    expect(node.textContent).not.toContain(shipment.trackingNumber)
  })

  it('shows only assigned orders and completes real pickup and delivery through the UI', async () => {
    const own = await create(), other = await create()
    session.actor = 'admin'
    await assignShipment(own.id, userId(3)); await assignShipment(other.id, userId(4))
    await mount('/driver', 'driver1')
    await eventually(() => expect(node.textContent).toContain(own.trackingNumber))
    expect(node.textContent).not.toContain(other.trackingNumber)
    await follow('Xem đơn')
    await eventually(() => expect(node.textContent).toContain('Lịch sử trạng thái'))
    await click('Đã lấy hàng'); await click('Xác nhận đã lấy hàng')
    await eventually(() => expect(node.textContent).toContain('Máy chủ đã xác nhận lấy hàng.'))
    const pickups = requests.filter(request => request.path.endsWith('/pickup'))
    expect(pickups).toHaveLength(1); expect(pickups[0].status).toBe(200)
    expect((await server.query('SELECT status FROM shipments WHERE id=$1', [own.id])).rows[0].status).toBe('PICKED_UP')
    await act(async () => {
      const notes = node.querySelector<HTMLTextAreaElement>('#driver-delivery-notes')!
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(notes, '  Giao tận tay  ')
      notes.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click('Giao thành công'); await click('Xác nhận giao thành công')
    await eventually(() => expect(node.textContent).toContain('Máy chủ đã xác nhận giao thành công.'))
    const deliveries = requests.filter(request => request.path.endsWith('/deliver'))
    expect(deliveries).toHaveLength(1); expect(deliveries[0].status).toBe(200)
    await eventually(() => expect(node.querySelector('.shipment-history')?.textContent).toContain('Đang giao hàng → Giao thành công'))
    expect(node.textContent).toContain('Giao tận tay')
    expect((await server.query('SELECT status, "proofOfDeliveryNotes" FROM shipments WHERE id=$1', [own.id])).rows[0]).toEqual({
      status: 'DELIVERED',
      proofOfDeliveryNotes: 'Giao tận tay',
    })
  })
  it('removes the old Driver access after a real reassignment', async () => {
    const order = await create(); session.actor = 'admin'; await assignShipment(order.id, userId(3))
    await mount('/driver/shipments/' + order.id, 'driver1')
    await eventually(() => expect(node.textContent).toContain(order.trackingNumber))
    session.actor = 'admin'; await assignShipment(order.id, userId(4)); session.actor = 'driver1'
    await click('Đọc lại thông tin đơn')
    await eventually(() => expect(node.textContent).toContain('Bạn không còn quyền'))
    expect(node.textContent).not.toContain(order.trackingNumber)
    expect(node.textContent).not.toContain(payload.recipientPhone)
    expect(node.querySelector('form')).toBeNull()
    await mount('/driver', 'driver2')
    await eventually(() => expect(node.textContent).toContain(order.trackingNumber))
  })
})
