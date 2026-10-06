export function AdminAccountsPage() {
  const users = [
    {
      id: 'U1',
      email: 'tuan.admin@parcelflow.vn',
      role: 'Quản trị viên',
      status: 'Hoạt động',
    },
    {
      id: 'U2',
      email: 'driver4@parcelflow.vn',
      role: 'Tài xế',
      status: 'Hoạt động',
    },
    {
      id: 'U3',
      email: 'customer1@gmail.com',
      role: 'Khách hàng',
      status: 'Hoạt động',
    },
  ]

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <span className="admin-page-kicker">NGƯỜI DÙNG</span>
          <h1 className="page-title">Tài khoản và phân quyền</h1>
          <p className="page-subtitle">
            Quản lý vai trò và trạng thái người dùng ParcelFlow.
          </p>
        </div>
      </div>

      <div className="section-block">
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã User</th>
                <th>Email tài khoản</th>
                <th>Vai trò (Role)</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>#{u.id}</strong></td>
                  <td><span className="account-email"><i>{u.email.slice(0, 1).toUpperCase()}</i>{u.email}</span></td>
                  <td>
                    <span className="badge-role">{u.role}</span>
                  </td>
                  <td>
                    <span className="badge-active">{u.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
