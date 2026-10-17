import { Link, Navigate, Outlet, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import type { UserProfile } from './context'
import { ROLE_HOME } from './session'
import { useAuth } from './useAuth'

export function ProtectedRoute({ role, children }: { role: UserProfile['role']; children?: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p role="status">Đang kiểm tra phiên đăng nhập…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== role) return <main className="auth-card">
    <h1>Không có quyền truy cập</h1>
    <p>Tài khoản của bạn không được sử dụng khu vực này.</p>
    <Link to={ROLE_HOME[user.role]}>Về trang của tôi</Link>
  </main>
  return children ?? <Outlet />
}

export function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <p role="status">Đang kiểm tra phiên đăng nhập…</p>
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />
}
