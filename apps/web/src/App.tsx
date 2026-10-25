import { Route, Routes } from 'react-router'
import { lazy, Suspense } from 'react'
import { AdminLayout } from './layouts/AdminLayout'
import { CustomerLayout } from './layouts/CustomerLayout'
import { DriverLayout } from './layouts/DriverLayout'

import { NotFoundPage } from './components/ui/NotFoundPage'
import { LoginPage } from './features/auth/LoginPage'
import { HomeRedirect, ProtectedRoute } from './features/auth/ProtectedRoute'
import { StartupExperience } from './features/auth/StartupExperience'

// Feature Customer
import {
  CustomerCreatePage,
  CustomerHistoryPage,
  CustomerNotificationsPage,
  CustomerOverviewPage,
  CustomerShipmentsPage,
  CustomerShipmentDetailPage,
} from './features/customer'

// Feature Admin
import { AdminAccountsPage } from './features/admin/AdminAccountsPage'
import { AdminAssignmentPage } from './features/admin/AdminAssignmentPage'
import { AdminDriversPage } from './features/admin/AdminDriversPage'
import { AdminOverviewPage } from './features/admin/AdminOverviewPage'
import { AdminShipmentsPage } from './features/admin/AdminShipmentsPage'
const AdminLiveMapPage = lazy(() => import('./features/admin/AdminLiveMapPage').then(module => ({ default: module.AdminLiveMapPage })))

// Feature Driver
import { DriverPlaceholderPage } from './features/driver'

export default function App() {
  return (
    <StartupExperience><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomeRedirect />} />

      {/* Cổng Khách hàng (Customer) - Tuấn phụ trách */}
      <Route path="/customer" element={<ProtectedRoute role="CUSTOMER"><CustomerLayout /></ProtectedRoute>}>
        <Route index element={<CustomerOverviewPage />} />
        <Route path="create" element={<CustomerCreatePage />} />
        <Route path="shipments" element={<CustomerShipmentsPage />} />
        <Route path="shipments/:id" element={<CustomerShipmentDetailPage />} />
        <Route path="history" element={<CustomerHistoryPage />} />
        <Route path="notifications" element={<CustomerNotificationsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Cổng Quản trị & Điều phối (Admin) - Tuấn phụ trách */}
      <Route path="/admin" element={<ProtectedRoute role="ADMIN"><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="shipments" element={<AdminShipmentsPage />} />
        <Route path="assignment" element={<AdminAssignmentPage />} />
        <Route path="live-map" element={<Suspense fallback={<p role="status">Đang mở bản đồ…</p>}><AdminLiveMapPage /></Suspense>} />
        <Route path="drivers" element={<AdminDriversPage />} />
        <Route path="accounts" element={<AdminAccountsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Khung tối thiểu Cổng Tài xế (Driver) - Thành viên 4 phụ trách */}
      <Route path="/driver" element={<ProtectedRoute role="DRIVER"><DriverLayout /></ProtectedRoute>}>
        <Route index element={<DriverPlaceholderPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Trang 404 chung */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes></StartupExperience>
  )
}
