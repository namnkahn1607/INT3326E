import { NavLink } from 'react-router'
import { useRef } from 'react'
import { Icon } from '../../components/ui/Icon'
import { useAuth } from '../auth/useAuth'
import { SessionControls } from '../auth/SessionControls'
import './customer-home.css'

const items = [
  { path: '/customer', label: 'Tổng quan', end: true },
  { path: '/customer/shipments', label: 'Đơn hàng', end: false },
  { path: '/customer/history', label: 'Lịch sử', end: false },
  { path: '/customer/notifications', label: 'Thông báo', end: false },
] as const

export function CustomerHomeHeader({ theme = 'dark', onToggleTheme }: {
  theme?: 'dark' | 'light'
  onToggleTheme?: () => void
}) {
  const { user } = useAuth()
  const account = useRef<HTMLDetailsElement>(null)
  const initials = (user?.displayName ?? 'PF').split(/[\s@]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  function closeAccount() { account.current?.removeAttribute('open') }
  return <header className="customer-top-nav pf-home-header">
    <div className="customer-top-nav-inner">
      <NavLink to="/customer" className="dashboard-brand" aria-label="ParcelFlow — Tổng quan" translate="no" onClick={closeAccount}>
        <Icon name="box" /><span>ParcelFlow<span className="dashboard-brand-dot">.</span></span>
      </NavLink>
      <nav className="pf-home-nav" aria-label="Điều hướng khách hàng">
        {items.map(item => <NavLink key={item.path} to={item.path} end={item.end} onClick={closeAccount}>{item.label}</NavLink>)}
      </nav>
      <div className="pf-home-header-actions">
        <NavLink to="/customer/create" className="pf-primary-button pf-header-send" onClick={closeAccount}><Icon name="send" />Tạo đơn mới</NavLink>
        <details ref={account} className="customer-account-menu" onKeyDown={event => {
          if (event.key === 'Escape') { closeAccount(); account.current?.querySelector('summary')?.focus() }
        }}>
          <summary aria-label="Tài khoản" title={user?.displayName ?? 'Tài khoản'}><span aria-hidden="true">{initials}</span></summary>
          <div className="customer-account-panel"><strong>{user?.displayName ?? 'Tài khoản'}</strong>
            {onToggleTheme && <button type="button" className="customer-theme-toggle" aria-pressed={theme === 'light'} onClick={onToggleTheme}>
              <Icon name="sun" /><span>Giao diện sáng</span><span className="customer-theme-state" aria-hidden="true">{theme === 'light' ? 'Bật' : 'Tắt'}</span>
            </button>}
            <SessionControls />
          </div>
        </details>
      </div>
    </div>
  </header>
}
