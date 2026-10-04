export function AdminDriversPage() {
  const drivers = [
    {
      id: 'D01',
      name: 'Lê Văn Tài (Thành viên 4)',
      phone: '0981.112.233',
      vehicle: 'Xe máy Suzuki Raider',
      status: 'Đang hoạt động',
      lastGpsTime: '20 giây trước (Pub/Sub)',
      totalDelivered: 45,
    },
    {
      id: 'D02',
      name: 'Nguyễn Văn Hùng',
      phone: '0981.234.567',
      vehicle: 'Honda Wave Alpha',
      status: 'Đang hoạt động',
      lastGpsTime: '8 giây trước (Pub/Sub)',
      totalDelivered: 78,
    },
    {
      id: 'D03',
      name: 'Trần Văn Nam',
      phone: '0912.345.678',
      vehicle: 'Yamaha Grande',
      status: 'Sẵn sàng',
      lastGpsTime: '2 phút trước',
      totalDelivered: 62,
    },
    {
      id: 'D04',
      name: 'Phạm Văn Nam',
      phone: '0933.445.566',
      vehicle: 'Xe tải Suzuki 500kg',
      status: 'Ngoại tuyến',
      lastGpsTime: '1 giờ trước',
      totalDelivered: 31,
    },
  ]

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý đội ngũ tài xế</h1>
          <p className="page-subtitle">
            Danh sách tài xế thuộc hệ thống ParcelFlow và trạng thái kết nối GPS thời gian thực.
          </p>
        </div>
      </div>

      <div className="section-block">
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã TX</th>
                <th>Họ và tên</th>
                <th>Số điện thoại</th>
                <th>Phương tiện</th>
                <th>Trạng thái</th>
                <th>Gửi GPS gần nhất</th>
                <th>Đơn đã giao</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id}>
                  <td><strong>#{d.id}</strong></td>
                  <td><strong>{d.name}</strong></td>
                  <td>{d.phone}</td>
                  <td>{d.vehicle}</td>
                  <td>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor:
                          d.status === 'Đang hoạt động'
                            ? '#dcfce7'
                            : d.status === 'Sẵn sàng'
                            ? '#eff6ff'
                            : '#f1f5f9',
                        color:
                          d.status === 'Đang hoạt động'
                            ? '#166534'
                            : d.status === 'Sẵn sàng'
                            ? '#1d4ed8'
                            : '#64748b',
                      }}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td>
                    <code>{d.lastGpsTime}</code>
                  </td>
                  <td><strong>{d.totalDelivered}</strong> đơn</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="data-note">
          * Khung quản lý tài xế Tuần 1. Dữ liệu GPS tài xế sẽ truyền bất đồng bộ qua Google Cloud Pub/Sub và lưu vào Postgres ở Tuần 4 & Tuần 5.
        </p>
      </div>
    </div>
  )
}
