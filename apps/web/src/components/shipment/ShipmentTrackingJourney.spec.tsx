import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerShipmentDetailPage } from '../../features/customer/CustomerShipmentDetailPage'
import { AdminShipmentDetailPage } from '../../features/admin/AdminShipmentDetailPage'
import { shipmentFixture } from '../../features/customer/shipment-fixture'
import { trackingFixture } from './tracking-fixture'
import type { TrackingPin } from '../map/TrackingMap'

const session = vi.hoisted(() => ({ actor: 'customer-a', role: 'CUSTOMER', token: vi.fn() }))
vi.mock('../../features/auth/useAuth', () => ({ useAuth: () => ({ user: { id: session.actor, role: session.role } }) }))
vi.mock('../../features/auth/session', () => ({ readSessionToken: session.token }))
vi.mock('../map/TrackingMap', () => ({ default: ({ pins }: { pins: TrackingPin[] }) =>
  <div data-testid="map">{pins.map(pin => <span key={pin.id} data-pin={pin.id}>{pin.position.lat}</span>)}</div> }))

const base = 'https://tracking-fixture.invalid/v1'
let node: HTMLDivElement, root: Root
let snapshot: ReturnType<typeof trackingFixture>, trackingStatus: number, detailStatus: number
let hold: boolean, reads: { path: string; auth: string | null; signal?: AbortSignal | null }[]
let holdDetail: boolean
let pendingDetail: { resolve: (response: Response) => void; signal?: AbortSignal | null }[]
let pending: { resolve: (response: Response) => void; signal?: AbortSignal | null }[]
const detail = () => ({ ...shipmentFixture, status: snapshot.status, driverId: snapshot.driverId,
  isLate: snapshot.isLate, expectedDeliveryAt: snapshot.expectedDeliveryAt, statusHistory: [],
  proofOfDeliveryNotes: snapshot.status === 'DELIVERED' ? 'Đã bàn giao bưu kiện' : null })
const count = () => reads.filter(read => read.path.endsWith('/tracking')).length
function Navigation() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/away')}>Rời trang</button>
}
const mount = (area = 'customer', id = shipmentFixture.id) => act(async () => root.render(
  <MemoryRouter initialEntries={[`/${area}/shipments/${id}`]}>
    <Navigation /><Routes>
      <Route path="/customer/shipments/:id" element={<CustomerShipmentDetailPage />} />
      <Route path="/admin/shipments/:id" element={<AdminShipmentDetailPage />} />
      <Route path="/away" element={<p>Đã rời chi tiết</p>} />
    </Routes>
  </MemoryRouter>))
const refresh = () => act(async () => node.querySelector<HTMLButtonElement>('.tracking-toolbar button')!.click())

beforeAll(async () => { await import('./ShipmentTrackingPanel') })
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-14T03:00:00.000Z')); vi.stubEnv('VITE_API_URL', base)
  snapshot = trackingFixture({ status: 'ASSIGNED', etaUnavailableReason: 'NOT_PICKED_UP' })
  trackingStatus = 200; detailStatus = 200; hold = false; holdDetail = false; reads = []; pending = []; pendingDetail = []
  session.actor = 'customer-a'; session.role = 'CUSTOMER'; session.token.mockReset().mockResolvedValue('fixture-token')
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    expect(String(input).startsWith(base + '/shipments/')).toBe(true)
    expect(init?.method ?? 'GET').toBe('GET')
    const path = new URL(input).pathname
    reads.push({ path, auth: new Headers(init?.headers).get('Authorization'), signal: init?.signal })
    if (!path.endsWith('/tracking')) {
      if (holdDetail) return new Promise<Response>(resolve => { pendingDetail.push({ resolve, signal: init?.signal }) })
      return Response.json(detailStatus === 200 ? detail() : { code: 'FORBIDDEN_RESOURCE' }, { status: detailStatus })
    }
    if (hold) return new Promise<Response>(resolve => { pending.push({ resolve, signal: init?.signal }) })
    return Response.json(trackingStatus === 200 ? snapshot : { code: 'FORBIDDEN_RESOURCE' }, { status: trackingStatus })
  }))
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => {
  await act(async () => root.unmount()); expect(vi.getTimerCount()).toBe(0)
  node.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs()
})

describe('Customer/Admin tracking journeys (HTTP responses mocked, real client and parser)', () => {
  it.each(['customer', 'admin'])('updates the %s late flag from API data without reloading detail for every GPS sample', async area => {
    session.role = area === 'admin' ? 'ADMIN' : 'CUSTOMER'
    await mount(area)
    expect(node.querySelector('.shipment-late-badge')).toBeNull()
    snapshot = { ...snapshot, isLate: true, expectedDeliveryAt: '2026-11-14T02:00:00.000Z' }
    await refresh()
    expect(node.querySelector('.shipment-late-badge')?.textContent).toBe('Giao trễ')
    const detailReads = reads.filter(read => !read.path.endsWith('/tracking')).length
    await refresh()
    expect(reads.filter(read => !read.path.endsWith('/tracking'))).toHaveLength(detailReads)
    snapshot = { ...snapshot, isLate: false }
    await refresh()
    expect(node.querySelector('.shipment-late-badge')).toBeNull()
    // Admin's focus restoration queues a jsdom selectionchange event at 0ms.
    await act(async () => vi.advanceTimersByTimeAsync(0))
  })
  it.each(['customer', 'admin'])('reads %s detail then polls SC05, replaces drivers and stops at terminal', async area => {
    session.role = area === 'admin' ? 'ADMIN' : 'CUSTOMER'
    await mount(area)
    expect(count()).toBe(1)
    expect(reads.every(read => read.auth === 'Bearer fixture-token')).toBe(true)
    const map = node.querySelector('[data-testid="map"]')
    expect(map!.querySelectorAll('[data-pin]')).toHaveLength(3)
    const firstDriver = snapshot.driverId
    snapshot = trackingFixture({ status: 'ASSIGNED', driverId: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAY', etaUnavailableReason: 'NOT_PICKED_UP' })
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(node.querySelector(`[data-pin="${firstDriver}"]`)).toBeNull()
    expect(node.querySelector(`[data-pin="${snapshot.driverId}"]`)).not.toBeNull()
    expect(node.querySelector('[data-testid="map"]')).toBe(map)
    snapshot = trackingFixture({ status: 'DELIVERED', currentDriverLocation: null,
      lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null, etaUnavailableReason: 'NOT_PICKED_UP' })
    await act(async () => vi.advanceTimersByTimeAsync(20_000))
    expect(count()).toBe(3)
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
    expect(node.querySelector('[data-status="DELIVERED"]')).not.toBeNull()
    expect(node.textContent).toContain('Đơn đã kết thúc')
    expect(node.textContent).toContain('Đã bàn giao bưu kiện')
    expect([...node.querySelectorAll('button')].some(button => /nhận hàng|giao thành công/i.test(button.textContent ?? ''))).toBe(false)
  })
  it('shows missing/stale GPS and hides only the driver on a transient HTTP failure', async () => {
    await mount()
    const map = node.querySelector('[data-testid="map"]')
    snapshot = trackingFixture({ currentDriverLocation: null, lastLocationUpdatedAt: null,
      locationClientTimestamp: null, isLocationStale: null, etaUnavailableReason: 'LOCATION_MISSING' })
    await refresh(); expect(node.textContent).toContain('Chưa có GPS')
    const old = new Date(Date.now() - 31_000).toISOString()
    snapshot = trackingFixture({ locationClientTimestamp: old, lastLocationUpdatedAt: old,
      isLocationStale: true, etaUnavailableReason: 'LOCATION_STALE' })
    await refresh(); expect(node.textContent).toContain('GPS cũ')
    trackingStatus = 503; await refresh()
    expect(node.querySelector('[data-testid="map"]')).toBe(map)
    expect(map!.querySelectorAll('[data-pin]')).toHaveLength(2)
    trackingStatus = 200; snapshot = trackingFixture()
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(node.querySelector('[data-testid="map"]')).toBe(map)
    expect(node.textContent).toContain('GPS mới')
  })
  it('stops on API09 404 and recovers only after a manual retry', async () => {
    trackingStatus = 404; await mount()
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('API tracking chưa được triển khai')
    await act(async () => vi.advanceTimersByTimeAsync(20_000)); expect(count()).toBe(1)
    trackingStatus = 200; await refresh()
    expect(node.querySelectorAll('[data-pin]')).toHaveLength(3)
  })
  it('clears the map on 403 and does not expose a late GPS result after an account change', async () => {
    await mount(); hold = true; await refresh()
    const previous = pending[0]
    session.actor = 'customer-b'; detailStatus = 403; await mount()
    expect(previous.signal?.aborted).toBe(true)
    await act(async () => previous.resolve(Response.json(snapshot)))
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
    expect(node.textContent).not.toContain(shipmentFixture.trackingNumber)
    expect(count()).toBe(2)
  })
  it('never starts tracking when the detail request denies access', async () => {
    detailStatus = 403; await mount()
    expect(count()).toBe(0)
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
  })
  it('times out a slow read, aborts it and recovers with the latest refreshed token', async () => {
    hold = true; await mount()
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
    expect(pending[0].signal?.aborted).toBe(true)
    expect(count()).toBe(1)
    expect(node.querySelectorAll('[data-pin]')).toHaveLength(2)
    hold = false; session.token.mockResolvedValue('updated-fixture-token')
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(reads.at(-1)?.auth).toBe('Bearer updated-fixture-token')
    expect(node.querySelectorAll('[data-pin]')).toHaveLength(3)
    await act(async () => pending[0].resolve(Response.json(trackingFixture({ driverId: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAY' }))))
    expect(node.querySelector(`[data-pin="${snapshot.driverId}"]`)).not.toBeNull()
  })
  it('aborts a pending request and all polling when leaving the detail route', async () => {
    hold = true; await mount()
    await act(async () => node.querySelector<HTMLButtonElement>('button')!.click())
    expect(pending[0].signal?.aborted).toBe(true)
    await act(async () => pending[0].resolve(Response.json(snapshot)))
    await act(async () => vi.advanceTimersByTimeAsync(20_000))
    expect(count()).toBe(1)
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
  })

  it.each(['customer', 'admin'])('refreshes %s detail once per state change and not on GPS updates', async area => {
    session.role = area === 'admin' ? 'ADMIN' : 'CUSTOMER'
    await mount(area)
    const detailReads = () => reads.filter(read => !read.path.endsWith('/tracking')).length
    snapshot = { ...snapshot, currentDriverLocation: { lat: 21.04, lng: 105.81 } }
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(detailReads()).toBe(1)
    snapshot = { ...snapshot, status: 'PICKED_UP', etaUnavailableReason: 'CONFIG_INVALID' }
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(detailReads()).toBe(2)
    expect(node.querySelector('[data-status="PICKED_UP"]')).not.toBeNull()
    expect(node.querySelector('[data-status="ASSIGNED"]')).toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
    expect(detailReads()).toBe(2)
  })

  it('locks the Admin failure form as soon as tracking reports terminal, even if detail reload fails', async () => {
    session.role = 'ADMIN'; snapshot = trackingFixture()
    await mount('admin')
    expect(node.querySelector('.shipment-failure-form')).not.toBeNull()
    holdDetail = true
    snapshot = trackingFixture({ status: 'DELIVERED', currentDriverLocation: null,
      lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null, etaUnavailableReason: 'NOT_PICKED_UP' })
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(node.querySelector('.shipment-failure-form')).toBeNull()
    expect(node.querySelector('[data-status="PICKED_UP"]')).toBeNull()
    expect(pendingDetail).toHaveLength(1)
    await act(async () => pendingDetail[0].resolve(Response.json({ code: 'SERVICE_UNAVAILABLE' }, { status: 503 })))
    expect(node.querySelector('[role="alert"]')).not.toBeNull()
    expect(node.querySelector('.shipment-failure-form')).toBeNull()
    expect(node.textContent).toContain(shipmentFixture.trackingNumber)
    expect(node.textContent).toContain('thông tin dưới đây có thể đã cũ')
    const total = reads.length
    await act(async () => vi.advanceTimersByTimeAsync(20_000))
    expect(reads).toHaveLength(total)
  })

  it.each(['customer', 'admin'])('aborts %s detail reconciliation on leaving and ignores its late result', async area => {
    session.role = area === 'admin' ? 'ADMIN' : 'CUSTOMER'
    await mount(area); holdDetail = true
    snapshot = { ...snapshot, status: 'PICKED_UP', etaUnavailableReason: 'CONFIG_INVALID' }
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(pendingDetail).toHaveLength(1)
    await act(async () => node.querySelector<HTMLButtonElement>('button')!.click())
    expect(pendingDetail[0].signal?.aborted).toBe(true)
    await act(async () => pendingDetail[0].resolve(Response.json(detail())))
    expect(node.textContent).toContain('Đã rời chi tiết')
    expect(node.textContent).not.toContain('Đã bàn giao bưu kiện')
  })
})
