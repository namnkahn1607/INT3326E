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
      <div className="customer-announcement">
        <div className="customer-shell customer-announcement-inner">
          <span>Giao nhận thông minh, theo dõi hành trình minh bạch</span>
          <span className="customer-support">Hỗ trợ: 1900 0000</span>
        </div>
      </div>
      <header className="customer-header">
        <div className="customer-header-inner">
          <div className="brand-group">
            <NavLink to="/customer" className="brand-title">
              <span className="brand-mark" aria-hidden="true">P</span>
              <span className="brand-wordmark">Parcel<strong>Flow</strong></span>
            </NavLink>
          </div>

          <div className="customer-right-taskbar">
            <Navigation
              items={customerNavItems}
              className="customer-nav"
              linkClassName="customer-nav-link"
            />
            <div className="user-profile-preview">
              <span className="customer-avatar" aria-hidden="true">KT</span>
              <span className="user-name">Khách hàng</span>
            </div>
          </div>
        </div>
      </header>

      <main className="customer-main-content">
        <Outlet />
      </main>

      <footer className="customer-footer">
        <div className="customer-shell customer-footer-grid">
          <div>
            <div className="footer-brand">Parcel<span>Flow</span></div>
            <p>Nền tảng giao nhận và theo dõi hành trình dành cho mọi đơn hàng.</p>
          </div>
          <div>
            <strong>Dịch vụ</strong>
            <NavLink to="/customer/create">Tạo đơn giao hàng</NavLink>
            <NavLink to="/customer/shipments">Tra cứu đơn hàng</NavLink>
          </div>
          <div>
            <strong>Hỗ trợ</strong>
            <span>Hotline: 1900 0000</span>
            <span>Email: support@parcelflow.vn</span>
          </div>
        </div>
        <div className="customer-footer-bottom">
          ParcelFlow &copy; 2026 · UET Cloud Application Development
        </div>
      </footer>
    </div>
  )
}
