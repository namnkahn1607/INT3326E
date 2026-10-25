import { NavLink, Outlet, useLocation } from 'react-router'
import { Navigation, type NavigationItem } from '../components/ui/Navigation'
import { SessionControls } from '../features/auth/SessionControls'
import { DemoNotice } from '../components/ui/DemoNotice'

const adminNavItems: NavigationItem[] = [
  { path: '/admin', label: 'Tổng quan' },
  { path: '/admin/shipments', label: 'Đơn hàng' },
  { path: '/admin/assignment', label: 'Phân công' },
  { path: '/admin/live-map', label: 'Bản đồ trực tiếp' },
  { path: '/admin/drivers', label: 'Tài xế' },
  { path: '/admin/accounts', label: 'Tài khoản' },
]

export function AdminLayout() {
  const { pathname } = useLocation()
  const apiPage = ['/admin/shipments', '/admin/assignment', '/admin/drivers'].includes(pathname.replace(/\/$/, ''))
  return (
    <div className="admin-layout">
      <a href="#admin-main" className="ui-skip-link">Đến nội dung chính</a>
      <aside className="admin-sidebar admin-sidebar-right">
        <div className="sidebar-header">
          <NavLink to="/admin" className="brand-title admin-brand">
            <span className="admin-brand-mark" aria-hidden="true">P</span>
            <span>Parcel<strong>Flow</strong></span>
          </NavLink>
          <span className="admin-console-label">Trung tâm vận hành</span>
        </div>

        <div className="sidebar-section-title">QUẢN LÝ</div>
        <Navigation
          items={adminNavItems}
          className="admin-nav"
          linkClassName="admin-nav-link"
        />

        <div className="sidebar-footer">
          <div className="admin-sidebar-profile">
            <span className="admin-avatar">AD</span>
            <div className="admin-meta">
              <span className="admin-name">Quản trị viên</span>
              <span className="admin-role">Đang hoạt động</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="admin-body">
        <header className="admin-topbar">
          <div className="topbar-left">
            <span className="system-title">Bảng điều hành</span>
            <span className="admin-date">Tổng quan hôm nay</span>
          </div>

          <div className="topbar-right">
            <SessionControls />
          </div>
        </header>

        <main className="admin-content-area" id="admin-main" tabIndex={-1}>
          {!apiPage && <div className="ui-admin-demo"><DemoNotice>Màn hình này dùng dữ liệu mẫu, chưa phải dữ liệu vận hành thật. Đơn hàng, Phân công và Tài xế đã dùng API; các trang minh họa còn lại chưa được kết nối.</DemoNotice></div>}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
