import { useState } from 'react'
import { Link } from 'react-router'

export function CustomerCreatePage() {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tạo đơn giao hàng mới</h1>
          <p className="page-subtitle">
            Nhập thông tin bưu kiện, điểm lấy hàng và điểm giao nhận bưu phẩm.
          </p>
        </div>
        <div>
          <Link to="/customer/shipments" className="btn btn-secondary">
            ← Quay lại danh sách
          </Link>
        </div>
      </div>

      <div className="alert-box alert-info">
        <strong>Nhiệm vụ Issue #3 (Geocoding):</strong> Ở Tuần 2, form này sẽ tích hợp tính năng Geocoding: Tự động chuyển đổi địa chỉ thành tọa độ (lat, lng) khi chọn vị trí trên bản đồ, đảm bảo tính nhất quán dữ liệu trước khi gửi sang Backend NestJS.
      </div>

      {submitted ? (
        <div className="card-box success-card">
          <h2>Đã ghi nhận thông tin tạo đơn (Mô phỏng)</h2>
          <p>
            Đây là giao diện khung cho Tuần 1. Ở Tuần 2, hành động này sẽ gửi yêu cầu <code>POST /shipments</code> tới backend NestJS và lưu vào Cloud SQL.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setSubmitted(false)}
          >
            Tạo thử đơn khác
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="form-card">
          <div className="form-section">
            <h3 className="form-section-title">1. Thông tin điểm lấy hàng</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="pickup-address">Địa chỉ lấy hàng *</label>
                <input
                  id="pickup-address"
                  type="text"
                  placeholder="Ví dụ: 144 Xuân Thủy, Cầu Giấy, Hà Nội"
                  defaultValue="144 Xuân Thủy, Cầu Giấy, Hà Nội"
                  required
                />
                <span className="field-hint">
                  Hệ thống sẽ geocode địa chỉ này thành tọa độ (lat, lng) ở Tuần 2.
                </span>
              </div>
              <div className="form-group">
                <label htmlFor="sender-name">Họ tên người gửi *</label>
                <input
                  id="sender-name"
                  type="text"
                  placeholder="Nguyễn Văn A"
                  defaultValue="Nguyễn Văn Tuấn"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="sender-phone">Số điện thoại *</label>
                <input
                  id="sender-phone"
                  type="tel"
                  placeholder="0912345678"
                  defaultValue="0987654321"
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">2. Thông tin điểm giao hàng</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="delivery-address">Địa chỉ giao hàng *</label>
                <input
                  id="delivery-address"
                  type="text"
                  placeholder="Ví dụ: Keangnam Landmark 72, Nam Từ Liêm, Hà Nội"
                  defaultValue="Keangnam Landmark 72, Nam Từ Liêm, Hà Nội"
                  required
                />
                <span className="field-hint">
                  Tọa độ giao hàng sẽ là đích tính toán ETA (Haversine) ở Tuần 7.
                </span>
              </div>
              <div className="form-group">
                <label htmlFor="recipient-name">Họ tên người nhận *</label>
                <input
                  id="recipient-name"
                  type="text"
                  placeholder="Trần Thị B"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="recipient-phone">Số điện thoại người nhận *</label>
                <input
                  id="recipient-phone"
                  type="tel"
                  placeholder="0901234567"
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">3. Thông tin bưu phẩm</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="pkg-desc">Mô tả bưu kiện / Ghi chú</label>
                <textarea
                  id="pkg-desc"
                  rows={3}
                  placeholder="Ví dụ: Tài liệu hợp đồng, hàng dễ vỡ..."
                  defaultValue="Tài liệu dự án ParcelFlow Cloud UET"
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Xác nhận tạo đơn (Khung Tuần 1)
            </button>
            <Link to="/customer" className="btn btn-outline">
              Hủy bỏ
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
