import type { ShipmentDetail, ShipmentResponse } from '../../types/shipment-api'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { formatDateTime } from '../../utils'
import { ShipmentLifecycleDetails } from '../../components/shipment/ShipmentLifecycleDetails'

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
    <ShipmentLifecycleDetails shipment={shipment} />
  </section>
}
