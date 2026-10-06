import { Link } from 'react-router'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'

export function AdminOverviewPage() {
  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tổng quan hệ thống điều phối</h1>
          <p className="page-subtitle">
            Giám sát vận hành logistics theo thời gian thực và quản lý luồng đơn hàng.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link to="/admin/assignment" className="btn btn-warning">
            Phân công tài xế (3 đơn chờ)
          </Link>
          <Link to="/admin/shipments" className="btn btn-primary">
            Quản lý tất cả đơn
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Tổng đơn hôm nay"
          value="128"
          description="Đơn phát sinh trong 24 giờ qua"
          trend="+12% so với hôm qua"
          color="#0f172a"
        />
        <StatCard
          title="Đơn chưa gán (CREATED)"
          value="3"
          description="Cần điều phối gán tài xế ngay"
          color="#b45309"
        />
        <StatCard
          title="Đang giao hàng (PICKED_UP)"
          value="42"
          description="Tài xế đang gửi GPS qua Pub/Sub"
          color="#7c3aed"
        />
        <StatCard
          title="Đơn thất bại / Trễ"
          value="2"
          description="Cần xử lý ngoại lệ theo mốc Tuần 6"
          color="#dc2626"
        />
      </div>

      <div className="admin-dashboard-split">
        <div className="section-block flex-2">
          <div className="section-header-row">
            <h2 className="section-title">Đơn hàng cần chú ý gần đây</h2>
            <Link to="/admin/shipments" className="text-link">
              Tất cả đơn →
            </Link>
          </div>

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Người gửi / Người nhận</th>
                  <th>Trạng thái</th>
                  <th>Tài xế</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>#PF-89025</strong></td>
                  <td>ĐH Bách Khoa → ĐH Quốc Gia</td>
                  <td><StatusBadge status="CREATED" /></td>
                  <td><span className="text-muted">Chưa gán</span></td>
                  <td>
                    <Link to="/admin/assignment" className="action-btn action-primary">
                      Gán tài xế
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td><strong>#PF-89024</strong></td>
                  <td>Cầu Giấy → Hà Đông</td>
                  <td><StatusBadge status="PICKED_UP" /></td>
                  <td>Nguyễn Văn Hùng (Driver #2)</td>
                  <td>
                    <Link to="/admin/shipments" className="action-btn">
                      Chi tiết
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td><strong>#PF-89020</strong></td>
                  <td>Hoàn Kiếm → Long Biên</td>
                  <td><StatusBadge status="DELIVERY_FAILED" /></td>
                  <td>Phạm Văn Nam (Driver #5)</td>
                  <td>
                    <Link to="/admin/shipments" className="action-btn action-danger">
                      Xử lý lỗi
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="section-block flex-1">
          <h2 className="section-title">Hạ tầng & NFR mục tiêu</h2>
          <div className="system-health-panel">
            <div className="health-row">
              <span className="health-label">Kiến trúc:</span>
              <span className="health-value">Modular Monolith (NestJS)</span>
            </div>
            <div className="health-row">
              <span className="health-label">GPS Pipeline:</span>
              <span className="health-value">Pub/Sub + GPS Worker</span>
            </div>
            <div className="health-row">
              <span className="health-label">Database:</span>
              <span className="health-value">Cloud SQL PostgreSQL</span>
            </div>
            <div className="health-row">
              <span className="health-label">Target Latency:</span>
              <span className="health-value">p95 &lt; 500ms (Create/Assign)</span>
            </div>
            <div className="health-row">
              <span className="health-label">GPS Ack Latency:</span>
              <span className="health-value">p95 &lt; 150ms (Pub/Sub)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
