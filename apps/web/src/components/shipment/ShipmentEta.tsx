import type { TrackingData } from '../../api/endpoints/tracking'
import { formatDateTime, formatNumber } from '../../utils'
import type { gpsFreshness } from './gps-freshness'

const unavailable = {
  NOT_PICKED_UP: 'Chưa lấy hàng, chưa có ước tính thời gian tới.',
  LOCATION_MISSING: 'Chưa có GPS để ước tính thời gian tới.',
  LOCATION_STALE: 'GPS đã cũ, chưa thể ước tính thời gian tới.',
  CONFIG_INVALID: 'Tạm thời chưa có ước tính thời gian tới.',
}

export function ShipmentEta({ data, freshness }: { data: TrackingData; freshness: ReturnType<typeof gpsFreshness> }) {
  if (data.status === 'DELIVERED' || data.status === 'DELIVERY_FAILED') return null
  const reason = data.status === 'PICKED_UP' && freshness !== 'fresh'
    ? freshness === 'stale' ? 'LOCATION_STALE' : 'LOCATION_MISSING'
    : data.etaUnavailableReason ?? 'CONFIG_INVALID'
  const eta = data.status === 'PICKED_UP' && freshness === 'fresh' ? data.eta : null
  return <section className="tracking-eta" aria-label="Ước tính tới điểm giao">
    <h3>Ước tính tới điểm giao</h3>
    {eta ? <>
      <dl>
        <div><dt>Thời gian còn lại</dt><dd className="eta-minutes">{formatNumber(Math.ceil(eta.estimatedSeconds / 60), 0)} phút</dd></div>
        <div><dt>Khoảng cách</dt><dd className="eta-distance">{eta.distanceMeters < 1000
          ? formatNumber(eta.distanceMeters, 0) + ' m' : formatNumber(eta.distanceMeters / 1000, 1) + ' km'}</dd></div>
        <div className="eta-arrival"><dt>Dự kiến tới</dt><dd><time dateTime={eta.estimatedArrivalAt}>{formatDateTime(eta.estimatedArrivalAt)}</time></dd></div>
      </dl>
      <p className="tracking-eta-note">Ước lượng đường chim bay, không phải hạn giao.</p>
    </> : <p className="tracking-eta-unavailable" role="status">{unavailable[reason]}</p>}
  </section>
}
