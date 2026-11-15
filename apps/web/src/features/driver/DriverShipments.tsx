import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getShipments } from '../../api/endpoints/shipments'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { SHIPMENT_STATUS_MAP, type ShipmentStatus } from '../../types/shipment'
import type { ShipmentPage } from '../../types/shipment-api'
import { driverShipmentError } from './driver-shipment-error'

export function DriverShipments() {
  const [status, setStatus] = useState<ShipmentStatus | ''>('')
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const [reload, setReload] = useState(0)
  const cursor = cursors.at(-1)
  return <section className="driver-panel" aria-labelledby="driver-shipments-title">
    <h2 id="driver-shipments-title">Đơn được phân công</h2>
    <div className="driver-shipment-controls">
      <label htmlFor="driver-shipment-status">Trạng thái đơn</label>
      <select id="driver-shipment-status" value={status} onChange={event => {
        setStatus(event.target.value as ShipmentStatus | ''); setCursors([undefined])
      }}>
        <option value="">Tất cả trạng thái</option>
        {(['ASSIGNED', 'PICKED_UP', 'DELIVERED', 'DELIVERY_FAILED'] as const).map(value =>
          <option key={value} value={value}>{SHIPMENT_STATUS_MAP[value].label}</option>)}
      </select>
      <button type="button" className="btn btn-outline" onClick={() => setReload(value => value + 1)}>Làm mới danh sách</button>
    </div>
    <DriverShipmentList key={status + ':' + cursor + ':' + reload} status={status || undefined} cursor={cursor}
      pageNumber={cursors.length} onPrevious={() => setCursors(values => values.slice(0, -1))}
      onNext={next => setCursors(values => [...values, next])} onRetry={() => setReload(value => value + 1)} />
  </section>
}

function DriverShipmentList({ status, cursor, pageNumber, onPrevious, onNext, onRetry }: {
  status?: ShipmentStatus; cursor?: string; pageNumber: number
  onPrevious: () => void; onNext: (cursor: string) => void; onRetry: () => void
}) {
  const [page, setPage] = useState<ShipmentPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    getShipments({ status, cursor, limit: 20 }, controller.signal).then(value => {
      if (!controller.signal.aborted) setPage(value)
    }).catch(cause => { if (!controller.signal.aborted) setError(driverShipmentError(cause)) })
    return () => controller.abort()
  }, [status, cursor])

  if (error) return <div role="alert"><p>{error}</p>
    <button type="button" className="btn btn-outline" onClick={onRetry}>Thử tải lại danh sách</button></div>
  if (!page) return <p role="status">Đang tải đơn được phân công…</p>
  return <>
    <p role="status">{page.data.length} đơn trên trang {pageNumber}.</p>
    {page.data.length === 0 ? <p>{status ? 'Không có đơn phù hợp trạng thái đã chọn.' : 'Chưa có đơn trên trang này.'}</p> :
      <ul className="driver-shipment-list">{page.data.map(item => <li key={item.id}>
        <h3 translate="no">{item.trackingNumber}</h3><StatusBadge status={item.status} />
        <p><strong>Lấy:</strong> {item.pickupAddress}</p><p><strong>Giao:</strong> {item.dropoffAddress}</p>
        <p><strong>Người nhận:</strong> {item.recipientName}</p>
        <Link className="btn btn-outline" to={'/driver/shipments/' + item.id}
          aria-label={'Xem đơn ' + item.trackingNumber}>Xem đơn</Link>
      </li>)}</ul>}
    <nav className="driver-shipment-actions" aria-label="Phân trang đơn tài xế">
      <button type="button" className="btn btn-outline" disabled={pageNumber === 1} onClick={onPrevious}>Trang trước</button>
      <span>Trang {pageNumber}</span>
      <button type="button" className="btn btn-outline" disabled={!page.pagination.hasMore}
        onClick={() => { if (page.pagination.nextCursor) onNext(page.pagination.nextCursor) }}>Trang tiếp</button>
    </nav>
  </>
}
