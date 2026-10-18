import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, TileLayer as LeafletTileLayer } from 'leaflet'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { CustomerHomeIcon } from './CustomerHomeIcon'

type Point = { lat: number; lng: number }
type Kind = 'pickup' | 'dropoff'

function MapSelection({ kind, onSelect }: { kind: Kind; onSelect: (point: Point) => void }) {
  const map = useMapEvents({ click: event => onSelect(event.latlng.wrap()) })
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

export function ShipmentLocationPicker({ kind, point, disabled, error, onSelect }: {
  kind: Kind; point: Point | null; disabled: boolean; error?: string; onSelect: (point: Point) => void
}) {
  const [open, setOpen] = useState(false)
  const [tileError, setTileError] = useState(false)
  const map = useRef<LeafletMap | null>(null)
  const tiles = useRef<LeafletTileLayer | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const label = kind === 'pickup' ? 'lấy' : 'giao'
  const id = 'shipment-' + kind + 'Location'
  function select(value: Point) {
    if (!disabled && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180) {
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
      <button ref={trigger} id={id} type="button" className="btn btn-outline" disabled={disabled}
        aria-expanded={open && !disabled} aria-controls={open && !disabled ? id + '-panel' : undefined}
        aria-invalid={!!error} aria-describedby={id + (error ? '-error' : '-status')}
        onClick={() => setOpen(value => !value)}>
        <CustomerHomeIcon name="pin" />{point ? 'Đổi vị trí ' : 'Chọn vị trí '}{label} hàng
      </button>
    </div>
    {error && <p id={id + '-error'} className="customer-field-error" role="alert">{error}</p>}
    {open && !disabled && <div id={id + '-panel'} className="shipment-location-panel">
      <p id={kind + '-map-help'} className="customer-field-hint">Chạm vào vị trí đúng với địa chỉ đã nhập. Dùng bàn phím: Tab vào bản đồ, di chuyển bằng phím mũi tên, sau đó chọn điểm ở giữa.</p>
      <div className="shipment-location-map-wrap">
        <MapContainer ref={map} className="shipment-location-map" center={point ?? { lat: 21.0285, lng: 105.8542 }} zoom={13}
          scrollWheelZoom={false} zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false}>
          <TileLayer ref={tiles} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            eventHandlers={{ tileerror: () => setTileError(true), tileload: () => setTileError(false) }} />
          <MapSelection kind={kind} onSelect={select} />
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
      <p className="customer-field-hint">Địa chỉ không tự đổi khi di chuyển ghim. Hãy chọn đúng điểm lấy/giao; vị trí hiển thị ban đầu chưa được dùng để tạo đơn.</p>
    </div>}
  </div>
}
