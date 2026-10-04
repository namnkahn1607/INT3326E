import { Link } from 'react-router'
import { StatCard } from '../../components/common/StatCard'
import { StatusBadge } from '../../components/common/StatusBadge'

export function CustomerOverviewPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tổng quan giao nhận</h1>
          <p className="page-subtitle">
            Theo dõi hành trình bưu phẩm và quản lý các yêu cầu vận chuyển của bạn.
          </p>
        </div>
        <div>
          <Link to="/customer/create" className="btn btn-primary">
            + Tạo đơn giao mới
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Đơn đang xử lý"
          value={2}
          description="Chờ gán tài xế hoặc đang điều phối"
          color="#2563eb"
        />
        <StatCard
          title="Đang trên đường giao"
          value={1}
          description="Tài xế đang vận chuyển theo thời gian thực"
          color="#7c3aed"
        />
        <StatCard
          title="Giao thành công"
          value={14}
          description="Tổng các đơn đã hoàn thành tuần này"
          trend="+3 đơn mới"
          color="#16a34a"
        />
      </div>

      <div className="section-block">
        <h2 className="section-title">Quy trình giao nhận ParcelFlow (MVP)</h2>
        <div className="flow-steps-tracker">
          <div className="step-item active">
            <div className="step-number">1</div>
            <div className="step-meta">
              <strong>CREATED</strong>
              <span>Khách tạo đơn hàng</span>
            </div>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-item active">
            <div className="step-number">2</div>
            <div className="step-meta">
              <strong>ASSIGNED</strong>
              <span>Điều phối gán tài xế</span>
            </div>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-item active">
            <div className="step-number">3</div>
            <div className="step-meta">
              <strong>PICKED_UP</strong>
              <span>Tài xế nhận hàng & di chuyển</span>
            </div>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-item final">
            <div className="step-number">4</div>
            <div className="step-meta">
              <strong>DELIVERED</strong>
              <span>Hoàn tất giao nhận</span>
            </div>
          </div>
        </div>
      </div>

      <div className="section-block">
        <div className="section-header-row">
          <h2 className="section-title">Đơn hàng mới nhất</h2>
          <Link to="/customer/shipments" className="text-link">
            Xem toàn bộ đơn →
          </Link>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã vận đơn</th>
                <th>Điểm lấy hàng</th>
                <th>Điểm giao hàng</th>
                <th>Trạng thái</th>
                <th>Thời gian tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>#PF-89021</strong></td>
                <td>144 Xuân Thủy, Cầu Giấy, Hà Nội</td>
                <td>8 Tôn Thất Thuyết, Mỹ Đình, Hà Nội</td>
                <td><StatusBadge status="PICKED_UP" /></td>
                <td>Hôm nay, 10:15</td>
                <td>
                  <Link to="/customer/shipments" className="action-btn">
                    Theo dõi
                  </Link>
                </td>
              </tr>
              <tr>
                <td><strong>#PF-89022</strong></td>
                <td>Đại học Công nghệ (UET), ĐHQGHN</td>
                <td>Keangnam Landmark 72, Nam Từ Liêm</td>
                <td><StatusBadge status="ASSIGNED" /></td>
                <td>Hôm nay, 11:00</td>
                <td>
                  <Link to="/customer/shipments" className="action-btn">
                    Chi tiết
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="data-note">
          * Lưu ý: Bảng dữ liệu trên là bản trình bày khung giao diện (mockup Tuần 1). Sẽ kết nối API NestJS thật ở Tuần 2.
        </p>
      </div>
    </div>
  )
}
