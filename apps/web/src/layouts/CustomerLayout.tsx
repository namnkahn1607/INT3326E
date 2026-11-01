import { useEffect, useState } from 'react'
import { Outlet, useMatch } from 'react-router'
import { useReducedMotion } from '../features/auth/motion'
import { CustomerBackdrop } from '../features/customer/CustomerBackdrop'
import { CustomerHomeHeader } from '../features/customer/CustomerHomeHeader'
import { CustomerHomeIcon } from '../features/customer/CustomerHomeIcon'
import { CustomerThemeContext } from '../features/customer/customer-theme'

export function CustomerLayout() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return window.localStorage.getItem('parcelflow:customer-theme') === 'light' ? 'light' : 'dark' }
    catch { return 'dark' }
  })
  useEffect(() => {
    try { window.localStorage.setItem('parcelflow:customer-theme', theme) } catch { /* Storage can be disabled; switching still works for this visit. */ }
  }, [theme])
  const [backgroundPaused, setBackgroundPaused] = useState(false)
  const reducedMotion = useReducedMotion()
  const isOverview = Boolean(useMatch({ path: '/customer', end: true }))
  return (
    <CustomerThemeContext.Provider value={theme}>
    <div className={'customer-layout customer-layout--premium dashboard-layout pf-dark' + (isOverview ? ' customer-layout--overview' : '')} data-theme={theme} data-background-paused={backgroundPaused || reducedMotion}>
      {!isOverview && <CustomerBackdrop />}
      <a className="customer-skip-link" href="#customer-main">Đến nội dung chính</a>
      <CustomerHomeHeader theme={theme} onToggleTheme={() => setTheme(value => value === 'dark' ? 'light' : 'dark')} />

      <main className="customer-main-content" id="customer-main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="pf-home-footer pf-home-container">
        {isOverview && <div className="pf-home-footer-services" aria-label="Giao nhận cùng ParcelFlow">
          <span><CustomerHomeIcon name="shield" />Giao nhận tận tâm</span>
          <span><CustomerHomeIcon name="box" />Quản lý tập trung</span>
          <span><CustomerHomeIcon name="truck" />Theo sát hành trình</span>
        </div>}
        <span translate="no">© 2026 ParcelFlow</span>
        <button type="button" className="pf-background-toggle" aria-pressed={backgroundPaused || reducedMotion}
          disabled={reducedMotion} onClick={() => setBackgroundPaused(paused => !paused)}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M5 3v10M11 3v10" />
          </svg>
          {reducedMotion ? 'Nền tĩnh (giảm chuyển động)' : 'Tạm dừng nền động'}
        </button>
        {!isOverview && <span>Giao nhận tận tâm.</span>}
      </footer>
    </div>
    </CustomerThemeContext.Provider>
  )
}
