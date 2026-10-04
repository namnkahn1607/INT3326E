import { StatusBadge } from '../../components/common/StatusBadge'

export function CustomerHistoryPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lịch sử giao hàng</h1>
          <p className="page-subtitle">
            Hồ sơ lưu trữ các đơn hàng đã hoàn tất giao hoặc giao thất bại.
          </p>
        </div>
      </div>

      <div className="section-block">
        <div className="data-table-wrapper">
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
                <td>03/10/2026 15:45</td>
                <td>Đã ký nhận đủ</td>
              </tr>
              <tr>
                <td><strong>#PF-88892</strong></td>
                <td>Hoàng Văn Cường</td>
                <td>Hồ Gươm Plaza, Hà Đông</td>
                <td><StatusBadge status="DELIVERY_FAILED" /></td>
                <td>02/10/2026 18:20</td>
                <td>Không liên lạc được người nhận</td>
              </tr>
              <tr>
                <td><strong>#PF-88870</strong></td>
                <td>Đỗ Thùy Linh</td>
                <td>20 Phạm Hùng, Mỹ Đình</td>
                <td><StatusBadge status="DELIVERED" /></td>
                <td>01/10/2026 09:10</td>
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
