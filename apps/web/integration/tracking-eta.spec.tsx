import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { assignShipment, createShipment, deliverShipment, failShipment, pickupShipment } from '../src/api/endpoints/shipments'
import type { TrackingData } from '../src/api/endpoints/tracking'
import { ShipmentTracking } from '../src/components/shipment/ShipmentTracking'
import { startServer, userId } from './fixture-client'

const session = vi.hoisted(() => ({ actor: 'customer' }))
vi.mock('../src/features/auth/useAuth', () => ({ useAuth: () => ({ user: { id: session.actor } }) }))
vi.mock('../src/features/auth/session', () => ({ readSessionToken: async () => session.actor }))
vi.mock('../src/components/map/TrackingMap', () => ({ default: () => <div data-testid="map" /> }))

let server: Awaited<ReturnType<typeof startServer>>, root: Root, node: HTMLDivElement
let latest: TrackingData | undefined
const nativeFetch = globalThis.fetch
beforeAll(async () => { server = await startServer() }, 30_000)
afterAll(async () => { await server?.close() })
beforeEach(async () => {
  await server.reset(); await server.query('DELETE FROM current_locations')
  latest = undefined; session.actor = 'customer'
  vi.stubEnv('VITE_API_URL', server.base); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url)
    if (url.origin !== new URL(server.base).origin) throw Error('ETA integration only accesses the isolated local API')
    const response = await nativeFetch(input, init)
    if (url.pathname.endsWith('/tracking') && response.ok) latest = await response.clone().json()
    return response
  })
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })
async function eventually(assert: () => void) {
  const deadline = Date.now() + 5000
  for (;;) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    try { assert(); return } catch (error) { if (Date.now() > deadline) throw error }
  }
}
async function refresh() {
  await act(async () => node.querySelector<HTMLButtonElement>('.tracking-toolbar button')!.click())
}
async function seed(age = '1 second', zero = false) {
  await server.query('DELETE FROM current_locations')
  await server.query(`INSERT INTO current_locations ("driverId",lat,lng,"clientTimestamp","receivedAt")
    VALUES ($1,$2,$3,clock_timestamp()-$4::interval,clock_timestamp())`,
    [userId(3), zero ? 21.008 : 21.03, zero ? 105.842 : 105.81, age])
}
it.each(['customer', 'admin'])('renders %s ETA from Nest/SQL through null/stale/zero/terminal and denies another Customer', async actor => {
  const deadline = new Date(Date.now() + 3_600_000).toISOString()
  const order = await createShipment({ pickupAddress: 'Local pickup address', pickupLocation: { lat: 21.037, lng: 105.783 },
    dropoffAddress: 'Local delivery address', dropoffLocation: { lat: 21.008, lng: 105.842 },
    recipientName: 'Test fixture', recipientPhone: '0900000000', expectedDeliveryAt: deadline }, crypto.randomUUID())
  session.actor = 'admin'; await assignShipment(order.id, userId(3)); await seed()
  session.actor = actor
  await act(async () => root.render(<ShipmentTracking id={order.id} status="ASSIGNED" />))
  await eventually(() => expect(node.querySelector('.tracking-eta')?.textContent).toContain('Chưa lấy hàng'))

  session.actor = 'driver1'; await pickupShipment(order.id); session.actor = actor; await refresh()
  await eventually(() => expect(node.querySelector('.eta-minutes')).not.toBeNull())
  expect(node.querySelector('.eta-minutes')?.textContent).toBe(Math.ceil(latest!.eta!.estimatedSeconds / 60) + ' phút')
  expect(node.querySelector<HTMLTimeElement>('.eta-arrival time')?.dateTime).toBe(latest!.eta!.estimatedArrivalAt)
  expect(latest!.expectedDeliveryAt).toBe(deadline)

  await seed('45 seconds'); await refresh()
  await eventually(() => expect(node.querySelector('.tracking-eta')?.textContent).toContain('GPS đã cũ'))
  expect(node.querySelector('.eta-minutes')).toBeNull()
  await server.query('DELETE FROM current_locations'); await refresh()
  await eventually(() => expect(node.querySelector('.tracking-eta')?.textContent).toContain('Chưa có GPS'))

  await seed('1 second', true); await refresh()
  await eventually(() => expect(node.querySelector('.eta-minutes')?.textContent).toBe('0 phút'))
  expect(node.querySelector('.eta-distance')?.textContent).toBe('0 m')
  expect(latest!.expectedDeliveryAt).toBe(deadline)

  session.actor = actor === 'admin' ? 'admin' : 'driver1'
  if (actor === 'admin') await failShipment(order.id, 'Người nhận từ chối')
  else await deliverShipment(order.id, '')
  session.actor = actor; await refresh()
  await eventually(() => expect(node.textContent).toContain('Đã kết thúc'))
  expect(node.querySelector('.tracking-eta')).toBeNull()
  expect(latest!.eta).toBeNull()

  session.actor = 'other'
  await act(async () => root.render(<ShipmentTracking key="other" id={order.id} status="PICKED_UP" />))
  await eventually(() => expect(node.querySelector('[role=alert]')?.textContent).toContain('không có quyền'))
  expect(node.querySelector('.eta-minutes')).toBeNull()
}, 15_000)
