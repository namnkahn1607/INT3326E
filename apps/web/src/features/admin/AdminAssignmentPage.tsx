import { useState } from 'react'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Icon } from '../../components/ui/Icon'

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
    name: 'Nguyễn Văn Hùng',
    phone: '0981.234.567',
    vehicle: 'Xe máy Honda Wave - 29V1-12345',
    currentActiveOrders: 1,
    status: 'ONLINE',
  },
  {
    id: 'd-2',
    name: 'Trần Văn Nam',
    phone: '0912.345.678',
    vehicle: 'Xe máy Yamaha Grande - 29X2-54321',
    currentActiveOrders: 0,
    status: 'ONLINE',
  },
  {
    id: 'd-3',
    name: 'Lê Văn Tài',
    phone: '0977.889.900',
    vehicle: 'Xe tải nhẹ 500kg - 29C-99881',
    currentActiveOrders: 2,
    status: 'BUSY',
  },
]

export function AdminAssignmentPage() {
  const [selectedShipment, setSelectedShipment] = useState<string>('')
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const reason = !selectedShipment ? 'Chọn một đơn và một tài xế để xem cặp phân công.'
    : !selectedDriver ? 'Chọn tài xế để tiếp tục.' : 'Chưa kết nối API phân công. Lựa chọn chỉ để xem trước, chưa được lưu lên máy chủ.'

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <span className="admin-page-kicker">ĐIỀU PHỐI</span>
          <h1 className="page-title">Phân công tài xế</h1>
          <p className="page-subtitle">
            Ghép đơn hàng đang chờ với tài xế phù hợp và sẵn sàng.
          </p>
        </div>
      </div>

      <div className="assignment-split-layout">
        <div className="assignment-col">
          <div className="col-header">
            <h2>1. Chọn đơn chờ gán</h2>
            <span className="badge-count">{mockUnassignedList.length} đơn</span>
          </div>

          <div className="assignment-cards-list">
            {mockUnassignedList.map((item) => (
              <button
                type="button"
                aria-pressed={selectedShipment === item.id}
                key={item.id}
                onClick={() => setSelectedShipment(item.id)}
                className={`assignment-select-card ui-selection-card ${
                  selectedShipment === item.id ? 'selected' : ''
                }`}
              >
                <div className="card-top">
                  <strong>#{item.code}</strong>
                  <StatusBadge status="CREATED" />
                </div>
                <div className="card-route-info">
                  <p><Icon name="pin" /><strong>Lấy:</strong> {item.pickup}</p>
                  <p><Icon name="pin" /><strong>Giao:</strong> {item.destination}</p>
                </div>
                <span className="time-badge">{item.createdTime}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="assignment-col">
          <div className="col-header">
            <h2>2. Chọn tài xế</h2>
            <span className="badge-count">Đang online</span>
          </div>

          <div className="assignment-cards-list">
            {mockDrivers.map((driver) => (
              <button
                type="button"
                aria-pressed={selectedDriver === driver.id}
                key={driver.id}
                onClick={() => setSelectedDriver(driver.id)}
                className={`assignment-select-card ui-selection-card ${
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
                  <p>Điện thoại: {driver.phone}</p>
                  <p><Icon name="truck" />{driver.vehicle}</p>
                  <p><Icon name="box" />Đang chở: <strong>{driver.currentActiveOrders} đơn</strong></p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="assignment-action-bar">
        <div className="summary-text" role="status">
          Đang chọn đơn: <strong>{mockUnassignedList.find((x) => x.id === selectedShipment)?.code ?? 'Chưa chọn'}</strong> → Tài xế:{' '}
          <strong>{mockDrivers.find((x) => x.id === selectedDriver)?.name ?? 'Chưa chọn'}</strong>
          <p className="ui-disabled-reason" id="assignment-disabled">{reason}</p>
        </div>
        <button
          type="button"
          disabled
          aria-describedby="assignment-disabled"
          className="btn btn-primary btn-lg"
        >
          Xác nhận phân công tài xế
        </button>
      </div>
    </div>
  )
}
