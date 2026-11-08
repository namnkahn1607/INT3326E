import { StatusBadge } from '../../components/ui/StatusBadge'
import { DemoNotice } from '../../components/ui/DemoNotice'
import { formatDateTime } from '../../utils'

export function CustomerHistoryPage() {
  return (
    <div className="page-container customer-api-page customer-history-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lịch sử giao hàng</h1>
          <p className="page-subtitle">
            Hồ sơ lưu trữ các đơn hàng đã hoàn tất giao hoặc giao thất bại.
          </p>
        </div>
      </div>

      <DemoNotice>Lịch sử bên dưới là dữ liệu mẫu, chưa phải lịch sử đơn hàng của tài khoản.</DemoNotice>
      <div className="section-block">
        <div className="data-table-wrapper" role="region" aria-label="Lịch sử giao hàng minh họa, cuộn ngang để xem đầy đủ" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã vận đơn</th>
                <th>Người nhận</th>
                <th>Điểm giao</th>
                <th>Trạng thái kết thúc</th>
                <th>Thời gian hoàn tất</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>#PF-88901</strong></td>
                <td>Phạm Thị Mai</td>
                <td>Tòa nhà FPT, Duy Tân, Cầu Giấy</td>
                <td><StatusBadge status="DELIVERED" /></td>
                <td><time dateTime="2026-10-03T15:45:00+07:00">{formatDateTime('2026-10-03T15:45:00+07:00')}</time></td>
                <td>Đã ký nhận đủ</td>
              </tr>
              <tr>
                <td><strong>#PF-88892</strong></td>
                <td>Hoàng Văn Cường</td>
                <td>Hồ Gươm Plaza, Hà Đông</td>
                <td><StatusBadge status="DELIVERY_FAILED" /></td>
                <td><time dateTime="2026-10-02T18:20:00+07:00">{formatDateTime('2026-10-02T18:20:00+07:00')}</time></td>
                <td>Không liên lạc được người nhận</td>
              </tr>
              <tr>
                <td><strong>#PF-88870</strong></td>
                <td>Đỗ Thùy Linh</td>
                <td>20 Phạm Hùng, Mỹ Đình</td>
                <td><StatusBadge status="DELIVERED" /></td>
                <td><time dateTime="2026-10-01T09:10:00+07:00">{formatDateTime('2026-10-01T09:10:00+07:00')}</time></td>
                <td>Giao đúng giờ hẹn</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="data-note">
          * Khung giao diện Tuần 1. Chức năng tra cứu và phân trang lịch sử giao hàng hoàn chỉnh sẽ được hoàn thiện ở Tuần 4.
        </p>
      </div>
    </div>
  )
}
