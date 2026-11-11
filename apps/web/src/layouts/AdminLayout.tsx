import { Outlet, useLocation } from 'react-router'
import { DashboardNavigation } from '../components/ui/DashboardNavigation'
import { useEffect, useState } from 'react'
import { Icon } from '../components/ui/Icon'
import { DemoNotice } from '../components/ui/DemoNotice'
import '../features/admin/admin-workspace.css'

const items = [
  { path: '/admin', label: 'Tổng quan', icon: 'grid', end: true },
  { path: '/admin/shipments', label: 'Đơn hàng', icon: 'box' },
  { path: '/admin/assignment', label: 'Phân công', icon: 'send' },
  { path: '/admin/live-map', label: 'Bản đồ trực tiếp', icon: 'pin' },
  { path: '/admin/drivers', label: 'Tài xế', icon: 'truck' },
  { path: '/admin/accounts', label: 'Tài khoản', icon: 'users' },
] as const

export function AdminLayout() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return window.localStorage.getItem('parcelflow:admin-theme') === 'light' ? 'light' : 'dark' }
    catch { return 'dark' }
  })
  useEffect(() => {
    try { window.localStorage.setItem('parcelflow:admin-theme', theme) }
    catch { /* Switching still works when browser storage is blocked. */ }
  }, [theme])
  const { pathname } = useLocation()
  const demoPage = pathname.replace(/\/$/, '') === '/admin/accounts'
  return <div className="admin-layout dashboard-layout pf-dark" data-theme={theme}>
    <a href="#admin-main" className="ui-skip-link">Đến nội dung chính</a>
    <DashboardNavigation home="/admin" workspace="Quản trị vận hành" items={[...items]} navClass="admin-nav" accountActions={
      <button type="button" className="dashboard-theme-toggle" aria-pressed={theme === 'light'} onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}>
        <Icon name="sun" /><span>Giao diện sáng</span><span aria-hidden="true">{theme === 'light' ? 'Bật' : 'Tắt'}</span>
      </button>
    } />
    <main className="admin-content-area" id="admin-main" tabIndex={-1}>
      {demoPage && <div className="ui-admin-demo"><DemoNotice>Màn hình này dùng dữ liệu mẫu, chưa phải dữ liệu vận hành thật.</DemoNotice></div>}
      <Outlet />
    </main>
  </div>
}
