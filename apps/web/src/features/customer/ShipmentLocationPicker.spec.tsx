import { act, useState, type ReactNode, type Ref } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShipmentLocationPicker } from './ShipmentLocationPicker'
import type { AddressMatch } from './address-search'

const lookup = vi.hoisted(() => ({ search: vi.fn(), reverse: vi.fn() }))
vi.mock('./address-search', async importOriginal => ({ ...await importOriginal<typeof import('./address-search')>(), searchAddress: lookup.search, reverseAddress: lookup.reverse }))
vi.mock('../../components/map/OsmBaseLayer', () => ({ OsmBaseLayer: () => <span data-testid="osm-base-layer" /> }))

const map = vi.hoisted(() => ({
  getContainer: vi.fn(), getCenter: vi.fn(), panBy: vi.fn(), fitBounds: vi.fn(), setView: vi.fn(), selected: vi.fn(), invalidateSize: vi.fn(), center: { lat: 0, lng: 0 },
  click: undefined as undefined | ((event: { latlng: { wrap: () => { lat: number; lng: number } } }) => void),
  drag: undefined as undefined | (() => void),
}))
vi.mock('react-leaflet', async () => {
  const { useImperativeHandle } = await import('react')
  return {
    MapContainer: function MapMock({ children, ref }: { children: ReactNode; ref: Ref<unknown> }) {
      useImperativeHandle(ref, () => ({ getCenter: () => ({ wrap: () => map.center }) }))
      return <div data-testid="map">{children}</div>
    },
    Rectangle: () => <div data-testid="search-area" />,
    Circle: () => <div data-testid="search-area" />,
    CircleMarker: ({ children }: { children: ReactNode }) => <div data-testid="chosen-marker">{children}</div>,
    Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    useMapEvents: (events: { click: typeof map.click; dragstart: typeof map.drag }) => { map.click = events.click; map.drag = events.dragstart; return map },
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
  lookup.reverse.mockReset().mockResolvedValue(null)
  map.invalidateSize.mockReset()
  const mapElement = document.createElement('div')
  mapElement.getClientRects = () => [{ width: 400, height: 300 }] as unknown as DOMRectList
  map.getContainer.mockReturnValue(mapElement)
  map.getCenter.mockImplementation(() => ({ wrap: () => map.center }))
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  await act(async () => root.render(<Picker />))
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); vi.useRealTimers() })
async function open() { await act(async () => node.querySelector<HTMLButtonElement>('#shipment-pickupLocation')!.click()) }
async function typeSearch(value: string) {
  await act(async () => {
    const input = node.querySelector<HTMLInputElement>('input[type=search]')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Shipment map picker (mock map)', () => {
  const match: AddressMatch = { id: 'place', label: 'Duong Xuan Thuy, Ha Noi', point: { lat: 21.03, lng: 105.78 }, bounds: [[21.02, 105.77], [21.04, 105.79]] }
  it('shows an editable search bar immediately, without searching while typing', async () => {
    expect(node.querySelector<HTMLInputElement>('input[type=search]')?.value).toBe('Duong Xuan Thuy, Ha Noi')
    expect(node.querySelector('[data-testid="pickup-address-search"]')?.textContent).toBe('')
    await typeSearch('Đường Trần Duy Hưng, Hà Nội')
    expect(lookup.search).not.toHaveBeenCalled()
    expect(map.selected).not.toHaveBeenCalled()
    lookup.search.mockResolvedValue([match])
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    await act(async () => node.querySelector('input[type=search]')!.dispatchEvent(enter))
    expect(enter.defaultPrevented).toBe(true)
    expect(lookup.search).toHaveBeenCalledWith('Đường Trần Duy Hưng, Hà Nội', expect.any(AbortSignal))
  })
  it('cancels an old search when editing the visible bar and ignores its late response', async () => {
    let finish!: (matches: AddressMatch[]) => void
    lookup.search.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await act(async () => node.querySelector<HTMLButtonElement>('[data-testid="pickup-address-search"]')!.click())
    const signal = lookup.search.mock.calls[0][1] as AbortSignal
    await typeSearch('Địa chỉ mới')
    expect(signal.aborted).toBe(true)
    await act(async () => finish([match]))
    expect(node.querySelector('.shipment-address-result')).toBeNull()
  })
  it('frames district bounds at area zoom without searching or confirming a delivery point', async () => {
    await act(async () => root.render(<ShipmentLocationPicker initialOpen hideToggle kind="pickup" point={null} disabled={false} districtArea={match} onSelect={map.selected} />))
    expect(map.fitBounds).toHaveBeenLastCalledWith(match.bounds, { padding: [24, 24], maxZoom: 14, animate: false })
    expect(map.selected).not.toHaveBeenCalled()
    expect(lookup.search).not.toHaveBeenCalled()
    expect(node.querySelector('[data-testid="chosen-marker"]')).toBeNull()
    expect(node.querySelector('#shipment-pickupLocation')).toBeNull()
  })
  it('uses a district overview zoom when the provider has no bounds', async () => {
    await act(async () => root.render(<ShipmentLocationPicker initialOpen kind="pickup" point={null} disabled={false} districtArea={{ ...match, bounds: undefined }} onSelect={map.selected} />))
    expect(map.setView).toHaveBeenLastCalledWith(match.point, 13, { animate: false })
    expect(map.selected).not.toHaveBeenCalled()
  })
  it('does not jump to a late district result after the user moves the map', async () => {
    await act(async () => root.render(<ShipmentLocationPicker initialOpen kind="pickup" point={null} disabled={false} onSelect={map.selected} />))
    await act(async () => map.drag!())
    await act(async () => root.render(<ShipmentLocationPicker initialOpen kind="pickup" point={null} disabled={false} districtArea={match} onSelect={map.selected} />))
    expect(map.fitBounds).not.toHaveBeenCalled()
    expect(map.setView).not.toHaveBeenCalled()
  })
  it('does not let a previous address search override a newly selected district', async () => {
    await act(async () => root.render(<ShipmentLocationPicker initialOpen kind="pickup" point={null} disabled={false} query="Old road" onSelect={map.selected} />))
    lookup.search.mockResolvedValue([match])
    await act(async () => node.querySelector<HTMLButtonElement>('[data-testid="pickup-address-search"]')!.click())
    await act(async () => node.querySelector<HTMLButtonElement>('.shipment-address-result')!.click())
    const district = { ...match, id: 'new-district', point: { lat: 21.1, lng: 105.8 }, bounds: [[21.08, 105.78], [21.12, 105.82]] as [[number, number], [number, number]] }
    map.fitBounds.mockClear()
    await act(async () => root.render(<ShipmentLocationPicker initialOpen kind="pickup" point={null} disabled={false} query="New district" districtArea={district} onSelect={map.selected} />))
    expect(map.fitBounds).toHaveBeenLastCalledWith(district.bounds, { padding: [24, 24], maxZoom: 14, animate: false })
    expect(map.selected).not.toHaveBeenCalled()
  })
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
    const existingMap = node.querySelector('[data-testid="map"]')
    await act(async () => root.render(<Picker query="Duong Dai Co Viet" />))
    expect(signal.aborted).toBe(true)
    expect(node.querySelector('[data-testid="map"]')).toBe(existingMap)
    await act(async () => finish([match]))
    expect(node.querySelector('.shipment-address-result')).toBeNull()
    expect(lookup.search).toHaveBeenCalledTimes(1)
  })
  it('offers manual selection on empty or failed searches', async () => {
    lookup.search.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('private diagnostic'))
    await act(async () => node.querySelector<HTMLButtonElement>('[data-testid="pickup-address-search"]')!.click())
    expect(node.textContent).toContain('Không tìm thấy địa chỉ')
    await act(async () => node.querySelector<HTMLButtonElement>('[data-testid="pickup-address-search"]')!.click())
    expect(node.querySelector('[role="alert"]')?.textContent).toBe('Chưa tìm được địa chỉ.')
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
    lookup.reverse.mockResolvedValue({ ...match, address: { street: 'Road', area: 'Hanoi' } })
    await open()
    await act(async () => map.click!({ latlng: { wrap: () => ({ lat: 21.03781234, lng: 105.78293456 }) } }))
    expect(map.selected).toHaveBeenLastCalledWith({ lat: 21.037812, lng: 105.782935 })
    expect(node.querySelector('[data-testid="chosen-marker"]')).not.toBeNull()
    expect(node.querySelector('[role="status"]')?.textContent).toContain('Đã chọn')
  })
  it('reuses the selection status line while resolving instead of inserting another loading line', async () => {
    let finish!: (value: AddressMatch) => void
    lookup.reverse.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await open()
    const status = node.querySelector('#shipment-pickupLocation-status')!
    await act(async () => map.click!({ latlng: { wrap: () => ({ lat: 21.03, lng: 105.78 }) } }))
    expect(node.querySelector('#shipment-pickupLocation-status')).toBe(status)
    expect(status.textContent).toBe('Đang lấy địa chỉ…')
    expect(Array.from(node.querySelectorAll('p')).filter(element => element.textContent === 'Đang lấy địa chỉ…')).toHaveLength(1)
    expect(node.querySelector('.shipment-selected-location')).toBeNull()
    await act(async () => finish({ ...match, address: { street: 'Road', area: 'Hanoi' } }))
    expect(node.querySelector('#shipment-pickupLocation-status')).toBe(status)
    expect(status.textContent).toBe('Đã chọn điểm.')
  })
  it('looks up a selected point once, fills public address fields and never replaces the pin with a nearby provider point', async () => {
    const address = { street: 'Duong Xuan Thuy', area: 'Ha Noi' }
    lookup.reverse.mockResolvedValue({ ...match, point: { lat: 22, lng: 106 }, address })
    await open()
    await act(async () => map.click!({ latlng: { wrap: () => ({ lat: 21.037812, lng: 105.782935 }) } }))
    expect(lookup.reverse).toHaveBeenCalledWith({ lat: 21.037812, lng: 105.782935 }, expect.any(AbortSignal))
    expect(map.selected).toHaveBeenLastCalledWith({ lat: 21.037812, lng: 105.782935 })
    expect(node.textContent).not.toContain('Kiểm tra và bổ sung')
    expect(node.textContent).not.toContain('Lấy lại địa chỉ từ điểm này')
    expect(node.textContent).not.toContain('Chọn điểm sẽ gửi tọa độ')
    expect(node.textContent).not.toContain('Chạm để chọn điểm')
    expect(node.textContent).not.toContain('Di chuyển bản đồ không tự đổi điểm')
    expect(lookup.search).not.toHaveBeenCalled()
  })
  it('ignores an old reverse lookup after choosing another point', async () => {
    let finish!: (value: AddressMatch) => void
    lookup.reverse.mockReturnValueOnce(new Promise(resolve => { finish = resolve })).mockResolvedValueOnce(null)
    await open()
    await act(async () => map.click!({ latlng: { wrap: () => ({ lat: 21.03, lng: 105.78 }) } }))
    const signal = lookup.reverse.mock.calls[0][1] as AbortSignal
    await act(async () => map.click!({ latlng: { wrap: () => ({ lat: 20, lng: 105 }) } }))
    expect(signal.aborted).toBe(true)
    await act(async () => finish({ ...match, address: { street: 'Old address', area: 'Old area' } }))
    expect(map.selected).toHaveBeenCalledTimes(2)
    expect(map.selected).toHaveBeenLastCalledWith({ lat: 20, lng: 105 })
  })
  it('aborts a reverse lookup if the user types a different address, without overwriting that input', async () => {
    let finish!: (value: AddressMatch) => void
    lookup.reverse.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await open()
    await act(async () => map.click!({ latlng: { wrap: () => ({ lat: 21.03, lng: 105.78 }) } }))
    const signal = lookup.reverse.mock.calls[0][1] as AbortSignal
    await act(async () => root.render(<Picker query="New typed address" />))
    expect(signal.aborted).toBe(true)
    await act(async () => finish({ ...match, address: { street: 'Old address', area: 'Old area' } }))
    expect(map.selected).toHaveBeenCalledTimes(1)
  })
  it('has only a Done footer and retains keyboard point selection without a center button', async () => {
    await open()
    expect(node.querySelector('.shipment-map-actions')?.textContent).toBe('Xong')
    expect(node.querySelector('.shipment-map-center')).toBeNull()
    await act(async () => map.getContainer().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })))
    expect(map.selected).toHaveBeenLastCalledWith({ lat: 0, lng: 0 })
    await act(async () => node.querySelector<HTMLButtonElement>('.shipment-map-actions button')!.click())
    expect(node.querySelector<HTMLElement>('#shipment-pickupLocation-panel')!.hidden).toBe(true)
    expect(document.activeElement?.id).toBe('shipment-pickupLocation')
  })
  it('can close without selecting and rejects invalid map coordinates', async () => {
    await open()
    await act(async () => map.click!({ latlng: { wrap: () => ({ lat: 91, lng: 105 }) } }))
    const done = Array.from(node.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Xong')!
    await act(async () => done.click())
    expect(map.selected).not.toHaveBeenCalled()
    expect(node.querySelector<HTMLElement>('#shipment-pickupLocation-panel')!.hidden).toBe(true)
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
    expect(node.querySelector<HTMLElement>('#shipment-pickupLocation-panel')!.hidden).toBe(true)
    expect(map.selected).not.toHaveBeenCalled()
  })
  it('reuses the same map across closing/reopening and recalculates its size', async () => {
    await open()
    const existingMap = node.querySelector('[data-testid="map"]')
    await open(); await open()
    expect(node.querySelector('[data-testid="map"]')).toBe(existingMap)
    expect(map.invalidateSize).toHaveBeenCalledTimes(2)
  })
  it('uses the lightweight OSM layer while retaining the selected point', async () => {
    await open()
    await act(async () => map.click!({ latlng: { wrap: () => ({ lat: 21.03, lng: 105.78 }) } }))
    expect(node.querySelector('[data-testid="osm-base-layer"]')).not.toBeNull()
    expect(node.querySelector('[data-testid="chosen-marker"]')).not.toBeNull()
  })
})
