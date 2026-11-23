import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/client'
import { getNotifications } from '../../api/endpoints/notifications'
import { DataSkeleton } from '../../components/ui/DataSkeleton'
import { usePolledResource } from '../../hooks/usePolledResource'
import { formatDateTime } from '../../utils'
import { useAuth } from '../auth/useAuth'
import { CustomerHomeIcon } from './CustomerHomeIcon'
import './customer-api.css'

export function CustomerNotificationsPage() {
  const { user, loading } = useAuth()
  if (loading) return <DataSkeleton label="Đang kiểm tra phiên đăng nhập." />
  if (!user || user.role !== 'CUSTOMER') return <p role="alert">Cần đăng nhập bằng tài khoản Customer.</p>
  return <Notifications key={user.id} />
}

function notificationError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.status === 403) return 'Tài khoản không có quyền xem thông báo này.'
    if (error.code === 'USER_NOT_PROVISIONED') return 'Tài khoản chưa được liên kết dữ liệu nghiệp vụ.'
    if (error.code === 'INVALID_RESPONSE') return 'Máy chủ trả thông báo chưa đúng định dạng.'
  }
  return 'Chưa tải được thông báo. Kiểm tra kết nối và thử lại.'
}

function Notifications() {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const cursor = cursors.at(-1)
  const load = useCallback((signal: AbortSignal) => getNotifications(cursor, signal), [cursor])
  const state = usePolledResource(load, JSON.stringify([cursor]), 10_000)
  const page = state.data
  return <div className="page-container customer-api-page customer-notifications-page">
    <div className="page-header"><h1 className="page-title">Thông báo</h1>
      <button className="btn btn-outline" type="button" disabled={state.loading || state.refreshing} onClick={state.refresh}>
        {state.refreshing ? 'Đang cập nhật…' : 'Làm mới'}
      </button>
    </div>
    {state.loading && <DataSkeleton label="Đang tải thông báo." />}
    {state.error && <div className="notification-error" role="alert"><p>{notificationError(state.error)}</p>
      <button className="btn btn-outline" type="button" onClick={state.refresh}>Thử lại</button></div>}
    {page && <>
      {page.data.length === 0 ? <p role="status">Chưa có thông báo.</p> :
        <ul className="notifications-list" aria-label="Thông báo đơn hàng" aria-busy={state.refreshing}>
          {page.data.map(item => <li key={item.id} className="notification-item">
            <div className="notification-icon" aria-hidden="true"><CustomerHomeIcon name="box" /></div>
            <div className="notification-body"><div className="notification-top">
              <h2><Link to={'/customer/shipments/' + item.shipmentId}>{item.title}</Link></h2>
              <time className="notification-time" dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
            </div><p>{item.body}</p>
              <Link className="notification-order" to={'/customer/shipments/' + item.shipmentId} translate="no">{item.trackingNumber}</Link>
            </div>
          </li>)}
        </ul>}
    </>}
    {cursors.length > 1 || page?.pagination.hasMore ? <nav className="customer-pagination" aria-label="Phân trang thông báo">
      <button className="btn btn-outline" type="button" disabled={cursors.length === 1 || state.refreshing}
        onClick={() => setCursors(values => values.slice(0, -1))}>Trang trước</button>
      <button className="btn btn-outline" type="button" disabled={!page?.pagination.hasMore || state.refreshing}
        onClick={() => { if (page?.pagination.nextCursor) setCursors(values => [...values, page.pagination.nextCursor!]) }}>Trang sau</button>
    </nav> : null}
  </div>
}
