import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, TileLayer as LeafletTileLayer } from 'leaflet'
import { Circle, CircleMarker, MapContainer, Rectangle, TileLayer, Tooltip, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { CustomerHomeIcon } from './CustomerHomeIcon'
import { AddressSearchError, searchAddress, type AddressMatch } from './address-search'

type Point = { lat: number; lng: number }
type Kind = 'pickup' | 'dropoff'

function MapSelection({ kind, area, onSelect }: { kind: Kind; area: AddressMatch | null; onSelect: (point: Point) => void }) {
  const map = useMapEvents({ click: event => onSelect(event.latlng.wrap()) })
  useEffect(() => {
    if (!area) return
    if (area.bounds) map.fitBounds(area.bounds, { padding: [24, 24], maxZoom: 17, animate: false })
    else map.setView(area.point, 16, { animate: false })
    map.getContainer().focus()
  }, [map, area])
  useEffect(() => {
    const element = map.getContainer()
    element.setAttribute('role', 'region')
    element.setAttribute('aria-label', 'Bản đồ chọn điểm ' + (kind === 'pickup' ? 'lấy' : 'giao') + ' hàng')
    element.setAttribute('aria-describedby', kind + '-map-help')
    const pan = (event: KeyboardEvent) => {
      const offset: Record<string, [number, number]> = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] }
      if (event.target !== element || event.altKey || event.ctrlKey || event.metaKey || !offset[event.key]) return
      event.preventDefault(); event.stopPropagation()
      map.panBy(offset[event.key], { animate: false })
    }
    element.addEventListener('keydown', pan, true)
    return () => element.removeEventListener('keydown', pan, true)
  }, [map, kind])
  return null
}

interface PickerProps {
  kind: Kind; point: Point | null; query?: string; disabled: boolean; error?: string; onSelect: (point: Point) => void
}

export function ShipmentLocationPicker(props: PickerProps) {
  return <LocationPicker key={(props.query ?? '') + ':' + props.disabled} {...props} />
}

function LocationPicker({ kind, point, query = '', disabled, error, onSelect }: PickerProps) {
  const [open, setOpen] = useState(false)
  const [tileError, setTileError] = useState(false)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<AddressMatch[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [area, setArea] = useState<AddressMatch | null>(null)
  const request = useRef<AbortController | null>(null)
  const map = useRef<LeafletMap | null>(null)
  const tiles = useRef<LeafletTileLayer | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const label = kind === 'pickup' ? 'lấy' : 'giao'
  const id = 'shipment-' + kind + 'Location'
  useEffect(() => () => request.current?.abort(), [])
  async function search() {
    if (disabled || request.current) return
    const controller = new AbortController()
    request.current = controller
    setSearching(true); setOpen(true); setResults(null); setSearchError(null)
    try {
      const matches = await searchAddress(query, controller.signal)
      if (!controller.signal.aborted) setResults(matches)
    } catch (cause) {
      if (!controller.signal.aborted) setSearchError(cause instanceof AddressSearchError ? cause.message : 'Chưa tìm được địa chỉ. Thử lại hoặc chọn điểm thủ công.')
    } finally {
      if (!controller.signal.aborted) { setSearching(false); request.current = null }
    }
  }
  function select(value: Point) {
    if (!disabled && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180) {
      request.current?.abort(); request.current = null; setSearching(false)
      onSelect({ lat: Number(value.lat.toFixed(6)), lng: Number(value.lng.toFixed(6)) })
    }
  }
  function close() { setOpen(false); trigger.current?.focus() }

  return <div className="shipment-location-picker full-width">
    <div className="shipment-location-heading">
      <div><p className="shipment-location-label">Vị trí {label} hàng *</p>
        <p id={id + '-status'} className="customer-field-hint" role="status">
          {point ? 'Đã chọn điểm trên bản đồ.' : 'Chưa chọn vị trí. Không cần nhập kinh độ, vĩ độ.'}
        </p>
      </div>
      <div className="shipment-location-actions">
      <button type="button" className="btn btn-secondary" disabled={disabled || searching || query.trim().length < 3}
        aria-busy={searching} onClick={search} data-testid={kind + '-address-search'}>
        <CustomerHomeIcon name="search" />{searching ? 'Đang tìm…' : 'Tìm trên bản đồ'}
      </button>
      <button ref={trigger} id={id} type="button" className="btn btn-outline" disabled={disabled}
        aria-expanded={open && !disabled} aria-controls={open && !disabled ? id + '-panel' : undefined}
        aria-invalid={!!error} aria-describedby={id + (error ? '-error' : '-status')}
        onClick={() => setOpen(value => !value)}>
        <CustomerHomeIcon name="pin" />{point ? 'Đổi vị trí ' : 'Chọn vị trí '}{label} hàng
      </button>
      </div>
    </div>
    <p className="customer-field-hint shipment-search-privacy">Nhấn tìm sẽ gửi tên đường/tòa nhà và khu vực tới <a href="https://photon.komoot.io" target="_blank" rel="noreferrer">Photon</a> (dữ liệu OpenStreetMap). Không gửi ô địa chỉ chi tiết hay thông tin người nhận.</p>
    {error && <p id={id + '-error'} className="customer-field-error" role="alert">{error}</p>}
    {open && !disabled && <div id={id + '-panel'} className="shipment-location-panel">
      {searching && <p role="status">Đang tìm khu vực phù hợp…</p>}
      {searchError && <p className="customer-field-error" role="alert">{searchError}</p>}
      {results && <div className="shipment-address-results">
        <p role="status">{results.length ? 'Chọn kết quả để khoanh vùng, sau đó chọn điểm chính xác trên bản đồ.' : 'Không tìm thấy địa chỉ. Thử thêm khu vực hoặc chọn điểm thủ công.'}</p>
        {results.length > 0 && <ul aria-label="Kết quả tìm địa chỉ">{results.map(result => <li key={result.id}>
          <button type="button" className="shipment-address-result" aria-pressed={area?.id === result.id}
            onClick={() => setArea(result)}>{result.label}<CustomerHomeIcon name="arrow" /></button>
        </li>)}</ul>}
      </div>}
      <p id={kind + '-map-help'} className="customer-field-hint">Chạm vào vị trí đúng với địa chỉ đã nhập. Dùng bàn phím: Tab vào bản đồ, di chuyển bằng phím mũi tên, sau đó chọn điểm ở giữa.</p>
      <div className="shipment-location-map-wrap">
        <MapContainer ref={map} className="shipment-location-map" center={point ?? { lat: 21.0285, lng: 105.8542 }} zoom={13}
          scrollWheelZoom={false} zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false}>
          <TileLayer ref={tiles} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            eventHandlers={{ tileerror: () => setTileError(true), tileload: () => setTileError(false) }} />
          <MapSelection kind={kind} area={area} onSelect={select} />
          {area && (area.bounds
            ? <Rectangle bounds={area.bounds} pathOptions={{ color: '#7c3aed', weight: 2, fillOpacity: .06, dashArray: '6 6' }} />
            : <Circle center={area.point} radius={250} pathOptions={{ color: '#7c3aed', weight: 2, fillOpacity: .06, dashArray: '6 6' }} />)}
          {point && <CircleMarker center={point} radius={9} pathOptions={{ color: '#5b21b6', fillColor: '#7c3aed', fillOpacity: 1, weight: 3 }}>
            <Tooltip permanent direction="top">Điểm {label} hàng</Tooltip>
          </CircleMarker>}
        </MapContainer>
        <span className="shipment-map-center" aria-hidden="true"><CustomerHomeIcon name="pin" /></span>
      </div>
      {tileError && <div className="shipment-map-network-error" role="status">
        <p className="customer-field-error">Chưa tải được đầy đủ nền bản đồ. Kiểm tra kết nối trước khi xác nhận vị trí.</p>
        <button type="button" className="btn btn-outline" onClick={() => { setTileError(false); tiles.current?.redraw() }}>Thử tải lại bản đồ</button>
      </div>}
      <div className="shipment-map-actions">
        <button type="button" className="btn btn-secondary" onClick={() => {
          const center = map.current?.getCenter().wrap()
          if (center) { select(center); close() }
        }}>Chọn điểm ở giữa bản đồ</button>
        <button type="button" className="btn btn-outline" onClick={close}>Xong</button>
      </div>
      <p className="customer-field-hint">{area ? 'Vùng đánh dấu chỉ để tham khảo, không phải ranh giới nhà hay vị trí đã xác nhận. ' : ''}Địa chỉ không tự đổi khi di chuyển ghim; chỉ dùng tọa độ sau khi bạn chọn điểm.</p>
    </div>}
  </div>
}
