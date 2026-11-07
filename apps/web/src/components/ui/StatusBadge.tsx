import type { ShipmentStatus } from '../../types/shipment'
import { SHIPMENT_STATUS_MAP } from '../../types/shipment'

interface StatusBadgeProps {
  status: ShipmentStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = SHIPMENT_STATUS_MAP[status] || {
    label: status,
    color: '#475569',
    bg: '#f1f5f9',
  }

  return (
    <span
      className="status-badge"
      data-status={status}
      style={{
        color: `var(--status-color, ${config.color})`,
        backgroundColor: `var(--status-bg, ${config.bg})`,
        border: `1px solid var(--status-line, ${config.color}22)`,
      }}
    >
      <i aria-hidden="true" />
      {config.label}
    </span>
  )
}
