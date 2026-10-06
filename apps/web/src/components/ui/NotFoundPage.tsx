import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="not-found-container">
      <div className="not-found-card">
        <span className="not-found-code">404</span>
        <h1>Không tìm thấy trang</h1>
        <p>Đường dẫn bạn yêu cầu không tồn tại hoặc đã được thay đổi.</p>
        <div className="not-found-actions">
          <Link to="/customer" className="btn btn-primary">
            Về Cổng Khách hàng
          </Link>
          <Link to="/admin" className="btn btn-secondary">
            Về Cổng Quản trị
          </Link>
          <Link to="/driver" className="btn btn-outline">
            Về Cổng Tài xế
          </Link>
        </div>
      </div>
    </div>
  )
}
