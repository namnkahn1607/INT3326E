import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { Icon } from '../components/ui/Icon'
import { SessionControls } from '../features/auth/SessionControls'
import '../features/driver/driver.css'

type DriverTheme = 'system' | 'light' | 'dark'
const themeKey = 'parcelflow:driver-theme'

function readTheme(): DriverTheme {
  try {
    const value = localStorage.getItem(themeKey)
    if (value === 'light' || value === 'dark') return value
  } catch { /* The system preference still works without storage. */ }
  return 'system'
}

export function DriverLayout() {
  const { pathname } = useLocation()
  const [theme, setTheme] = useState(readTheme)
  const isOverview = pathname.replace(/\/$/, '') === '/driver'

  function changeTheme(value: DriverTheme) {
    setTheme(value)
    try { localStorage.setItem(themeKey, value) } catch { /* Keep the choice for this visit. */ }
  }

  return (
    <div className="driver-shell" data-theme={theme}>
      <a href="#driver-main" className="ui-skip-link">Đến nội dung chính</a>
      <header className="driver-topbar">
        <div className="driver-topbar-inner">
          <Link to="/driver" className="driver-wordmark">
            <span className="driver-brand-icon"><Icon name="box" /></span>
            <span><strong translate="no">ParcelFlow</strong><small>CỔNG TÀI XẾ</small></span>
          </Link>
          {isOverview && <nav aria-label="Điều hướng tài xế" className="driver-nav">
            <a href="#driver-shipments-title"><Icon name="box" />Đơn hàng</a>
            <a href="#driver-gps-title"><Icon name="pin" />GPS</a>
          </nav>}
          <div className="driver-topbar-controls">
            <label className="driver-theme-control">
              <Icon name="sun" />
              <select aria-label="Giao diện tài xế" value={theme} onChange={event => changeTheme(event.target.value as DriverTheme)}>
                <option value="system">Hệ thống</option>
                <option value="light">Express · Sáng</option>
                <option value="dark">Midnight · Tối</option>
              </select>
            </label>
            <SessionControls />
          </div>
        </div>
      </header>

      <main id="driver-main" className="driver-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
