export function AdminAccountsPage() {
  const users = [
    {
      id: 'U1',
      email: 'tuan.admin@parcelflow.vn',
      role: 'Admin / Dispatcher',
      authMethod: 'Firebase Auth',
      status: 'Hoạt động',
    },
    {
      id: 'U2',
      email: 'driver4@parcelflow.vn',
      role: 'Driver',
      authMethod: 'Firebase Auth',
      status: 'Hoạt động',
    },
    {
      id: 'U3',
      email: 'customer1@gmail.com',
      role: 'Customer',
      authMethod: 'Firebase Auth',
      status: 'Hoạt động',
    },
  ]

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý tài khoản & Phân quyền</h1>
          <p className="page-subtitle">
            Danh sách người dùng và vai trò truy cập trong hệ sinh thái ParcelFlow.
          </p>
        </div>
      </div>

      <div className="alert-box alert-info">
        <strong>Lộ trình Tuần 2:</strong> Hệ thống xác thực người dùng dựa trên <strong>Firebase Authentication</strong>. Phân quyền và token JWT sẽ được truyền kèm các yêu cầu REST API tới Cloud Run Backend.
      </div>

      <div className="section-block">
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã User</th>
                <th>Email tài khoản</th>
                <th>Vai trò (Role)</th>
                <th>Phương thức Auth</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>#{u.id}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    <span className="badge-role">{u.role}</span>
                  </td>
                  <td>{u.authMethod}</td>
                  <td>
                    <span className="badge-active">{u.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="data-note">
          * Khung giao diện quản lý tài khoản cơ bản. Chi tiết quyền thao tác từng màn hình sẽ hoàn thiện cùng Auth ở Tuần 2.
        </p>
      </div>
    </div>
  )
}
