export type ShipmentStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'

export interface Shipment {
  id: string
  trackingCode: string
  senderName: string
  senderAddress: string
  recipientName: string
  recipientAddress: string
  recipientPhone: string
  packageDescription: string
  status: ShipmentStatus
  assignedDriverId?: string
  assignedDriverName?: string
  createdAt: string
  updatedAt: string
}

export const SHIPMENT_STATUS_MAP: Record<
  ShipmentStatus,
  { label: string; color: string; bg: string }
> = {
  CREATED: {
    label: 'Chờ gán tài xế',
    color: '#1d4ed8',
    bg: '#eff6ff',
  },
  ASSIGNED: {
    label: 'Đã gán tài xế',
    color: '#b45309',
    bg: '#fef3c7',
  },
  PICKED_UP: {
    label: 'Đang giao hàng',
    color: '#4338ca',
    bg: '#e0e7ff',
  },
  DELIVERED: {
    label: 'Giao thành công',
    color: '#15803d',
    bg: '#dcfce7',
  },
  DELIVERY_FAILED: {
    label: 'Giao thất bại',
    color: '#b91c1c',
    bg: '#fee2e2',
  },
}
