import type { ShipmentDetail, ShipmentResponse, StatusEventResponse } from '../../types/shipment-api'
import { SHIPMENT_STATUS_MAP } from '../../types/shipment'
import { formatDateTime } from '../../utils'
import './shipment-lifecycle.css'

const roles = { CUSTOMER: 'Khách hàng', DRIVER: 'Tài xế', ADMIN: 'Quản trị viên' }
const actions: Record<StatusEventResponse['action'], string> = {
  CREATED: 'Đã tạo đơn', ASSIGNED: 'Đã phân công tài xế', REASSIGNED: 'Đã gán lại tài xế',
  PICKED_UP: 'Đã lấy hàng', DELIVERED: 'Giao thành công', DELIVERY_FAILED: 'Giao thất bại',
}

export function ShipmentLifecycleDetails({ shipment }: { shipment: ShipmentResponse | ShipmentDetail }) {
  return <section className="shipment-lifecycle" aria-label="Diễn biến đơn hàng">
    {shipment.status === 'DELIVERY_FAILED' && <dl className="shipment-outcome">
      <div><dt>Lý do giao thất bại</dt><dd>{shipment.failureReason}</dd></div>
      <div><dt>Người ghi nhận</dt><dd>{shipment.failedByRole && roles[shipment.failedByRole]} · {shipment.failedByUserId}</dd></div>
    </dl>}
    {shipment.status === 'DELIVERED' && shipment.proofOfDeliveryNotes &&
      <p className="shipment-proof"><strong>Ghi chú giao hàng:</strong> {shipment.proofOfDeliveryNotes}</p>}
    {'statusHistory' in shipment && <>
      <h3>Lịch sử trạng thái</h3>
      {shipment.statusHistory.length === 0 ? <p className="shipment-history-empty">Chưa có lịch sử trong phản hồi.</p> :
        <ol className="shipment-history">{shipment.statusHistory.map(event => <li key={event.id}>
          <div className="shipment-event-heading"><strong>{actions[event.action]}</strong>
            <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time></div>
          <p>{event.fromStatus && <>{SHIPMENT_STATUS_MAP[event.fromStatus].label} → </>}{SHIPMENT_STATUS_MAP[event.toStatus].label}</p>
          <p>Người thực hiện: {roles[event.actorRole]} · <span translate="no">{event.actorUserId}</span></p>
          {event.newDriverId && <p>Tài xế: {event.previousDriverId && event.previousDriverId !== event.newDriverId &&
            <><span translate="no">{event.previousDriverId}</span> → </>}<span translate="no">{event.newDriverId}</span></p>}
          {event.reason && <p>Lý do: {event.reason}</p>}
        </li>)}</ol>}
    </>}
  </section>
}
