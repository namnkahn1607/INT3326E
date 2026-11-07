import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getShipmentById } from '../../api/endpoints/shipments'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataSkeleton } from '../../components/ui/DataSkeleton'
import { ShipmentLifecycleDetails } from '../../components/shipment/ShipmentLifecycleDetails'
import { ShipmentTracking } from '../../components/shipment/ShipmentTracking'
import { formatDateTime, formatNumber } from '../../utils'
import type { ShipmentDetail } from '../../types/shipment-api'
import { useAuth } from '../auth/useAuth'
import { shipmentErrorMessage } from './shipment-form'
import './customer-api.css'

export function CustomerShipmentDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [reload, setReload] = useState(0)
  return <div className="page-container customer-api-page">
    <div className="page-header"><div><h1 className="page-title">Chi tiết đơn hàng</h1>
      <p className="page-subtitle">Thông tin hiện hành từ hệ thống giao nhận.</p></div>
      <Link className="btn btn-secondary" to="/customer/shipments">Về danh sách đơn</Link></div>
    <DetailData key={user?.id + ':' + id + ':' + reload} id={id} onRetry={() => setReload(value => value + 1)} />
  </div>
}

function DetailData({ id, onRetry }: { id: string; onRetry: () => void }) {
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    getShipmentById(id, controller.signal).then(value => {
      if (!controller.signal.aborted) setShipment(value)
    }).catch(cause => { if (!controller.signal.aborted) setError(shipmentErrorMessage(cause)) })
    return () => controller.abort()
  }, [id])
  if (error) return <div className="customer-error" role="alert"><h2>Chưa tải được đơn hàng</h2><p>{error}</p>
    <button type="button" className="btn btn-outline" onClick={onRetry}>Thử lại</button></div>
  if (!shipment) return <DataSkeleton label="Đang tải chi tiết đơn…" detail />
  const rows = [
    ['Địa chỉ lấy', shipment.pickupAddress], ['Địa chỉ giao', shipment.dropoffAddress],
    ['Tọa độ điểm lấy', `${shipment.pickupLocation.lat}, ${shipment.pickupLocation.lng}`],
    ['Tọa độ điểm giao', `${shipment.dropoffLocation.lat}, ${shipment.dropoffLocation.lng}`],
    ['Người nhận', shipment.recipientName], ['Điện thoại người nhận', shipment.recipientPhone],
    ['Mô tả bưu kiện', shipment.packageDescription || '—'], ['Khối lượng', shipment.packageWeightKg === null ? '—' : formatNumber(shipment.packageWeightKg, 3) + ' kg'],
    ['Ghi chú', shipment.notes ?? 'Không có'],
    ['Hạn giao dự kiến', formatDateTime(shipment.expectedDeliveryAt)],
    ['Thời điểm tạo', formatDateTime(shipment.createdAt)],
    ['Cập nhật lần cuối', formatDateTime(shipment.updatedAt)],
  ]
  return <section className="customer-result">
    <StatusBadge status={shipment.status} /><h2 className="customer-tracking-number">{shipment.trackingNumber}</h2>
    <dl className="customer-detail-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <ShipmentLifecycleDetails shipment={shipment} />
    <ShipmentTracking key={shipment.driverId + ':' + shipment.status} id={shipment.id} status={shipment.status} />
    <p className="customer-helper">“—” là thông tin chưa có. Hạn giao dự kiến không phải ETA hoặc cam kết giao đúng giờ.</p>
    <div className="form-actions"><button type="button" className="btn btn-outline" onClick={onRetry}>Tải lại thông tin</button>
      <Link className="btn btn-primary" to="/customer/create">Tạo đơn mới</Link></div>
  </section>
}
