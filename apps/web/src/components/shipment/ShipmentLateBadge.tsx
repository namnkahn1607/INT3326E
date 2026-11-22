import './shipment-lifecycle.css'

export function ShipmentLateBadge({ isLate }: { isLate: boolean | null }) {
  return isLate === true ? <span className="shipment-late-badge" role="status">Giao trễ</span> : null
}
