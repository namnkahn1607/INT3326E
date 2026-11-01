import { lazy, Suspense } from 'react'
import type { ShipmentStatus } from '../../types/shipment'

const Panel = lazy(() => import('./ShipmentTrackingPanel'))
export function ShipmentTracking({ id, status }: { id: string; status: ShipmentStatus }) {
  if (status === 'DELIVERED' || status === 'DELIVERY_FAILED') return <section className="shipment-tracking" aria-label="Theo dõi vị trí đơn hàng">
    <h2>Đơn đã kết thúc</h2><p role="status">Đã dừng theo dõi và ẩn vị trí tài xế.</p>
  </section>
  return <Suspense fallback={<p role="status">Đang mở theo dõi vị trí…</p>}><Panel id={id} /></Suspense>
}
