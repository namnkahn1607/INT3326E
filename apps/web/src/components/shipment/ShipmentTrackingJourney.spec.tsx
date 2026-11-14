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
let pending: { resolve: (response: Response) => void; signal?: AbortSignal | null }[]
const detail = () => ({ ...shipmentFixture, status: 'ASSIGNED', driverId: snapshot.driverId, statusHistory: [] })
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
  trackingStatus = 200; detailStatus = 200; hold = false; reads = []; pending = []
  session.actor = 'customer-a'; session.role = 'CUSTOMER'; session.token.mockReset().mockResolvedValue('fixture-token')
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    expect(String(input).startsWith(base + '/shipments/')).toBe(true)
    expect(init?.method ?? 'GET').toBe('GET')
    const path = new URL(input).pathname
    reads.push({ path, auth: new Headers(init?.headers).get('Authorization'), signal: init?.signal })
    if (!path.endsWith('/tracking')) return Response.json(detailStatus === 200 ? detail() : { code: 'FORBIDDEN_RESOURCE' }, { status: detailStatus })
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
    expect(map!.querySelectorAll('[data-pin]')).toHaveLength(2)
    expect(node.textContent).toContain('Ẩn vị trí tài xế')
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
})
