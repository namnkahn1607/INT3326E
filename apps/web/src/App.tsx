import { Navigate, Route, Routes } from 'react-router'
import { AdminLayout } from './layouts/AdminLayout'
import { CustomerLayout } from './layouts/CustomerLayout'
import { DriverLayout } from './layouts/DriverLayout'

import { NotFoundPage } from './components/ui/NotFoundPage'

// Feature Customer
import {
  CustomerCreatePage,
  CustomerHistoryPage,
  CustomerNotificationsPage,
  CustomerOverviewPage,
  CustomerShipmentsPage,
} from './features/customer'

// Feature Admin
import {
  AdminAccountsPage,
  AdminAssignmentPage,
  AdminDriversPage,
  AdminLiveMapPage,
  AdminOverviewPage,
  AdminShipmentsPage,
} from './features/admin'

// Feature Driver
import { DriverPlaceholderPage } from './features/driver'

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
        <Route path="live-map" element={<AdminLiveMapPage />} />
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
