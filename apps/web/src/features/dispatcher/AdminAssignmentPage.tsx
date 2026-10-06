import { useState } from 'react'
import { StatusBadge } from '../../components/ui/StatusBadge'

interface UnassignedShipment {
  id: string
  code: string
  pickup: string
  destination: string
  createdTime: string
}

interface AvailableDriver {
  id: string
  name: string
  phone: string
  vehicle: string
  currentActiveOrders: number
  status: 'ONLINE' | 'BUSY'
}

const mockUnassignedList: UnassignedShipment[] = [
  {
    id: 'u-1',
    code: 'PF-89025',
    pickup: '1 Đại Cồ Việt, Hai Bà Trưng',
    destination: '144 Xuân Thủy, Cầu Giấy',
    createdTime: '10 phút trước',
  },
  {
    id: 'u-2',
    code: 'PF-89028',
    pickup: 'Chợ hoa Quảng Bá, Tây Hồ',
    destination: 'Times City, Hai Bà Trưng',
    createdTime: '25 phút trước',
  },
  {
    id: 'u-3',
    code: 'PF-89029',
    pickup: 'Khu Đô Thị Ecopark, Văn Giang',
    destination: 'Hồ Gươm, Hoàn Kiếm',
    createdTime: '40 phút trước',
  },
]

const mockDrivers: AvailableDriver[] = [
  {
    id: 'd-1',
    name: 'Nguyễn Văn Hùng (Driver #2)',
    phone: '0981.234.567',
    vehicle: 'Xe máy Honda Wave - 29V1-12345',
    currentActiveOrders: 1,
    status: 'ONLINE',
  },
  {
    id: 'd-2',
    name: 'Trần Văn Nam (Driver #3)',
    phone: '0912.345.678',
    vehicle: 'Xe máy Yamaha Grande - 29X2-54321',
    currentActiveOrders: 0,
    status: 'ONLINE',
  },
  {
    id: 'd-3',
    name: 'Lê Văn Tài (Driver #4)',
    phone: '0977.889.900',
    vehicle: 'Xe tải nhẹ 500kg - 29C-99881',
    currentActiveOrders: 2,
    status: 'BUSY',
  },
]

export function AdminAssignmentPage() {
  const [selectedShipment, setSelectedShipment] = useState<string>('u-1')
  const [selectedDriver, setSelectedDriver] = useState<string>('d-2')
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null)

  const handleAssign = () => {
    const s = mockUnassignedList.find((x) => x.id === selectedShipment)
    const d = mockDrivers.find((x) => x.id === selectedDriver)
    if (s && d) {
      setAssignSuccess(
        `Đã phân công thành công đơn [${s.code}] cho tài xế [${d.name}]! (Mô phỏng hành động Tuần 3)`,
      )
      setTimeout(() => setAssignSuccess(null), 5000)
    }
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Phân công tài xế (Dispatcher)</h1>
          <p className="page-subtitle">
            Gán đơn hàng vừa tạo (CREATED) cho tài xế phù hợp để chuyển sang trạng thái ASSIGNED.
          </p>
        </div>
      </div>

      <div className="alert-box alert-info">
        <strong>Trọng tâm Tuần 3 của Tuấn:</strong> Đây là giao diện điều phối chính. Ở Tuần 3, màn hình này sẽ gọi API backend NestJS <code>POST /shipments/:id/assign</code> để cập nhật trạng thái đơn sang <code>ASSIGNED</code> và thông báo cho Driver.
      </div>

      {assignSuccess && (
        <div className="alert-box alert-success">
          {assignSuccess}
        </div>
      )}

      <div className="assignment-split-layout">
        <div className="assignment-col">
          <div className="col-header">
            <h3>1. Chọn đơn chờ gán ({mockUnassignedList.length})</h3>
            <span className="badge-count">Trạng thái: CREATED</span>
          </div>

          <div className="assignment-cards-list">
            {mockUnassignedList.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedShipment(item.id)}
                className={`assignment-select-card ${
                  selectedShipment === item.id ? 'selected' : ''
                }`}
              >
                <div className="card-top">
                  <strong>#{item.code}</strong>
                  <StatusBadge status="CREATED" />
                </div>
                <div className="card-route-info">
                  <p>📍 <strong>Lấy:</strong> {item.pickup}</p>
                  <p>🏁 <strong>Giao:</strong> {item.destination}</p>
                </div>
                <span className="time-badge">{item.createdTime}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="assignment-col">
          <div className="col-header">
            <h3>2. Chọn tài xế khả dụng</h3>
            <span className="badge-count">Đang online</span>
          </div>

          <div className="assignment-cards-list">
            {mockDrivers.map((driver) => (
              <div
                key={driver.id}
                onClick={() => setSelectedDriver(driver.id)}
                className={`assignment-select-card ${
                  selectedDriver === driver.id ? 'selected' : ''
                }`}
              >
                <div className="card-top">
                  <strong>{driver.name}</strong>
                  <span
                    className={`driver-status-pill ${
                      driver.status === 'ONLINE' ? 'online' : 'busy'
                    }`}
                  >
                    {driver.status === 'ONLINE' ? 'Sẵn sàng' : 'Đang bận'}
                  </span>
                </div>
                <div className="card-route-info">
                  <p>📞 {driver.phone}</p>
                  <p>🛵 {driver.vehicle}</p>
                  <p>📦 Đang chở: <strong>{driver.currentActiveOrders} đơn</strong></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="assignment-action-bar">
        <div className="summary-text">
          Đang chọn đơn: <strong>{mockUnassignedList.find((x) => x.id === selectedShipment)?.code}</strong> → Gán cho:{' '}
          <strong>{mockDrivers.find((x) => x.id === selectedDriver)?.name}</strong>
        </div>
        <button
          type="button"
          onClick={handleAssign}
          className="btn btn-warning btn-lg"
        >
          Xác nhận phân công tài xế
        </button>
      </div>
    </div>
  )
}
