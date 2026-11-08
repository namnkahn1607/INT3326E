import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { getDrivers } from '../../api/endpoints/drivers'
import { usePolledResource } from '../../hooks/usePolledResource'
import { useAuth } from '../auth/useAuth'
import { gpsFreshness } from '../../components/shipment/gps-freshness'
import { useGpsClock } from '../../components/shipment/useGpsClock'
import type { TrackingPin } from '../../components/map/TrackingMap'
import { AppliedFilters } from '../../components/ui/AppliedFilters'
import { formatDateTime } from '../../utils'
import { AdminPageFeedback, AdminPager } from './AdminPageFeedback'
import '../../components/map/tracking-map.css'

const TrackingMap = lazy(() => import('../../components/map/TrackingMap'))
type Filter = 'all' | 'fresh' | 'stale' | 'missing'
const labels: Record<Filter, string> = { all: 'Tất cả', fresh: 'GPS mới', stale: 'GPS cũ', missing: 'Chưa có GPS' }

export function AdminLiveMapPage() {
  const { user } = useAuth(), account = user?.id ?? '', now = useGpsClock()
  const [paging, setPaging] = useState<{ account: string; cursors: (string | undefined)[] }>({ account, cursors: [undefined] })
  const cursors = paging.account === account ? paging.cursors : [undefined], cursor = cursors.at(-1)
  const load = useCallback((signal: AbortSignal) => getDrivers({ limit: 20, cursor }, signal), [cursor])
  const scope = JSON.stringify([account, cursor])
  const result = usePolledResource(load, scope)
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string>()
  const drivers = (result.data?.data ?? []).map(driver => ({ ...driver,
    freshness: gpsFreshness(driver.currentLocation, driver.locationClientTimestamp, driver.isLocationStale, Math.max(now, result.updatedAt ?? 0)) }))
  const visible = drivers.filter(driver => filter === 'all' || driver.freshness === filter)
  const selected = visible.some(driver => driver.id === selectedId) ? selectedId : undefined
  const pins: TrackingPin[] = visible.flatMap(driver => driver.currentLocation ? [{ id: driver.id,
    label: driver.name + ' · ' + labels[driver.freshness], position: driver.currentLocation,
    kind: driver.freshness === 'fresh' ? 'fresh' as const : 'stale' as const }] : [])
  const firstFilter = useRef<HTMLButtonElement>(null)
  const clearFilter = () => { setFilter('all'); firstFilter.current?.focus() }
  return <div className="admin-page admin-map-page">
    <div className="page-header"><div><h1 className="page-title">Bản đồ tài xế</h1>
      <p className="page-subtitle">Vị trí GPS trong trang tài xế đang hiển thị.</p></div>
      <button type="button" className="btn btn-outline" disabled={result.loading || result.refreshing} onClick={result.refresh}>Tải lại vị trí</button>
    </div>
    <div className="tracking-meta" role="status">
      <span>Trang {cursors.length} · {drivers.length} tài xế đã tải</span>
      {result.updatedAt && <span>Cập nhật {formatDateTime(new Date(result.updatedAt).toISOString())}</span>}
    </div>
    <AdminPageFeedback loading={result.loading} error={result.error} empty={!!result.data && drivers.length === 0}
      label="vị trí tài xế" onRetry={result.refresh} />
    {result.data && <>
      <div className="tracking-fleet-stats" aria-label="GPS trong trang đã tải">
        {(['fresh', 'stale', 'missing'] as const).map(state => <span key={state}><strong>{drivers.filter(driver => driver.freshness === state).length}</strong>{labels[state]}</span>)}
      </div>
      <AppliedFilters filters={filter === 'all' ? [] : [{ key: 'gps', label: 'GPS', value: labels[filter], onRemove: clearFilter }]} onClear={clearFilter} />
      <div className="live-map-workspace">
        <aside className="driver-map-sidebar">
          <div className="driver-map-sidebar-header"><h2>Tài xế trong trang</h2></div>
          <div className="map-filter-tabs" role="group" aria-label="Lọc dữ liệu GPS">
            {(Object.keys(labels) as Filter[]).map(value => <button key={value} ref={value === 'all' ? firstFilter : undefined} type="button" aria-pressed={filter === value}
              className={filter === value ? 'active' : ''} onClick={() => { setFilter(value); setSelectedId(undefined) }}>{labels[value]}</button>)}
          </div>
          <div className="driver-map-list">
            {visible.map(driver => <button type="button" key={driver.id} className={'driver-map-card' + (selected === driver.id ? ' selected' : '')}
              aria-pressed={selected === driver.id} onClick={() => setSelectedId(driver.id)}>
              <span className="driver-list-avatar" aria-hidden="true">{driver.name.slice(0, 1)}</span>
              <span className="driver-list-info"><strong>{driver.name}</strong>
                <small>{driver.activeShipmentCount} đơn đang xử lý</small>
                <span className="tracking-gps-state" data-gps={driver.freshness}>{labels[driver.freshness]}</span>
                {driver.locationClientTimestamp && <time className="tracking-driver-meta" dateTime={driver.locationClientTimestamp}>{formatDateTime(driver.locationClientTimestamp)}</time>}
                {driver.currentLocation && <small>{driver.currentLocation.lat}, {driver.currentLocation.lng}</small>}
              </span>
            </button>)}
            {visible.length === 0 && <p className="tracking-fleet-empty">Không có tài xế trong bộ lọc này.</p>}
          </div>
        </aside>
        <div className="live-map-canvas">
          {pins.length > 0 ? <Suspense fallback={<p role="status">Đang mở bản đồ…</p>}>
            <TrackingMap pins={pins} scope={scope} selectedId={selected} onSelect={setSelectedId} />
          </Suspense> : <p className="tracking-message">Chưa có vị trí GPS trong bộ lọc này.</p>}
        </div>
      </div>
    </>}
    <AdminPager number={cursors.length} hasMore={result.data?.pagination.hasMore ?? false} disabled={result.loading || result.refreshing}
      label="bản đồ tài xế" onPrevious={() => setPaging({ account, cursors: cursors.slice(0, -1) })}
      onNext={() => { if (result.data?.pagination.nextCursor) setPaging({ account, cursors: [...cursors, result.data.pagination.nextCursor] }) }} />
  </div>
}
