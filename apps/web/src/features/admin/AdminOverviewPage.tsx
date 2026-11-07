import { Link } from 'react-router'
import { StatusBadge } from '../../components/ui/StatusBadge'

export function AdminOverviewPage() {
  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <span className="admin-page-kicker">TỔNG QUAN</span>
          <h1 className="page-title">Chào buổi sáng, Quản trị viên</h1>
          <p className="page-subtitle">
            Theo dõi nhanh hoạt động giao nhận trong ngày hôm nay.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link to="/admin/assignment" className="btn btn-primary">
            Phân công 3 đơn chờ
          </Link>
        </div>
      </div>

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <span className="admin-stat-icon purple">▣</span>
          <div><span>Tổng đơn hôm nay</span><strong>128</strong><small className="positive">↑ 12% so với hôm qua</small></div>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-icon amber">⌛</span>
          <div><span>Chờ phân công</span><strong>3</strong><small>Cần xử lý sớm</small></div>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-icon blue">↗</span>
          <div><span>Đang giao</span><strong>42</strong><small>32,8% tổng đơn</small></div>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-icon red">!</span>
          <div><span>Cần chú ý</span><strong>2</strong><small>Đơn giao không thành công</small></div>
        </article>
      </div>

      <div className="admin-overview-grid">
        <div className="admin-panel admin-orders-panel">
          <div className="section-header-row">
            <div>
              <h2 className="section-title">Đơn hàng cần xử lý</h2>
              <p className="admin-panel-subtitle">Các đơn mới hoặc đang gặp vấn đề</p>
            </div>
            <Link to="/admin/shipments" className="text-link">
              Xem tất cả →
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
                  <td><span className="admin-unassigned">Chưa phân công</span></td>
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
                  <td>Nguyễn Văn Hùng</td>
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
                  <td>Phạm Văn Nam</td>
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

        <aside className="admin-panel admin-progress-panel">
          <div className="section-header-row">
            <div>
              <h2 className="section-title">Tiến độ hôm nay</h2>
              <p className="admin-panel-subtitle">Tính đến 14:30</p>
            </div>
          </div>
          <div className="delivery-rate">
            <strong>92%</strong>
            <span>Tỷ lệ giao thành công</span>
          </div>
          <div className="progress-track"><span style={{ width: '92%' }} /></div>
          <div className="progress-summary">
            <div><strong>83</strong><span>Đã hoàn tất</span></div>
            <div><strong>42</strong><span>Đang giao</span></div>
            <div><strong>3</strong><span>Chờ xử lý</span></div>
          </div>
          <Link to="/admin/shipments" className="admin-panel-link">Xem báo cáo đơn hàng →</Link>
        </aside>
      </div>

      <div className="admin-panel admin-activity-panel">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Hoạt động gần đây</h2>
            <p className="admin-panel-subtitle">Cập nhật mới nhất trong hệ thống</p>
          </div>
        </div>
        <div className="admin-activity-list">
          <div><span className="activity-dot green" /><p><strong>#PF-89018</strong> đã giao thành công</p><time>5 phút trước</time></div>
          <div><span className="activity-dot purple" /><p><strong>Trần Văn Nam</strong> đã nhận đơn #PF-89023</p><time>12 phút trước</time></div>
          <div><span className="activity-dot amber" /><p><strong>#PF-89025</strong> đang chờ phân công tài xế</p><time>18 phút trước</time></div>
        </div>
      </div>
    </div>
  )
}
