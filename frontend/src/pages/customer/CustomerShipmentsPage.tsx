import { useState } from 'react'
import { Link } from 'react-router'
import { StatusBadge } from '../../components/common/StatusBadge'
import type { ShipmentStatus } from '../../types/shipment'

interface MockShipment {
  id: string
  trackingCode: string
  pickup: string
  destination: string
  status: ShipmentStatus
  driverName?: string
  driverPhone?: string
  eta?: string
  createdAt: string
}

const mockShipments: MockShipment[] = [
  {
    id: 's-101',
    trackingCode: 'PF-2026-001',
    pickup: '144 Xuân Thủy, Cầu Giấy, Hà Nội',
    destination: '8 Tôn Thất Thuyết, Nam Từ Liêm, Hà Nội',
    status: 'PICKED_UP',
    driverName: 'Lê Văn Tài (Driver #4)',
    driverPhone: '0981112233',
    eta: '~18 phút (Haversine)',
    createdAt: '05/10/2026 10:15',
  },
  {
    id: 's-102',
    trackingCode: 'PF-2026-002',
    pickup: 'Khu công nghệ cao Hòa Lạc',
    destination: 'Đại học Quốc Gia Hà Nội, Cầu Giấy',
    status: 'ASSIGNED',
    driverName: 'Trần Văn Nam',
    driverPhone: '0912223344',
    eta: 'Đang đến điểm lấy',
    createdAt: '05/10/2026 11:00',
  },
  {
    id: 's-103',
    trackingCode: 'PF-2026-003',
    pickup: 'Số 1 Đại Cồ Việt, Hai Bà Trưng',
    destination: '144 Xuân Thủy, Cầu Giấy',
    status: 'CREATED',
    eta: 'Chờ điều phối gán xe',
    createdAt: '05/10/2026 11:30',
  },
]

export function CustomerShipmentsPage() {
  const [filter, setFilter] = useState<string>('ALL')

  const filteredList =
    filter === 'ALL'
      ? mockShipments
      : mockShipments.filter((s) => s.status === filter)

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Đơn hàng của tôi</h1>
          <p className="page-subtitle">
            Danh sách các kiện hàng đang được luân chuyển hoặc xử lý trong hệ thống.
          </p>
        </div>
        <div>
          <Link to="/customer/create" className="btn btn-primary">
            + Tạo đơn mới
          </Link>
        </div>
      </div>

      <div className="filter-toolbar">
        <span className="filter-label">Lọc trạng thái:</span>
        <button
          className={`filter-chip ${filter === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilter('ALL')}
        >
          Tất cả ({mockShipments.length})
        </button>
        <button
          className={`filter-chip ${filter === 'CREATED' ? 'active' : ''}`}
          onClick={() => setFilter('CREATED')}
        >
          Chờ gán xe
        </button>
        <button
          className={`filter-chip ${filter === 'ASSIGNED' ? 'active' : ''}`}
          onClick={() => setFilter('ASSIGNED')}
        >
          Đã gán tài xế
        </button>
        <button
          className={`filter-chip ${filter === 'PICKED_UP' ? 'active' : ''}`}
          onClick={() => setFilter('PICKED_UP')}
        >
          Đang giao
        </button>
      </div>

      <div className="shipment-cards-grid">
        {filteredList.map((item) => (
          <div key={item.id} className="shipment-card">
            <div className="shipment-card-header">
              <span className="tracking-code">{item.trackingCode}</span>
              <StatusBadge status={item.status} />
            </div>

            <div className="shipment-routes">
              <div className="route-point">
                <span className="route-dot pickup-dot" />
                <div>
                  <small>Điểm lấy hàng:</small>
                  <p>{item.pickup}</p>
                </div>
              </div>
              <div className="route-divider" />
              <div className="route-point">
                <span className="route-dot dest-dot" />
                <div>
                  <small>Điểm giao hàng:</small>
                  <p>{item.destination}</p>
                </div>
              </div>
            </div>

            <div className="shipment-meta-box">
              <div className="meta-item">
                <span>Tài xế phụ trách:</span>
                <strong>{item.driverName || 'Chưa phân công'}</strong>
              </div>
              <div className="meta-item">
                <span>Dự kiến (ETA):</span>
                <strong className="eta-text">{item.eta || 'Chưa có dữ liệu'}</strong>
              </div>
            </div>

            <div className="shipment-card-footer">
              <span className="created-time">Tạo lúc: {item.createdAt}</span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() =>
                  alert(
                    `Tính năng Leaflet Tracking Map và Polling vị trí (5-10s) sẽ được tích hợp ở Tuần 5 cho đơn ${item.trackingCode}!`,
                  )
                }
              >
                Bản đồ theo dõi (Tuần 5)
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="data-note">
        * Dữ liệu trên nhằm mục đích hiển thị khung giao diện Tuần 1. Sẽ kết nối API NestJS ở Tuần 2 và Leaflet Map ở Tuần 5.
      </p>
    </div>
  )
}
