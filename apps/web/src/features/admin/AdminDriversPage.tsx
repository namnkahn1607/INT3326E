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
    <div className="page-header"><div>
      <h1 className="page-title">Tài xế</h1>
      <p className="page-subtitle">Số đơn đang xử lý và vị trí GPS gần nhất được hệ thống cung cấp.</p>
    </div><button className="btn btn-outline" type="button" disabled={state.loading} onClick={state.refresh}>Làm mới</button></div>
    <AdminPageFeedback loading={state.loading} error={state.error} empty={state.page?.data.length === 0} label="tài xế" onRetry={state.refresh} />
    {state.page && <>
      {!!state.page.data.length && <div className="data-table-wrapper" role="region" aria-label="Danh sách tài xế, cuộn ngang để xem đầy đủ" tabIndex={0}>
        <table className="data-table"><thead><tr><th>Tài xế</th><th className="ui-numeric">Đơn đang xử lý</th><th>Thông tin vị trí</th><th>Tiếp nhận lúc</th></tr></thead>
          <tbody>{state.page.data.map(driver => <tr key={driver.id}>
            <td><strong>{driver.name}</strong><p className="admin-api-id">{driver.id}</p></td>
            <td className="ui-numeric"><strong>{driver.activeShipmentCount}</strong></td>
            <td><span className="admin-location-state" data-gps={driver.currentLocation === null ? 'missing' : driver.isLocationStale ? 'stale' : 'fresh'}>{driver.currentLocation === null ? 'Chưa có vị trí được phép hiển thị' : driver.isLocationStale ? 'Vị trí đã cũ' : 'Có vị trí gần đây'}</span></td>
            <td>{formatDateTime(driver.lastLocationUpdatedAt)}</td>
          </tr>)}</tbody>
        </table></div>}
      <AdminPager label="tài xế" number={state.number} hasMore={state.page.pagination.hasMore} onPrevious={state.previous} onNext={state.next} />
    </>}
  </div>
}
