import { NavLink, Outlet } from 'react-router'

export function DriverLayout() {
  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', background: '#fff' }}>
      <header style={{ padding: '16px', background: '#166534', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <NavLink to="/driver" style={{ color: '#fff', fontWeight: 700 }}>
          ParcelFlow Driver
        </NavLink>
        <span style={{ fontSize: '12px' }}>Thành viên 4</span>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  )
}
