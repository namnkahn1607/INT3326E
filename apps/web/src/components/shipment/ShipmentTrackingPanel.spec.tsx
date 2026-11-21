import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Panel from './ShipmentTrackingPanel'
import { ShipmentTracking } from './ShipmentTracking'
import { trackingFixture } from './tracking-fixture'
import { ApiError } from '../../api/client'
import type { TrackingPin } from '../map/TrackingMap'

const api = vi.hoisted(() => ({ load: vi.fn(), account: 'customer-a' }))
vi.mock('../../api/endpoints/tracking', () => ({ getShipmentTracking: api.load }))
vi.mock('../../features/auth/useAuth', () => ({ useAuth: () => ({ user: { id: api.account } }) }))
vi.mock('../map/TrackingMap', () => ({ default: ({ pins }: { pins: TrackingPin[] }) =>
  <div data-testid="map">{pins.map(pin => <span key={pin.id} data-pin={pin.id}>{pin.label}</span>)}</div> }))
let root: Root, node: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-30T03:00:00.000Z'))
  api.load.mockReset(); api.account = 'customer-a'
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); expect(vi.getTimerCount()).toBe(0); node.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })
const mount = () => act(async () => root.render(<Panel id={trackingFixture().shipmentId} />))

describe('Shipment tracking UI using server snapshots', () => {
  it('compares a newly received sample against its read time before the next clock tick', async () => {
    let finish!: (value: ReturnType<typeof trackingFixture>) => void
    api.load.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await mount(); await act(async () => vi.advanceTimersByTimeAsync(500))
    await act(async () => finish(trackingFixture()))
    expect(node.querySelector('.tracking-gps-state')?.textContent).toBe('GPS mới')
  })
  it('hides GPS and cancels a pending read immediately when the detail confirms a terminal action', async () => {
    let finish!: (value: ReturnType<typeof trackingFixture>) => void
    api.load.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const id = trackingFixture().shipmentId
    await act(async () => root.render(<ShipmentTracking id={id} status="PICKED_UP" />))
    const signal = api.load.mock.calls[0][2] as AbortSignal
    await act(async () => root.render(<ShipmentTracking id={id} status="DELIVERY_FAILED" />))
    await act(async () => finish(trackingFixture()))
    expect(signal.aborted).toBe(true)
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
    expect(node.textContent).toContain('ẩn vị trí tài xế')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('replaces a reassigned driver and removes GPS on terminal without polling again', async () => {
    const first = trackingFixture(), second = trackingFixture({ driverId: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAY' })
    api.load.mockResolvedValueOnce(first).mockResolvedValueOnce(second).mockResolvedValue({ ...second,
      status: 'DELIVERED', currentDriverLocation: null, lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null })
    await mount()
    expect(node.querySelector(`[data-pin="${first.driverId}"]`)).not.toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(node.querySelector(`[data-pin="${first.driverId}"]`)).toBeNull()
    expect(node.querySelector(`[data-pin="${second.driverId}"]`)).not.toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(20_000))
    expect(api.load).toHaveBeenCalledTimes(3)
    expect(node.querySelectorAll('[data-pin]')).toHaveLength(2)
    expect(node.textContent).toContain('Ẩn vị trí tài xế')
  })
  it('marks a sample old while a poll is still pending and clears markers on permission failure', async () => {
    let reject!: (value: unknown) => void
    api.load.mockResolvedValueOnce(trackingFixture()).mockImplementation(() => new Promise((_, fail) => { reject = fail }))
    await mount(); expect(node.textContent).toContain('GPS mới')
    await act(async () => vi.advanceTimersByTimeAsync(31_000))
    expect(api.load).toHaveBeenCalledTimes(2)
    expect(node.textContent).toContain('GPS cũ')
    await act(async () => reject(new ApiError(403, 'FORBIDDEN_RESOURCE')))
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('không có quyền')
  })
  it('keeps fixed delivery pins for missing GPS and never invents a driver', async () => {
    api.load.mockResolvedValue(trackingFixture({ currentDriverLocation: null, lastLocationUpdatedAt: null,
      locationClientTimestamp: null, isLocationStale: null, etaUnavailableReason: 'LOCATION_MISSING' }))
    await mount()
    expect(node.textContent).toContain('Chưa có GPS')
    expect(node.querySelectorAll('[data-pin]')).toHaveLength(2)
  })
  it('discards pending GPS from a previous account', async () => {
    let finish!: (value: ReturnType<typeof trackingFixture>) => void
    api.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockRejectedValue(new ApiError(403, 'FORBIDDEN_RESOURCE'))
    await mount(); const signal = api.load.mock.calls[0][2] as AbortSignal
    api.account = 'customer-b'; await mount()
    await act(async () => finish(trackingFixture()))
    expect(signal.aborted).toBe(true)
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
  })
  it('keeps the same map and delivery pins during initial loading, a failed poll and recovery', async () => {
    let finish!: (value: ReturnType<typeof trackingFixture>) => void
    api.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockRejectedValueOnce(new ApiError(503, 'SERVICE_UNAVAILABLE')).mockResolvedValue(trackingFixture())
    const points = trackingFixture()
    await act(async () => root.render(<ShipmentTracking id={points.shipmentId} status="PICKED_UP"
      pickupLocation={points.pickupLocation} dropoffLocation={points.dropoffLocation} />))
    const map = node.querySelector('[data-testid="map"]')
    expect(map).not.toBeNull()
    expect(map!.querySelectorAll('[data-pin]')).toHaveLength(2)
    await act(async () => finish(points))
    expect(node.querySelector('[data-testid="map"]')).toBe(map)
    expect(map!.querySelectorAll('[data-pin]')).toHaveLength(3)
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(node.querySelector('[data-testid="map"]')).toBe(map)
    expect(map!.querySelectorAll('[data-pin]')).toHaveLength(2)
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('Chưa tải được vị trí')
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(node.querySelector('[data-testid="map"]')).toBe(map)
    expect(map!.querySelectorAll('[data-pin]')).toHaveLength(3)
  })
  it('keeps the map but removes the driver during manual refresh', async () => {
    let finish!: (value: ReturnType<typeof trackingFixture>) => void
    const points = trackingFixture()
    api.load.mockResolvedValueOnce(points).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await act(async () => root.render(<Panel id={points.shipmentId}
      pickupLocation={points.pickupLocation} dropoffLocation={points.dropoffLocation} />))
    const map = node.querySelector('[data-testid="map"]')
    await act(async () => node.querySelector<HTMLButtonElement>('button')!.click())
    expect(node.querySelector('[data-testid="map"]')).toBe(map)
    expect(map!.querySelectorAll('[data-pin]')).toHaveLength(2)
    expect(node.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true)
    await act(async () => finish(points))
    expect(map!.querySelectorAll('[data-pin]')).toHaveLength(3)
  })
  it.each([401, 403, 404, 409, 0])('hides even the delivery map after a permanent tracking error (%s)', async status => {
    const points = trackingFixture()
    api.load.mockResolvedValueOnce(points).mockRejectedValue(new ApiError(status,
      status === 0 ? 'INVALID_RESPONSE' : status === 409 ? 'USER_NOT_PROVISIONED' : 'HTTP_ERROR'))
    await act(async () => root.render(<Panel id={points.shipmentId}
      pickupLocation={points.pickupLocation} dropoffLocation={points.dropoffLocation} />))
    await act(async () => vi.advanceTimersByTimeAsync(20_000))
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
    expect(api.load).toHaveBeenCalledTimes(2)
  })
})
