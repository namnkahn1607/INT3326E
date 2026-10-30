import { Outlet, useLocation } from 'react-router'
import { DashboardNavigation } from '../components/ui/DashboardNavigation'
import { DemoNotice } from '../components/ui/DemoNotice'

const items = [
  { path: '/admin', label: 'Tổng quan', icon: 'grid', end: true },
  { path: '/admin/shipments', label: 'Đơn hàng', icon: 'box' },
  { path: '/admin/assignment', label: 'Phân công', icon: 'send' },
  { path: '/admin/live-map', label: 'Bản đồ trực tiếp', icon: 'pin' },
  { path: '/admin/drivers', label: 'Tài xế', icon: 'truck' },
  { path: '/admin/accounts', label: 'Tài khoản', icon: 'users' },
] as const

export function AdminLayout() {
  const { pathname } = useLocation()
  const demoPage = ['/admin/live-map', '/admin/accounts'].includes(pathname.replace(/\/$/, ''))
  return <div className="admin-layout dashboard-layout pf-dark">
    <a href="#admin-main" className="ui-skip-link">Đến nội dung chính</a>
    <DashboardNavigation home="/admin" workspace="Quản trị vận hành" items={[...items]} navClass="admin-nav" />
    <main className="admin-content-area" id="admin-main" tabIndex={-1}>
      {demoPage && <div className="ui-admin-demo"><DemoNotice>Màn hình này dùng dữ liệu mẫu, chưa phải dữ liệu vận hành thật.</DemoNotice></div>}
      <Outlet />
    </main>
  </div>
}
