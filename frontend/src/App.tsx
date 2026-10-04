import { Navigate, Route, Routes } from 'react-router'
import { AdminLayout } from './layouts/AdminLayout'
import { CustomerLayout } from './layouts/CustomerLayout'
import { DriverLayout } from './layouts/DriverLayout'

import { NotFoundPage } from './pages/common/NotFoundPage'

// Pages Customer (Tuấn phụ trách)
import { CustomerCreatePage } from './pages/customer/CustomerCreatePage'
import { CustomerHistoryPage } from './pages/customer/CustomerHistoryPage'
import { CustomerNotificationsPage } from './pages/customer/CustomerNotificationsPage'
import { CustomerOverviewPage } from './pages/customer/CustomerOverviewPage'
import { CustomerShipmentsPage } from './pages/customer/CustomerShipmentsPage'

// Pages Admin & Dispatcher (Tuấn phụ trách)
import { AdminAccountsPage } from './pages/admin/AdminAccountsPage'
import { AdminAssignmentPage } from './pages/admin/AdminAssignmentPage'
import { AdminDriversPage } from './pages/admin/AdminDriversPage'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminShipmentsPage } from './pages/admin/AdminShipmentsPage'

// Khung tối thiểu Driver (Dành cho Thành viên 4)
import { DriverPlaceholderPage } from './pages/driver/DriverPlaceholderPage'

export default function App() {
  return (
    <Routes>
      {/* Mặc định chuyển hướng sang cổng khách hàng */}
      <Route path="/" element={<Navigate to="/customer" replace />} />

      {/* Cổng Khách hàng (Customer) - Tuấn phụ trách */}
      <Route path="/customer" element={<CustomerLayout />}>
        <Route index element={<CustomerOverviewPage />} />
        <Route path="create" element={<CustomerCreatePage />} />
        <Route path="shipments" element={<CustomerShipmentsPage />} />
        <Route path="history" element={<CustomerHistoryPage />} />
        <Route path="notifications" element={<CustomerNotificationsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Cổng Quản trị & Điều phối (Admin & Dispatcher) - Tuấn phụ trách */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="shipments" element={<AdminShipmentsPage />} />
        <Route path="assignment" element={<AdminAssignmentPage />} />
        <Route path="drivers" element={<AdminDriversPage />} />
        <Route path="accounts" element={<AdminAccountsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Khung tối thiểu Cổng Tài xế (Driver) - Thành viên 4 phụ trách */}
      <Route path="/driver" element={<DriverLayout />}>
        <Route index element={<DriverPlaceholderPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Trang 404 chung */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}