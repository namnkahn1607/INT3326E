import { act, useState, type ReactNode, type Ref } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShipmentLocationPicker } from './ShipmentLocationPicker'
import type { AddressMatch } from './address-search'

const lookup = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('./address-search', async importOriginal => ({ ...await importOriginal<typeof import('./address-search')>(), searchAddress: lookup.search }))

const map = vi.hoisted(() => ({
  getContainer: vi.fn(), panBy: vi.fn(), fitBounds: vi.fn(), setView: vi.fn(), selected: vi.fn(), center: { lat: 0, lng: 0 },
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
    Rectangle: () => <div data-testid="search-area" />,
    Circle: () => <div data-testid="search-area" />,
    CircleMarker: ({ children }: { children: ReactNode }) => <div data-testid="chosen-marker">{children}</div>,
    Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    useMapEvents: (events: { click: typeof map.click }) => { map.click = events.click; return map },
  }
})
function Picker({ disabled = false, query = 'Duong Xuan Thuy, Ha Noi' }: { disabled?: boolean; query?: string }) {
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null)
  return <ShipmentLocationPicker kind="pickup" point={point} query={query} disabled={disabled} onSelect={value => { map.selected(value); setPoint(value) }} />
}
let node: HTMLDivElement
let root: Root
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  map.selected.mockReset(); map.panBy.mockReset(); map.center = { lat: 0, lng: 0 }
  map.fitBounds.mockReset(); map.setView.mockReset(); lookup.search.mockReset()
  map.getContainer.mockReturnValue(document.createElement('div'))
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  await act(async () => root.render(<Picker />))
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })
async function open() { await act(async () => node.querySelector<HTMLButtonElement>('#shipment-pickupLocation')!.click()) }

describe('Shipment map picker (mock map)', () => {
  const match: AddressMatch = { id: 'place', label: 'Duong Xuan Thuy, Ha Noi', point: { lat: 21.03, lng: 105.78 }, bounds: [[21.02, 105.77], [21.04, 105.79]] }
  it('only searches on explicit click and frames the result without confirming a shipping point', async () => {
    lookup.search.mockResolvedValue([match])
    expect(lookup.search).not.toHaveBeenCalled()
    await act(async () => node.querySelector<HTMLButtonElement>('[data-testid="pickup-address-search"]')!.click())
    expect(lookup.search.mock.calls[0][0]).toBe('Duong Xuan Thuy, Ha Noi')
    await act(async () => node.querySelector<HTMLButtonElement>('.shipment-address-result')!.click())
    expect(map.fitBounds).toHaveBeenLastCalledWith(match.bounds, { padding: [24, 24], maxZoom: 17, animate: false })
    expect(node.querySelector('[data-testid="search-area"]')).not.toBeNull()
    expect(map.selected).not.toHaveBeenCalled()
    expect(node.querySelector('[data-testid="chosen-marker"]')).toBeNull()
  })
  it('uses a reference circle for results without a bounding box', async () => {
    lookup.search.mockResolvedValue([{ ...match, bounds: undefined }])
    await act(async () => node.querySelector<HTMLButtonElement>('[data-testid="pickup-address-search"]')!.click())
    await act(async () => node.querySelector<HTMLButtonElement>('.shipment-address-result')!.click())
    expect(map.setView).toHaveBeenLastCalledWith(match.point, 16, { animate: false })
    expect(node.querySelector('[data-testid="search-area"]')).not.toBeNull()
    expect(map.selected).not.toHaveBeenCalled()
  })
  it('aborts and ignores old results after the address query changes', async () => {
    let finish!: (value: AddressMatch[]) => void
    lookup.search.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await act(async () => node.querySelector<HTMLButtonElement>('[data-testid="pickup-address-search"]')!.click())
    const signal = lookup.search.mock.calls[0][1] as AbortSignal
    await act(async () => root.render(<Picker query="Duong Dai Co Viet" />))
    expect(signal.aborted).toBe(true)
    await act(async () => finish([match]))
    expect(node.querySelector('.shipment-address-result')).toBeNull()
    expect(lookup.search).toHaveBeenCalledTimes(1)
  })
  it('offers manual selection on empty or failed searches', async () => {
    lookup.search.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('private diagnostic'))
    await act(async () => node.querySelector<HTMLButtonElement>('[data-testid="pickup-address-search"]')!.click())
    expect(node.textContent).toContain('Không tìm thấy địa chỉ')
    await act(async () => node.querySelector<HTMLButtonElement>('[data-testid="pickup-address-search"]')!.click())
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('chọn điểm thủ công')
    expect(node.textContent).not.toContain('private diagnostic')
    expect(node.querySelector('[data-testid="map"]')).not.toBeNull()
  })
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
