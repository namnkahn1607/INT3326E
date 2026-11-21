import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrackingMap, type TrackingPin } from './TrackingMap'

const map = vi.hoisted(() => ({ fitBounds: vi.fn(), setView: vi.fn() }))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Marker: () => null, ZoomControl: () => null, Popup: () => null, useMap: () => map,
}))
vi.mock('./OsmBaseLayer', () => ({ OsmBaseLayer: () => null }))
vi.mock('../../features/auth/motion', () => ({ useReducedMotion: () => true }))

let node: HTMLDivElement, root: Root
const fixed: TrackingPin[] = [
  { id: 'pickup', label: 'Lấy', kind: 'pickup', position: { lat: 21, lng: 105 } },
  { id: 'dropoff', label: 'Giao', kind: 'dropoff', position: { lat: 21.1, lng: 105.1 } },
]
const driver = (id = 'driver-a', lat = 21.05): TrackingPin => ({ id, label: 'Tài xế', kind: 'fresh', position: { lat, lng: 105.05 } })
const render = (pins: TrackingPin[], scope = 'customer:shipment', selectedId?: string) =>
  act(async () => root.render(<TrackingMap pins={pins} scope={scope} selectedId={selectedId} />))
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.clearAllMocks()
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })

describe('Tracking viewport', () => {
  it('fits the first driver, then preserves panning across new GPS and transient marker removal', async () => {
    await render(fixed); await render([...fixed, driver()])
    expect(map.fitBounds).toHaveBeenCalledTimes(2)
    await render([...fixed, driver('driver-a', 21.06)])
    await render(fixed); await render([...fixed, driver('driver-a', 21.07)])
    expect(map.fitBounds).toHaveBeenCalledTimes(2)
    await render([...fixed, driver('driver-b')])
    expect(map.fitBounds).toHaveBeenCalledTimes(3)
  })
  it('refits when the shipment, account or fixed delivery points change', async () => {
    await render(fixed)
    await render(fixed, 'other-customer:shipment')
    await render(fixed, 'other-customer:other-shipment')
    await render([fixed[0], { ...fixed[1], position: { lat: 21.2, lng: 105.2 } }], 'other-customer:other-shipment')
    expect(map.fitBounds).toHaveBeenCalledTimes(4)
  })
  it('honors an explicitly selected driver without motion when reduced motion is enabled', async () => {
    await render([...fixed, driver()], 'fleet', 'driver-a')
    expect(map.setView).toHaveBeenCalledWith([21.05, 105.05], 14, { animate: false })
    await render([...fixed, driver('driver-a', 21.06)], 'fleet', 'driver-a')
    expect(map.setView).toHaveBeenCalledTimes(1)
  })
})
