import { useCallback } from 'react'
import { getDrivers } from '../../api/endpoints/drivers'
import { useAuth } from '../auth/useAuth'
import { formatDateTime } from '../../utils'
import { AdminPageFeedback, AdminPager } from './AdminPageFeedback'
import { useAdminPage } from './useAdminPage'
import './admin-api.css'

export function AdminDriversPage() {
  const { user } = useAuth()
  return <DriverDirectory key={user?.id ?? 'signed-out'} />
}

function DriverDirectory() {
  const load = useCallback((cursor: string | undefined, signal: AbortSignal) => getDrivers({ cursor }, signal), [])
  const state = useAdminPage(load, 'drivers')
  return <div className="admin-page admin-api-page">
    <div className="page-header"><div><span className="admin-page-kicker">ĐỘI NGŨ GIAO NHẬN</span>
      <h1 className="page-title">Tài xế</h1>
      <p className="page-subtitle">Danh sách từ API. Số đơn active không phải trạng thái online; tài xế có thể nhận nhiều đơn.</p>
    </div><button className="btn btn-outline" type="button" disabled={state.loading} onClick={state.refresh}>Làm mới</button></div>
    <AdminPageFeedback loading={state.loading} error={state.error} empty={state.page?.data.length === 0} label="tài xế" onRetry={state.refresh} />
    {state.page && <>
      <p className="ui-result-count" role="status">{state.page.data.length} tài xế trong trang đang hiển thị, không phải tổng đội xe.</p>
      {!!state.page.data.length && <div className="data-table-wrapper" role="region" aria-label="Danh sách tài xế, cuộn ngang để xem đầy đủ" tabIndex={0}>
        <table className="data-table"><thead><tr><th>Tài xế</th><th>Đơn active</th><th>Thông tin vị trí</th><th>Server tiếp nhận lúc</th></tr></thead>
          <tbody>{state.page.data.map(driver => <tr key={driver.id}>
            <td><strong>{driver.name}</strong><p className="admin-api-id">{driver.id}</p></td>
            <td>{driver.activeShipmentCount}</td>
            <td>{driver.currentLocation === null ? 'Chưa có vị trí được phép hiển thị' : driver.isLocationStale ? 'Vị trí đã cũ' : 'Có vị trí gần đây'}</td>
            <td>{formatDateTime(driver.lastLocationUpdatedAt)}</td>
          </tr>)}</tbody>
        </table></div>}
      <AdminPager label="tài xế" number={state.number} hasMore={state.page.pagination.hasMore} onPrevious={state.previous} onNext={state.next} />
    </>}
  </div>
}
