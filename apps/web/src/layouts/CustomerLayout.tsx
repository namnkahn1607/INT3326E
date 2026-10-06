import { NavLink, Outlet } from 'react-router'
import { Navigation, type NavigationItem } from '../components/ui/Navigation'

const customerNavItems: NavigationItem[] = [
  { path: '/customer', label: 'Tổng quan' },
  { path: '/customer/create', label: '+ Tạo đơn mới' },
  { path: '/customer/shipments', label: 'Đơn hàng của tôi' },
  { path: '/customer/history', label: 'Lịch sử giao hàng' },
  { path: '/customer/notifications', label: 'Thông báo', badge: 2 },
]

export function CustomerLayout() {
  return (
    <div className="customer-layout">
      <header className="customer-header">
        <div className="customer-header-inner">
          <div className="brand-group">
            <NavLink to="/customer" className="brand-title">
              Parcel<span>Flow</span>
            </NavLink>
            <span className="role-tag customer-tag">Cổng Khách hàng</span>
          </div>

          {/* Thanh taskbar điều hướng chuyển sang bên phải */}
          <div className="customer-right-taskbar">
            <Navigation
              items={customerNavItems}
              className="customer-nav"
              linkClassName="customer-nav-link"
            />
            <div className="user-profile-preview">
              <span className="user-status-dot" />
              <span className="user-name">Khách hàng demo</span>
            </div>
          </div>
        </div>
      </header>

      <main className="customer-main-content">
        <Outlet />
      </main>

      <footer className="customer-footer">
        <div className="footer-inner">
          <span>ParcelFlow &copy; 2026 - UET Cloud Application Development (Nhóm 6)</span>
          <span className="sub-text">Hỗ trợ giao nhận nhanh & theo dõi hành trình thời gian thực</span>
        </div>
      </footer>
    </div>
  )
}
