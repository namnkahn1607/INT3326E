import { NavLink, Outlet } from 'react-router'
import { Navigation, type NavigationItem } from '../components/common/Navigation'

const adminNavItems: NavigationItem[] = [
  { path: '/admin', label: 'Tổng quan hệ thống' },
  { path: '/admin/shipments', label: 'Quản lý đơn hàng' },
  { path: '/admin/assignment', label: 'Phân công tài xế', badge: 'Cần gán' },
  { path: '/admin/drivers', label: 'Đội ngũ tài xế' },
  { path: '/admin/accounts', label: 'Quản lý tài khoản' },
]

export function AdminLayout() {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <NavLink to="/admin" className="brand-title admin-brand">
            Parcel<span>Flow</span>
          </NavLink>
          <span className="role-tag admin-tag">Admin & Dispatcher</span>
        </div>

        <div className="sidebar-section-title">CHỨC NĂNG ĐIỀU PHỐI</div>
        <Navigation
          items={adminNavItems}
          className="admin-nav"
          linkClassName="admin-nav-link"
        />

        <div className="sidebar-footer">
          <div className="env-badge">
            <span className="live-indicator" />
            <span>Cloud Run • Modular Monolith</span>
          </div>
          <small className="build-version">v0.1.0-w1-scaffold</small>
        </div>
      </aside>

      <div className="admin-body">
        <header className="admin-topbar">
          <div className="topbar-left">
            <span className="system-title">Bảng điều phối logistics</span>
            <span className="architecture-tag">REST & Pub/Sub Pipeline</span>
          </div>

          <div className="topbar-right">
            <div className="admin-user-pill">
              <span className="admin-avatar">AD</span>
              <div className="admin-meta">
                <span className="admin-name">Quản trị viên</span>
                <span className="admin-role">Dispatcher / Admin</span>
              </div>
            </div>
          </div>
        </header>

        <main className="admin-content-area">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
