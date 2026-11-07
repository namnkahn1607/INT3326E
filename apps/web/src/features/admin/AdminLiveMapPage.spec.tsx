import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminLiveMapPage } from './AdminLiveMapPage'
import { ApiError } from '../../api/client'
import type { DriverResponse } from '../../types/driver-api'
import type { TrackingPin } from '../../components/map/TrackingMap'

const api = vi.hoisted(() => ({ drivers: vi.fn(), account: 'admin-a' }))
vi.mock('../../api/endpoints/drivers', () => ({ getDrivers: api.drivers }))
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { id: api.account } }) }))
vi.mock('../../components/map/TrackingMap', () => ({ default: ({ pins }: { pins: TrackingPin[] }) =>
  <div data-testid="map">{pins.map(pin => <span key={pin.id} data-pin={pin.id}>{pin.label}</span>)}</div> }))
const driver = (id = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX', name = 'Driver A'): DriverResponse => ({ id, name,
  activeShipmentCount: 2, currentLocation: { lat: 0, lng: 0 }, lastLocationUpdatedAt: new Date().toISOString(),
  locationClientTimestamp: new Date().toISOString(), isLocationStale: false })
const page = (data: DriverResponse[], nextCursor: string | null = null) => ({ data, pagination: { limit: 20, hasMore: !!nextCursor, nextCursor } })
let root: Root, node: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers(); api.drivers.mockReset(); api.account = 'admin-a'
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); expect(vi.getTimerCount()).toBe(0); node.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })
const mount = () => act(async () => root.render(<AdminLiveMapPage />))
const button = (text: string) => [...node.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === text)!

describe('Admin paged GPS map', () => {
  it('draws only actual page GPS and filters fresh/stale/missing without online profiles', async () => {
    const fresh = driver(), old = { ...driver('usr_01ARZ3NDEKTSV4RRFFQ69G5FAY', 'Driver B'), isLocationStale: true }
    const missing = { ...driver('usr_01ARZ3NDEKTSV4RRFFQ69G5FAZ', 'Driver C'), activeShipmentCount: 0,
      currentLocation: null, lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null }
    api.drivers.mockResolvedValue(page([fresh, old, missing])); await mount()
    expect(node.textContent).toContain('3 tài xế đã tải'); expect(node.querySelectorAll('[data-pin]')).toHaveLength(2)
    expect(node.textContent).not.toContain('Đang hoạt động'); expect(node.textContent).not.toContain('29V1')
    await act(async () => button('GPS cũ').click())
    expect(node.querySelectorAll('.driver-map-card')).toHaveLength(1)
    expect(node.querySelector('[data-pin]')?.getAttribute('data-pin')).toBe(old.id)
    await act(async () => button('Chưa có GPS').click())
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
    expect(node.textContent).toContain('Driver C')
    expect(api.drivers).toHaveBeenCalledTimes(1)
  })
  it('keeps the cursor while polling and aborts a page request on account switch', async () => {
    api.drivers.mockResolvedValueOnce(page([driver()], 'cursor-b')).mockResolvedValue(page([driver(undefined, 'Page B')]))
    await mount(); await act(async () => button('Trang sau').click())
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(api.drivers.mock.calls.slice(1).every(call => call[0].cursor === 'cursor-b')).toBe(true)
    let finish!: (value: ReturnType<typeof page>) => void
    api.drivers.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    const signal = api.drivers.mock.calls.at(-1)![1] as AbortSignal
    api.account = 'admin-b'; await mount()
    await act(async () => finish(page([driver(undefined, 'Old account')])) )
    expect(signal.aborted).toBe(true); expect(api.drivers.mock.calls.at(-1)![0].cursor).toBeUndefined()
    expect(node.textContent).not.toContain('Old account'); expect(node.textContent).toContain('Trang 1')
  })
  it('removes map and rows after failure instead of retaining an apparent live fleet', async () => {
    api.drivers.mockResolvedValueOnce(page([driver()])).mockRejectedValue(new ApiError(503, 'SERVICE_UNAVAILABLE'))
    await mount(); expect(node.querySelector('[data-testid="map"]')).not.toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
    expect(node.querySelectorAll('.driver-map-card')).toHaveLength(0)
    expect(node.querySelector('[role="alert"]')).not.toBeNull()
  })
})
