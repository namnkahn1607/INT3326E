import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Panel from './ShipmentTrackingPanel'
import { trackingFixture } from './tracking-fixture'
import { ApiError } from '../../api/client'
import { formatDateTime } from '../../utils'

const api = vi.hoisted(() => ({ load: vi.fn(), account: 'customer-a' }))
vi.mock('../../api/endpoints/tracking', () => ({ getShipmentTracking: api.load }))
vi.mock('../../features/auth/useAuth', () => ({ useAuth: () => ({ user: { id: api.account } }) }))
vi.mock('../map/TrackingMap', () => ({ default: () => <div data-testid="map" /> }))
let root: Root, node: HTMLDivElement
const eta = { distanceMeters: 1250, estimatedSeconds: 65, estimatedArrivalAt: '2026-11-25T03:04:00.000Z' }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-25T01:00:00.000Z'))
  api.load.mockReset(); api.account = 'customer-a'
  api.load.mockResolvedValue(trackingFixture({ eta, etaUnavailableReason: null }))
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => {
  await act(async () => root.unmount()); expect(vi.getTimerCount()).toBe(0)
  node.remove(); vi.useRealTimers(); vi.unstubAllGlobals()
})
const mount = () => act(async () => root.render(<Panel id={trackingFixture().shipmentId} />))
const refresh = () => act(async () => node.querySelector<HTMLButtonElement>('.tracking-toolbar button')!.click())

it('renders server minutes/distance/arrival, not the client clock plus a travel calculation', async () => {
  await mount()
  expect(node.querySelector('.eta-minutes')?.textContent).toBe('2 phút')
  expect(node.querySelector('.eta-distance')?.textContent).toBe('1,3 km')
  const time = node.querySelector<HTMLTimeElement>('.eta-arrival time')!
  expect(time.dateTime).toBe(eta.estimatedArrivalAt)
  expect(time.textContent).toBe(formatDateTime(eta.estimatedArrivalAt))
  expect(node.textContent).toContain('Ước lượng đường chim bay, không phải hạn giao.')
  expect(api.load).toHaveBeenCalledTimes(1)
})
it.each([[0, 0, '0 phút', '0 m'], [450, 61, '2 phút', '450 m']] as const)(
  'keeps zero and metric units without claiming a delivery happened (%s m)', async (distanceMeters, estimatedSeconds, minutes, distance) => {
    api.load.mockResolvedValue(trackingFixture({ eta: { ...eta, distanceMeters, estimatedSeconds }, etaUnavailableReason: null }))
    await mount()
    expect(node.querySelector('.eta-minutes')?.textContent).toBe(minutes)
    expect(node.querySelector('.eta-distance')?.textContent).toBe(distance)
    expect(node.textContent).not.toContain('Đã tới điểm giao')
  })
it.each([
  ['NOT_PICKED_UP', 'ASSIGNED', 'Chưa lấy hàng'],
  ['LOCATION_MISSING', 'PICKED_UP', 'Chưa có GPS'],
  ['LOCATION_STALE', 'PICKED_UP', 'GPS đã cũ'],
  ['CONFIG_INVALID', 'PICKED_UP', 'Tạm thời chưa có ước tính'],
] as const)('explains %s without fake numeric estimates', async (reason, status, text) => {
  api.load.mockResolvedValue(trackingFixture({ status, eta: null, etaUnavailableReason: reason,
    ...(reason === 'LOCATION_STALE' ? { isLocationStale: true } : {}),
    ...(reason === 'LOCATION_MISSING' ? { currentDriverLocation: null, locationClientTimestamp: null, lastLocationUpdatedAt: null, isLocationStale: null } : {}) }))
  await mount()
  expect(node.querySelector('.tracking-eta [role=status]')?.textContent).toContain(text)
  expect(node.querySelector('.eta-minutes')).toBeNull()
  expect(node.textContent).not.toContain(reason)
})
it('hides the old estimate when GPS ages past 30s during a slow poll and restores only a fresh response', async () => {
  let finish!: (value: ReturnType<typeof trackingFixture>) => void
  api.load.mockResolvedValueOnce(trackingFixture({ eta, etaUnavailableReason: null }))
    .mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await mount()
  const map = node.querySelector('[data-testid=map]')
  await act(async () => vi.advanceTimersByTimeAsync(30_000))
  expect(node.querySelector('.eta-minutes')).not.toBeNull()
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(node.querySelector('.eta-minutes')).toBeNull()
  expect(node.querySelector('.tracking-eta')?.textContent).toContain('GPS đã cũ')
  expect(api.load).toHaveBeenCalledTimes(2)
  await act(async () => finish(trackingFixture({ eta: { ...eta, estimatedSeconds: 450 }, etaUnavailableReason: null })))
  expect(node.querySelector('.eta-minutes')?.textContent).toBe('8 phút')
  expect(node.querySelector('[data-testid=map]')).toBe(map)
})
it.each([401, 403, 503])('clears ETA on HTTP %s and only restores it after a valid retry', async status => {
  api.load.mockResolvedValueOnce(trackingFixture({ eta, etaUnavailableReason: null }))
    .mockRejectedValue(new ApiError(status, 'HTTP_ERROR'))
  await mount(); await refresh()
  expect(node.querySelector('.eta-minutes')).toBeNull()
  expect(node.querySelector('.eta-arrival')).toBeNull()
  api.load.mockResolvedValue(trackingFixture({ eta, etaUnavailableReason: null })); await refresh()
  expect(node.querySelector('.eta-minutes')).not.toBeNull()
})
it.each(['DELIVERED', 'DELIVERY_FAILED'] as const)('hides ETA and stops polling for %s', async status => {
  api.load.mockResolvedValue(trackingFixture({ status, eta: null, etaUnavailableReason: 'NOT_PICKED_UP',
    currentDriverLocation: null, locationClientTimestamp: null, lastLocationUpdatedAt: null, isLocationStale: null }))
  await mount()
  expect(node.querySelector('.tracking-eta')).toBeNull()
  await act(async () => vi.advanceTimersByTimeAsync(20_000))
  expect(api.load).toHaveBeenCalledTimes(1)
})
it('does not show the previous account estimate while the next account request is pending', async () => {
  await mount()
  api.load.mockImplementation(() => new Promise(() => {})); api.account = 'customer-b'
  await mount()
  expect(node.querySelector('.eta-minutes')).toBeNull()
  expect(node.querySelector('.eta-arrival')).toBeNull()
})
