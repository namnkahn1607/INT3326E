import { useState } from 'react'
import { Link } from 'react-router'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { ShipmentStatus } from '../../types/shipment'

interface AdminShipmentItem {
  id: string
  code: string
  sender: string
  recipient: string
  pickupAddress: string
  dropoffAddress: string
  status: ShipmentStatus
  driver: string
  time: string
}

const mockAdminShipments: AdminShipmentItem[] = [
  {
    id: '1',
    code: 'PF-89025',
    sender: 'ĐH Bách Khoa',
    recipient: 'ĐH Quốc Gia Hà Nội',
    pickupAddress: '1 Đại Cồ Việt, Hai Bà Trưng',
    dropoffAddress: '144 Xuân Thủy, Cầu Giấy',
    status: 'CREATED',
    driver: 'Chưa phân công',
    time: '11:40 05/10/2026',
  },
  {
    id: '2',
    code: 'PF-89024',
    sender: 'Văn phòng Viettel',
    recipient: 'Chi nhánh Hà Đông',
    pickupAddress: 'Duy Tân, Cầu Giấy',
    dropoffAddress: 'Trần Phú, Hà Đông',
    status: 'PICKED_UP',
    driver: 'Nguyễn Văn Hùng',
    time: '10:30 05/10/2026',
  },
  {
    id: '3',
    code: 'PF-89023',
    sender: 'Kho vận Bắc Từ Liêm',
    recipient: 'Cửa hàng Hoàng Mai',
    pickupAddress: 'Phạm Văn Đồng, Bắc Từ Liêm',
    dropoffAddress: 'Giải Phóng, Hoàng Mai',
    status: 'ASSIGNED',
    driver: 'Trần Văn Nam',
    time: '09:50 05/10/2026',
  },
  {
    id: '4',
    code: 'PF-89022',
    sender: 'Công ty Alpha',
    recipient: 'Công ty Beta',
    pickupAddress: 'Liễu Giai, Ba Đình',
    dropoffAddress: 'Hoàng Đạo Thúy, Cầu Giấy',
    status: 'DELIVERED',
    driver: 'Lê Văn Tài',
    time: '08:15 05/10/2026',
  },
  {
    id: '5',
    code: 'PF-89020',
    sender: 'Cửa hàng Gốm',
    recipient: 'Nguyễn Văn Tuấn',
    pickupAddress: 'Bát Tràng, Gia Lâm',
    dropoffAddress: 'Hoàn Kiếm, Hà Nội',
    status: 'DELIVERY_FAILED',
    driver: 'Phạm Văn Nam',
    time: '07:30 05/10/2026',
  },
]

export function AdminShipmentsPage() {
  const [activeTab, setActiveTab] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = mockAdminShipments.filter((item) => {
    const matchStatus = activeTab === 'ALL' || item.status === activeTab
    const matchSearch =
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.recipient.toLowerCase().includes(searchTerm.toLowerCase())
    return matchStatus && matchSearch
  })

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <span className="admin-page-kicker">VẬN HÀNH</span>
          <h1 className="page-title">Đơn hàng</h1>
          <p className="page-subtitle">
            Tìm kiếm, lọc và theo dõi toàn bộ đơn giao nhận.
          </p>
        </div>
        <div>
          <Link to="/admin/assignment" className="btn btn-primary">
            + Phân công tài xế
          </Link>
        </div>
      </div>

      <div className="admin-controls-card">
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder="Tìm theo mã đơn (PF-...), người gửi, người nhận..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="admin-search-input"
          />
        </div>

        <div className="filter-toolbar">
          <button
            className={`filter-chip ${activeTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveTab('ALL')}
          >
            Tất cả ({mockAdminShipments.length})
          </button>
          <button
            className={`filter-chip ${activeTab === 'CREATED' ? 'active' : ''}`}
            onClick={() => setActiveTab('CREATED')}
          >
            Chờ phân công
          </button>
          <button
            className={`filter-chip ${activeTab === 'ASSIGNED' ? 'active' : ''}`}
            onClick={() => setActiveTab('ASSIGNED')}
          >
            Đã phân công
          </button>
          <button
            className={`filter-chip ${activeTab === 'PICKED_UP' ? 'active' : ''}`}
            onClick={() => setActiveTab('PICKED_UP')}
          >
            Đang giao
          </button>
          <button
            className={`filter-chip ${activeTab === 'DELIVERED' ? 'active' : ''}`}
            onClick={() => setActiveTab('DELIVERED')}
          >
            Thành công
          </button>
          <button
            className={`filter-chip ${activeTab === 'DELIVERY_FAILED' ? 'active' : ''}`}
            onClick={() => setActiveTab('DELIVERY_FAILED')}
          >
            Không thành công
          </button>
        </div>
      </div>

      <div className="section-block">
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Người gửi / Điểm lấy</th>
                <th>Người nhận / Điểm giao</th>
                <th>Trạng thái</th>
                <th>Tài xế</th>
                <th>Thời gian</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td><strong>#{item.code}</strong></td>
                  <td>
                    <div><strong>{item.sender}</strong></div>
                    <small className="text-muted">{item.pickupAddress}</small>
                  </td>
                  <td>
                    <div><strong>{item.recipient}</strong></div>
                    <small className="text-muted">{item.dropoffAddress}</small>
                  </td>
                  <td><StatusBadge status={item.status} /></td>
                  <td>{item.driver}</td>
                  <td>{item.time}</td>
                  <td>
                    {item.status === 'CREATED' ? (
                      <Link to="/admin/assignment" className="action-btn action-primary">
                        Gán xe
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() =>
                          alert(`Đang mở thông tin chi tiết đơn ${item.code}.`)
                        }
                      >
                        Chi tiết
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
