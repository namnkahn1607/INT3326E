import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getShipments } from '../../api/endpoints/shipments'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { SHIPMENT_STATUS_MAP, type ShipmentStatus } from '../../types/shipment'
import { formatDateTime } from '../../utils'
import { useAuth } from '../auth/useAuth'
import { AdminPageFeedback, AdminPager } from './AdminPageFeedback'
import { useAdminPage } from './useAdminPage'
import './admin-api.css'

export function AdminShipmentsPage() {
  const { user } = useAuth()
  return <ShipmentList key={user?.id ?? 'signed-out'} />
}

function ShipmentList() {
  const [params, setParams] = useSearchParams()
  const rawStatus = params.get('status') ?? ''
  const status = Object.hasOwn(SHIPMENT_STATUS_MAP, rawStatus) ? rawStatus as ShipmentStatus : undefined
  const trackingNumber = params.get('trackingNumber')?.trim() || undefined
  const load = useCallback((cursor: string | undefined, signal: AbortSignal) =>
    getShipments({ status, trackingNumber, cursor }, signal), [status, trackingNumber])
  const state = useAdminPage(load, JSON.stringify([status, trackingNumber]))
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next)
  }
  return <div className="admin-page admin-api-page">
    <div className="page-header"><div>
      <span className="admin-page-kicker">VẬN HÀNH</span>
      <h1 className="page-title">Đơn hàng</h1>
      <p className="page-subtitle">Dữ liệu từ API. Chọn đơn để xem chi tiết hoặc phân công trước khi lấy hàng.</p>
    </div><Link to="/admin/assignment" className="btn btn-primary">Phân công tài xế</Link></div>
    <form className="admin-controls-card admin-api-controls" onSubmit={event => { event.preventDefault(); filter('trackingNumber', String(new FormData(event.currentTarget).get('trackingNumber') ?? '').trim()) }}>
      <div><label htmlFor="admin-order-search">Mã vận đơn chính xác</label>
        <input key={trackingNumber ?? ''} id="admin-order-search" name="trackingNumber" defaultValue={trackingNumber ?? ''}
          autoComplete="off" spellCheck={false} placeholder="Nhập đầy đủ mã PF…" /></div>
      <div><label htmlFor="admin-order-status">Trạng thái</label>
        <select id="admin-order-status" value={status ?? ''} onChange={event => filter('status', event.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(SHIPMENT_STATUS_MAP).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
        </select></div>
      <button className="btn btn-outline" type="submit">Tra cứu</button>
      <button className="btn btn-outline" type="button" onClick={() => setParams({})}>Xóa bộ lọc</button>
      <button className="btn btn-outline" type="button" disabled={state.loading} onClick={state.refresh}>Làm mới</button>
    </form>
    <AdminPageFeedback loading={state.loading} error={state.error} empty={state.page?.data.length === 0} label="đơn hàng" onRetry={state.refresh} />
    {state.page && <>
      <p className="ui-result-count" role="status">{state.page.data.length} đơn trong trang đang hiển thị{trackingNumber ? ' · Mã: ' + trackingNumber : ''}.</p>
      {!!state.page.data.length && <div className="data-table-wrapper" role="region" aria-label="Đơn hàng, cuộn ngang để xem đầy đủ" tabIndex={0}>
        <table className="data-table"><thead><tr>
          <th>Mã đơn</th><th>Điểm lấy / giao</th><th>Người nhận</th><th>Trạng thái</th><th>Tài xế hiện hành</th><th>Tạo lúc</th><th>Thao tác</th>
        </tr></thead><tbody>{state.page.data.map(item => <tr key={item.id}>
          <td><strong>{item.trackingNumber}</strong></td>
          <td><p>Lấy: {item.pickupAddress}</p><p>Giao: {item.dropoffAddress}</p></td>
          <td>{item.recipientName}</td><td><StatusBadge status={item.status} /></td>
          <td className="admin-api-id">{item.driverId ?? 'Chưa phân công'}</td>
          <td><time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time></td>
          <td><Link className="action-btn action-primary" to={'/admin/assignment?shipmentId=' + encodeURIComponent(item.id)}>
            {item.status === 'CREATED' ? 'Phân công' : item.status === 'ASSIGNED' ? 'Xem / gán lại' : 'Xem chi tiết'}
          </Link></td>
        </tr>)}</tbody></table>
      </div>}
      <AdminPager label="đơn hàng" number={state.number} hasMore={state.page.pagination.hasMore} onPrevious={state.previous} onNext={state.next} />
    </>}
  </div>
}
