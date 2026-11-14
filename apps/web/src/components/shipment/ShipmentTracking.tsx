import { lazy, Suspense } from 'react'
import type { ShipmentStatus } from '../../types/shipment'
import type { Coordinates } from '../../types/shipment-api'

const Panel = lazy(() => import('./ShipmentTrackingPanel'))
export interface ShipmentTrackingProps {
  id: string
  status: ShipmentStatus
  pickupLocation?: Coordinates
  dropoffLocation?: Coordinates
}
export function ShipmentTracking({ id, status, pickupLocation, dropoffLocation }: ShipmentTrackingProps) {
  if (status === 'DELIVERED' || status === 'DELIVERY_FAILED') return <section className="shipment-tracking" aria-label="Theo dõi vị trí đơn hàng">
    <h2>Đơn đã kết thúc</h2><p role="status">Đã dừng theo dõi và ẩn vị trí tài xế.</p>
  </section>
  return <Suspense fallback={<p role="status">Đang mở theo dõi vị trí…</p>}>
    <Panel id={id} pickupLocation={pickupLocation} dropoffLocation={dropoffLocation} />
  </Suspense>
}
