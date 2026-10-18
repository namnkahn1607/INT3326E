import { act, useState, type ReactNode, type Ref } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShipmentLocationPicker } from './ShipmentLocationPicker'

const map = vi.hoisted(() => ({
  getContainer: vi.fn(), panBy: vi.fn(), selected: vi.fn(), center: { lat: 0, lng: 0 },
  click: undefined as undefined | ((event: { latlng: { wrap: () => { lat: number; lng: number } } }) => void),
}))
vi.mock('react-leaflet', async () => {
  const { useImperativeHandle } = await import('react')
  return {
    MapContainer: function MapMock({ children, ref }: { children: ReactNode; ref: Ref<unknown> }) {
      useImperativeHandle(ref, () => ({ getCenter: () => ({ wrap: () => map.center }) }))
      return <div data-testid="map">{children}</div>
    },
    TileLayer: () => null,
    CircleMarker: ({ children }: { children: ReactNode }) => <div data-testid="chosen-marker">{children}</div>,
    Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    useMapEvents: (events: { click: typeof map.click }) => { map.click = events.click; return map },
  }
})
function Picker({ disabled = false }: { disabled?: boolean }) {
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null)
  return <ShipmentLocationPicker kind="pickup" point={point} disabled={disabled} onSelect={value => { map.selected(value); setPoint(value) }} />
}
let node: HTMLDivElement
let root: Root
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  map.selected.mockReset(); map.panBy.mockReset(); map.center = { lat: 0, lng: 0 }
  map.getContainer.mockReturnValue(document.createElement('div'))
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  await act(async () => root.render(<Picker />))
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })
async function open() { await act(async () => node.querySelector<HTMLButtonElement>('#shipment-pickupLocation')!.click()) }

describe('Shipment map picker (mock map)', () => {
  it('opens without treating the default map center as a selected point', async () => {
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
    await open()
    expect(map.selected).not.toHaveBeenCalled()
    expect(node.querySelector('[data-testid="chosen-marker"]')).toBeNull()
    expect(node.querySelector('#shipment-pickupLocation')?.getAttribute('aria-expanded')).toBe('true')
  })
  it('selects a clicked point and keeps the marker and status in sync', async () => {
    await open()
    await act(async () => map.click!({ latlng: { wrap: () => ({ lat: 21.03781234, lng: 105.78293456 }) } }))
    expect(map.selected).toHaveBeenLastCalledWith({ lat: 21.037812, lng: 105.782935 })
    expect(node.querySelector('[data-testid="chosen-marker"]')).not.toBeNull()
    expect(node.querySelector('[role="status"]')?.textContent).toContain('Đã chọn')
  })
  it('offers a keyboard-operable center selection and restores focus after closing', async () => {
    await open()
    const center = Array.from(node.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Chọn điểm ở giữa bản đồ')!
    await act(async () => center.click())
    expect(map.selected).toHaveBeenLastCalledWith({ lat: 0, lng: 0 })
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
    expect(document.activeElement?.id).toBe('shipment-pickupLocation')
  })
  it('can close without selecting and rejects invalid map coordinates', async () => {
    await open()
    await act(async () => map.click!({ latlng: { wrap: () => ({ lat: 91, lng: 105 }) } }))
    const done = Array.from(node.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Xong')!
    await act(async () => done.click())
    expect(map.selected).not.toHaveBeenCalled()
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
  })
  it('pans with arrow keys without animation and removes the listener after closing', async () => {
    await open()
    const element = map.getContainer()
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(map.panBy).toHaveBeenLastCalledWith([80, 0], { animate: false })
    await open()
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(map.panBy).toHaveBeenCalledTimes(1)
  })
  it('removes map interactions and disables the trigger while the request is locked', async () => {
    await open()
    await act(async () => root.render(<Picker disabled />))
    expect(node.querySelector<HTMLButtonElement>('#shipment-pickupLocation')!.disabled).toBe(true)
    expect(node.querySelector('[data-testid="map"]')).toBeNull()
    expect(map.selected).not.toHaveBeenCalled()
  })
})
