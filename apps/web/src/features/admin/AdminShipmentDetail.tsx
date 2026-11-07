import type { ShipmentDetail, ShipmentResponse } from '../../types/shipment-api'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { formatDateTime } from '../../utils'

export function AdminShipmentDetail({ shipment }: { shipment: ShipmentResponse | ShipmentDetail }) {
  return <section className="admin-shipment-detail" aria-label="Chi tiết đơn hiện hành">
    <div className="card-top"><h2>{shipment.trackingNumber}</h2><StatusBadge status={shipment.status} /></div>
    <dl className="admin-detail-grid">
      <div><dt>Điểm lấy</dt><dd>{shipment.pickupAddress}</dd></div>
      <div><dt>Điểm giao</dt><dd>{shipment.dropoffAddress}</dd></div>
      <div><dt>Người nhận</dt><dd>{shipment.recipientName}</dd></div>
      <div><dt>Tài xế hiện hành (ID)</dt><dd className="admin-api-id">{shipment.driverId ?? 'Chưa phân công'}</dd></div>
      <div><dt>Cập nhật lúc</dt><dd>{formatDateTime(shipment.updatedAt)}</dd></div>
    </dl>
    {'statusHistory' in shipment && <details className="ui-detail-disclosure"><summary>Lịch sử trạng thái ({shipment.statusHistory.length})</summary>
      {!shipment.statusHistory.length ? <p>Chưa có bản ghi lịch sử trong phản hồi.</p> : <ol>{shipment.statusHistory.map(event => <li key={event.id}>
        {event.action} · {formatDateTime(event.occurredAt)} · {event.actorRole}
        {event.newDriverId && <span className="admin-api-id"> · Tài xế: {event.newDriverId}</span>}
      </li>)}</ol>}
    </details>}
  </section>
}
