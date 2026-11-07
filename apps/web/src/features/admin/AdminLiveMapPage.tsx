import { useEffect, useMemo, useState } from 'react'
import { divIcon } from 'leaflet'
import {
  MapContainer as LeafletMap,
  Marker,
  Popup,
  ZoomControl,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { AppliedFilters } from '../../components/ui/AppliedFilters'
import { OsmBaseLayer } from '../../components/map/OsmBaseLayer'
import { useReducedMotion } from '../auth/motion'

type DriverState = 'DELIVERING' | 'AVAILABLE' | 'PAUSED'

interface LiveDriver {
  id: string
  name: string
  phone: string
  vehicle: string
  position: [number, number]
  state: DriverState
  stateLabel: string
  currentOrder?: string
  lastUpdated: string
}

const drivers: LiveDriver[] = [
  {
    id: 'D01',
    name: 'Lê Văn Tài',
    phone: '0981 112 233',
    vehicle: '29V1-456.78',
    position: [21.0368, 105.7827],
    state: 'DELIVERING',
    stateLabel: 'Đang giao hàng',
    currentOrder: 'PF-89021',
    lastUpdated: '8 giây trước',
  },
  {
    id: 'D02',
    name: 'Nguyễn Văn Hùng',
    phone: '0981 234 567',
    vehicle: '29H1-123.45',
    position: [21.0274, 105.8342],
    state: 'DELIVERING',
    stateLabel: 'Đang giao hàng',
    currentOrder: 'PF-89024',
    lastUpdated: '12 giây trước',
  },
  {
    id: 'D03',
    name: 'Trần Văn Nam',
    phone: '0912 345 678',
    vehicle: '29X2-543.21',
    position: [21.0181, 105.8158],
    state: 'AVAILABLE',
    stateLabel: 'Sẵn sàng nhận đơn',
    lastUpdated: '18 giây trước',
  },
  {
    id: 'D04',
    name: 'Phạm Văn Nam',
    phone: '0933 445 566',
    vehicle: '29C-998.81',
    position: [20.9951, 105.8661],
    state: 'PAUSED',
    stateLabel: 'Tạm nghỉ',
    lastUpdated: '1 phút trước',
  },
  {
    id: 'D05',
    name: 'Đỗ Minh Quân',
    phone: '0977 221 118',
    vehicle: '30K1-882.19',
    position: [21.0543, 105.8214],
    state: 'AVAILABLE',
    stateLabel: 'Sẵn sàng nhận đơn',
    lastUpdated: '21 giây trước',
  },
]

const stateClass: Record<DriverState, string> = {
  DELIVERING: 'delivering',
  AVAILABLE: 'available',
  PAUSED: 'paused',
}

function createDriverIcon(driver: LiveDriver, selected: boolean) {
  return divIcon({
    className: 'driver-map-marker-shell',
    html: `<span class="driver-map-marker ${stateClass[driver.state]}${selected ? ' selected' : ''}"><i></i></span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -20],
  })
}

function FocusDriver({ driver, animate }: { driver?: LiveDriver; animate: boolean }) {
  const map = useMap()
  const reduced = useReducedMotion()

  useEffect(() => {
    if (driver) {
      const zoom = Math.max(map.getZoom(), 14)
      if (reduced || !animate) map.setView(driver.position, zoom, { animate: false })
      else map.flyTo(driver.position, zoom, { duration: 0.2 })
    }
  }, [driver, map, reduced, animate])

  return null
}

export function AdminLiveMapPage() {
  const [filter, setFilter] = useState<'ALL' | DriverState>('ALL')
  const [selectedId, setSelectedId] = useState(drivers[0].id)
  const [animateFocus, setAnimateFocus] = useState(false)
  const filterLabels = { ALL: 'Tất cả', DELIVERING: 'Đang giao', AVAILABLE: 'Sẵn sàng', PAUSED: 'Tạm nghỉ' }

  const visibleDrivers = useMemo(
    () => drivers.filter((driver) => filter === 'ALL' || driver.state === filter),
    [filter],
  )
  const selectedDriver =
    visibleDrivers.find((driver) => driver.id === selectedId) ?? visibleDrivers[0]
  function clearFilter() {
    setAnimateFocus(false); setFilter('ALL')
    document.querySelector<HTMLButtonElement>('.map-filter-tabs button')?.focus()
  }

  return (
    <div className="admin-page admin-map-page">
      <div className="page-header">
        <div>
          <span className="admin-page-kicker">GIÁM SÁT TRỰC TIẾP</span>
          <h1 className="page-title">Bản đồ tài xế</h1>
          <p className="page-subtitle">
            Theo dõi vị trí và trạng thái của đội ngũ đang hoạt động.
          </p>
        </div>
        <div className="map-live-indicator">
          Dữ liệu mẫu · chưa có GPS trực tiếp
        </div>
      </div>

      <div className="live-map-stats">
        <div><span className="map-stat-dot all" /><strong>{drivers.length}</strong><small>Đang hoạt động</small></div>
        <div><span className="map-stat-dot delivering" /><strong>{drivers.filter(driver => driver.state === 'DELIVERING').length}</strong><small>Đang giao hàng</small></div>
        <div><span className="map-stat-dot available" /><strong>{drivers.filter(driver => driver.state === 'AVAILABLE').length}</strong><small>Sẵn sàng</small></div>
        <div><span className="map-stat-dot paused" /><strong>{drivers.filter(driver => driver.state === 'PAUSED').length}</strong><small>Tạm nghỉ</small></div>
      </div>
      <AppliedFilters filters={filter === 'ALL' ? [] : [{ key: 'state', label: 'Trạng thái', value: filterLabels[filter], onRemove: clearFilter }]} onClear={clearFilter} />

      <div className="live-map-workspace">
        <aside className="driver-map-sidebar">
          <div className="driver-map-sidebar-header">
            <div>
              <h2>Danh sách tài xế</h2>
              <span role="status">{visibleDrivers.length} tài xế minh họa được hiển thị</span>
            </div>
          </div>

          <div className="map-filter-tabs" role="group" aria-label="Lọc trạng thái tài xế">
            {(Object.keys(filterLabels) as (keyof typeof filterLabels)[]).map(value => <button key={value} type="button"
              aria-pressed={filter === value} className={filter === value ? 'active' : ''}
              onClick={() => { setAnimateFocus(false); setFilter(value) }}>{filterLabels[value]}</button>)}
          </div>

          <div className="driver-map-list">
            {visibleDrivers.map((driver) => (
              <button
                type="button"
                key={driver.id}
                className={`driver-map-card ${selectedDriver?.id === driver.id ? 'selected' : ''}`}
                aria-pressed={selectedDriver?.id === driver.id}
                onClick={event => { setAnimateFocus(event.detail > 0); setSelectedId(driver.id) }}
              >
                <span className="driver-list-avatar">{driver.name.split(' ').slice(-1)[0][0]}</span>
                <span className="driver-list-info">
                  <strong>{driver.name}</strong>
                  <small>{driver.vehicle} · {driver.lastUpdated}</small>
                  <span className={`map-driver-status ${stateClass[driver.state]}`}>
                    <i /> {driver.stateLabel}
                  </span>
                </span>
                <span className="driver-list-arrow">›</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="live-map-canvas">
          <LeafletMap
            center={[21.0285, 105.8342]}
            zoom={13}
            minZoom={1}
            maxZoom={20}
            maxBounds={[[-85, -180], [85, 180]]}
            maxBoundsViscosity={1}
            zoomControl={false}
            scrollWheelZoom
            className="admin-leaflet-map"
          >
            <OsmBaseLayer />
            <ZoomControl position="bottomright" />
            <FocusDriver driver={selectedDriver} animate={animateFocus} />
            {visibleDrivers.map((driver) => (
              <Marker
                key={driver.id}
                alt={driver.name}
                title={driver.name}
                position={driver.position}
                icon={createDriverIcon(driver, selectedDriver?.id === driver.id)}
                eventHandlers={{ click: event => { setAnimateFocus(event.originalEvent instanceof MouseEvent && event.originalEvent.detail > 0); setSelectedId(driver.id) } }}
              >
                <Popup>
                  <div className="driver-map-popup">
                    <strong>{driver.name}</strong>
                    <span>{driver.stateLabel}</span>
                    <small>{driver.currentOrder ? `Đơn ${driver.currentOrder}` : 'Chưa có đơn hiện tại'}</small>
                    <small>{driver.phone} · {driver.vehicle}</small>
                    <em>Cập nhật {driver.lastUpdated}</em>
                  </div>
                </Popup>
              </Marker>
            ))}
          </LeafletMap>

          <div className="map-legend">
            <span><i className="delivering" />Đang giao</span>
            <span><i className="available" />Sẵn sàng</span>
            <span><i className="paused" />Tạm nghỉ</span>
          </div>
        </div>
      </div>
    </div>
  )
}
