import { useState } from 'react'
import { Outlet } from 'react-router'
import { useReducedMotion } from '../features/auth/motion'
import { CustomerBackdrop } from '../features/customer/CustomerBackdrop'
import { CustomerHomeHeader } from '../features/customer/CustomerHomeHeader'

export function CustomerLayout() {
  const [backgroundPaused, setBackgroundPaused] = useState(false)
  const reducedMotion = useReducedMotion()
  return (
    <div className="customer-layout customer-layout--premium" data-background-paused={backgroundPaused || reducedMotion}>
      <CustomerBackdrop />
      <a className="customer-skip-link" href="#customer-main">Đến nội dung chính</a>
      <CustomerHomeHeader />

      <main className="customer-main-content" id="customer-main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="pf-home-footer pf-home-container">
        <span translate="no">© 2026 ParcelFlow</span>
        <button type="button" className="pf-background-toggle" aria-pressed={backgroundPaused || reducedMotion}
          disabled={reducedMotion} onClick={() => setBackgroundPaused(paused => !paused)}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M5 3v10M11 3v10" />
          </svg>
          {reducedMotion ? 'Nền tĩnh (giảm chuyển động)' : 'Tạm dừng nền động'}
        </button>
        <span>Giao nhận tận tâm.</span>
      </footer>
    </div>
  )
}
