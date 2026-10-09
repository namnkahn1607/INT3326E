export function AdminDriversPage() {
  const drivers = [
    {
      id: 'D01',
      name: 'Lê Văn Tài',
      phone: '0981.112.233',
      vehicle: 'Xe máy Suzuki Raider',
      status: 'Đang hoạt động',
      lastGpsTime: '20 giây trước',
      totalDelivered: 45,
    },
    {
      id: 'D02',
      name: 'Nguyễn Văn Hùng',
      phone: '0981.234.567',
      vehicle: 'Honda Wave Alpha',
      status: 'Đang hoạt động',
      lastGpsTime: '8 giây trước',
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
          <span className="admin-page-kicker">NHÂN SỰ VẬN HÀNH</span>
          <h1 className="page-title">Đội ngũ tài xế</h1>
          <p className="page-subtitle">
            Theo dõi trạng thái hoạt động và hiệu suất giao hàng.
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
                      className={`driver-state ${
                        d.status === 'Đang hoạt động'
                          ? 'active'
                          : d.status === 'Sẵn sàng'
                            ? 'ready'
                            : 'offline'
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td>
                    <span className="text-muted">{d.lastGpsTime}</span>
                  </td>
                  <td><strong>{d.totalDelivered}</strong> đơn</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
