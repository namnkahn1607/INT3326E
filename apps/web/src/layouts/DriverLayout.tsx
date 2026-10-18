import { NavLink, Outlet } from 'react-router'
import { SessionControls } from '../features/auth/SessionControls'

export function DriverLayout() {
  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', background: '#fff' }}>
      <a href="#driver-main" className="ui-skip-link">Đến nội dung chính</a>
      <header style={{ padding: '16px', background: '#166534', color: '#fff', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
        <NavLink to="/driver" style={{ color: '#fff', fontWeight: 700 }}>
          ParcelFlow Driver
        </NavLink>
        <SessionControls />
      </header>

      <main id="driver-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
