import { NavLink } from 'react-router'
import { SessionControls } from '../auth/SessionControls'
import { useAuth } from '../auth/useAuth'
import { CustomerHomeIcon } from './CustomerHomeIcon'
import './customer-home.css'

export function CustomerHomeHeader() {
  const { user } = useAuth()
  const initials = (user?.displayName ?? 'Customer').split(/[\s@]+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()
  return <header className="pf-home-header"><div className="pf-home-container pf-home-header-inner">
    <NavLink to="/customer" className="pf-home-brand" aria-label="ParcelFlow — Tổng quan" translate="no">
      <span className="pf-home-brand-icon"><CustomerHomeIcon name="box" /></span>ParcelFlow<span className="pf-brand-period">.</span>
    </NavLink>
    <nav className="pf-home-nav" aria-label="Điều hướng khách hàng">
      <NavLink to="/customer" end>Tổng quan</NavLink>
      <NavLink to="/customer/shipments">Đơn hàng</NavLink>
      <NavLink to="/customer/history">Lịch sử</NavLink>
      <NavLink to="/customer/notifications">Thông báo</NavLink>
    </nav>
    <div className="pf-home-header-actions">
      <NavLink to="/customer/create" className="pf-primary-button pf-header-send"><CustomerHomeIcon name="send" />Tạo đơn mới</NavLink>
      <span className="pf-home-avatar" aria-label={user?.displayName ?? 'Customer account'}>{initials}<i aria-hidden="true" /></span>
      <SessionControls />
    </div>
  </div></header>
}
