import { useState } from 'react'
import { Link } from 'react-router'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { AppliedFilters, type AppliedFilter } from '../../components/ui/AppliedFilters'
import { SHIPMENT_STATUS_MAP } from '../../types/shipment'
import { formatDateTime } from '../../utils'
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
    time: '2026-10-05T11:40:00+07:00',
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
    time: '2026-10-05T10:30:00+07:00',
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
    time: '2026-10-05T09:50:00+07:00',
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
    time: '2026-10-05T08:15:00+07:00',
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
    time: '2026-10-05T07:30:00+07:00',
  },
]

export function AdminShipmentsPage() {
  const [activeTab, setActiveTab] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const query = searchTerm.trim().toLocaleLowerCase('vi-VN')

  const filtered = mockAdminShipments.filter((item) => {
    const matchStatus = activeTab === 'ALL' || item.status === activeTab
    const matchSearch =
      item.code.toLocaleLowerCase('vi-VN').includes(query) ||
      item.sender.toLocaleLowerCase('vi-VN').includes(query) ||
      item.recipient.toLocaleLowerCase('vi-VN').includes(query)
    return matchStatus && matchSearch
  })
  const applied: AppliedFilter[] = []
  if (activeTab !== 'ALL') applied.push({ key: 'status', label: 'Trạng thái', value: SHIPMENT_STATUS_MAP[activeTab as ShipmentStatus].label,
    onRemove: () => { setActiveTab('ALL'); document.getElementById('admin-order-search')?.focus() } })
  if (searchTerm.trim()) applied.push({ key: 'search', label: 'Tìm kiếm', value: searchTerm.trim(),
    onRemove: () => { setSearchTerm(''); document.getElementById('admin-order-search')?.focus() } })
  const clear = () => { setActiveTab('ALL'); setSearchTerm(''); document.getElementById('admin-order-search')?.focus() }

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
          <label htmlFor="admin-order-search" className="ui-search-label">Tìm đơn hàng minh họa</label>
          <input
            id="admin-order-search"
            name="orderSearch"
            autoComplete="off"
            spellCheck={false}
            type="text"
            placeholder="Mã đơn, người gửi hoặc người nhận…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="admin-search-input"
          />
        </div>

        <div className="filter-toolbar">
          <button
            aria-pressed={activeTab === 'ALL'}
            className={`filter-chip ${activeTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveTab('ALL')}
          >
            Tất cả trạng thái
          </button>
          <button
            aria-pressed={activeTab === 'CREATED'}
            className={`filter-chip ${activeTab === 'CREATED' ? 'active' : ''}`}
            onClick={() => setActiveTab('CREATED')}
          >
            Chờ phân công
          </button>
          <button
            aria-pressed={activeTab === 'ASSIGNED'}
            className={`filter-chip ${activeTab === 'ASSIGNED' ? 'active' : ''}`}
            onClick={() => setActiveTab('ASSIGNED')}
          >
            Đã phân công
          </button>
          <button
            aria-pressed={activeTab === 'PICKED_UP'}
            className={`filter-chip ${activeTab === 'PICKED_UP' ? 'active' : ''}`}
            onClick={() => setActiveTab('PICKED_UP')}
          >
            Đang giao
          </button>
          <button
            aria-pressed={activeTab === 'DELIVERED'}
            className={`filter-chip ${activeTab === 'DELIVERED' ? 'active' : ''}`}
            onClick={() => setActiveTab('DELIVERED')}
          >
            Thành công
          </button>
          <button
            aria-pressed={activeTab === 'DELIVERY_FAILED'}
            className={`filter-chip ${activeTab === 'DELIVERY_FAILED' ? 'active' : ''}`}
            onClick={() => setActiveTab('DELIVERY_FAILED')}
          >
            Không thành công
          </button>
        </div>
      </div>

      <AppliedFilters filters={applied} onClear={clear} />
      <p className="ui-result-count" role="status">{filtered.length} kết quả trong {mockAdminShipments.length} đơn minh họa.</p>

      {filtered.length === 0 ? <section className="customer-empty"><h2>Không có kết quả phù hợp</h2>
        <p>Thử bỏ bớt điều kiện hoặc kiểm tra từ khóa.</p><button className="btn btn-outline" type="button" onClick={clear}>Xóa bộ lọc</button></section>
      : <div className="section-block">
        <div className="data-table-wrapper" role="region" aria-label="Đơn hàng minh họa, cuộn ngang để xem đầy đủ" tabIndex={0}>
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
                  <td><time dateTime={item.time}>{formatDateTime(item.time)}</time></td>
                  <td>
                    {item.status === 'CREATED' ? (
                      <Link to="/admin/assignment" className="action-btn action-primary">
                        Gán xe
                      </Link>
                    ) : (
                      <details className="ui-detail-disclosure"><summary>Chi tiết mẫu</summary><dl>
                        <dt>Điểm lấy</dt><dd>{item.pickupAddress}</dd>
                        <dt>Điểm giao</dt><dd>{item.dropoffAddress}</dd>
                        <dt>Tài xế</dt><dd>{item.driver}</dd>
                      </dl></details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  )
}
