import { lazy, Suspense } from 'react'
import { ApiError } from '../../api/client'
import { usePollingTracking } from '../../hooks/usePollingTracking'
import { useAuth } from '../../features/auth/useAuth'
import { StatusBadge } from '../ui/StatusBadge'
import { formatDateTime } from '../../utils'
import type { TrackingPin } from '../map/TrackingMap'
import { gpsFreshness } from './gps-freshness'
import { useGpsClock } from './useGpsClock'
import '../map/tracking-map.css'

const TrackingMap = lazy(() => import('../map/TrackingMap'))
function trackingReadError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn.'
    if (error.status === 403) return 'Bạn không có quyền xem vị trí của đơn này.'
    if (error.status === 404) return 'Không tìm thấy đơn hoặc API tracking chưa được triển khai.'
    if (error.code === 'INVALID_RESPONSE') return 'Phản hồi vị trí chưa đúng hợp đồng dữ liệu.'
  }
  return 'Chưa tải được vị trí. Dữ liệu GPS trước đó đã được ẩn.'
}

export default function ShipmentTrackingPanel({ id }: { id: string }) {
  const { user } = useAuth(), now = useGpsClock()
  const tracking = usePollingTracking(id, undefined, 5000, user?.id)
  const data = tracking.data
  const terminal = data?.status === 'DELIVERED' || data?.status === 'DELIVERY_FAILED'
  const freshness = gpsFreshness(data?.currentDriverLocation ?? null, data?.locationClientTimestamp ?? null,
    data?.isLocationStale ?? null, Math.max(now, tracking.updatedAt ?? 0))
  const pins: TrackingPin[] = data ? [
    { id: 'pickup', label: 'Điểm lấy hàng', kind: 'pickup', position: data.pickupLocation },
    { id: 'dropoff', label: 'Điểm giao hàng', kind: 'dropoff', position: data.dropoffLocation },
    ...(data.currentDriverLocation && !terminal ? [{ id: data.driverId!, label: freshness === 'fresh' ? 'Vị trí tài xế' : 'Vị trí tài xế ghi nhận gần nhất',
      kind: freshness === 'fresh' ? 'fresh' as const : 'stale' as const, position: data.currentDriverLocation }] : []),
  ] : []
  return <section className="shipment-tracking" aria-label="Theo dõi vị trí đơn hàng">
    <div className="tracking-toolbar"><h2>Theo dõi giao hàng</h2>
      <button type="button" className="btn btn-outline" disabled={tracking.loading || tracking.refreshing} onClick={tracking.refresh}>Tải lại vị trí</button>
    </div>
    {tracking.loading && <p className="tracking-message" role="status">Đang tải vị trí…</p>}
    {!!tracking.error && <p className="tracking-message" role="alert">{trackingReadError(tracking.error)}</p>}
    {data && <>
      <StatusBadge status={data.status} />
      <div className="tracking-meta" role="status">
        <span className="tracking-gps-state" data-gps={terminal ? 'hidden' : freshness}>{terminal ? 'Đã kết thúc · Ẩn vị trí tài xế'
          : data.status === 'CREATED' ? 'Chưa phân công tài xế' : freshness === 'missing' ? 'Chưa có GPS'
            : freshness === 'stale' ? 'GPS cũ · Vị trí ghi nhận gần nhất' : 'GPS mới'}</span>
        {data.locationClientTimestamp && <span>Thời điểm mẫu: <time dateTime={data.locationClientTimestamp}>{formatDateTime(data.locationClientTimestamp)}</time></span>}
        {tracking.updatedAt && <span>Đọc lúc {formatDateTime(new Date(tracking.updatedAt).toISOString())}</span>}
      </div>
      <Suspense fallback={<p role="status">Đang mở bản đồ…</p>}>
        <TrackingMap pins={pins} scope={id + ':' + data.driverId} />
      </Suspense>
      <dl className="tracking-points">{pins.map(pin => <div key={pin.id}><dt>{pin.label}</dt><dd>{pin.position.lat}, {pin.position.lng}</dd></div>)}</dl>
    </>}
  </section>
}
