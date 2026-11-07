import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getShipments } from '../../api/endpoints/shipments'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { AppliedFilters, type AppliedFilter } from '../../components/ui/AppliedFilters'
import { DataSkeleton } from '../../components/ui/DataSkeleton'
import { formatDateTime } from '../../utils'
import { SHIPMENT_STATUS_MAP, type ShipmentStatus } from '../../types/shipment'
import type { ShipmentPage } from '../../types/shipment-api'
import { useAuth } from '../auth/useAuth'
import { shipmentErrorMessage } from './shipment-form'
import './customer-api.css'

export function CustomerShipmentsPage() {
  const { user } = useAuth()
  return <CustomerList key={user?.id ?? 'signed-out'} />
}

function CustomerList() {
  const [params, setParams] = useSearchParams()
  const trackingNumber = params.get('trackingNumber')?.trim() || undefined
  const rawStatus = params.get('status') ?? ''
  const filter = Object.hasOwn(SHIPMENT_STATUS_MAP, rawStatus) ? rawStatus as ShipmentStatus : ''
  const scope = JSON.stringify([trackingNumber, filter])
  const [paging, setPaging] = useState<{ scope: string; cursors: (string | undefined)[] }>({ scope, cursors: [undefined] })
  // A cursor belongs to its filter set, including when browser Back changes the URL.
  const cursors = paging.scope === scope ? paging.cursors : [undefined]
  const [reload, setReload] = useState(0)
  const cursor = cursors.at(-1)
  function update(filters: { status?: string; trackingNumber?: string }) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(filters)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setPaging({ scope: '', cursors: [undefined] })
    setParams(next)
  }
  function clear() { update({ status: '', trackingNumber: '' }); document.getElementById('customer-status')?.focus() }
  const applied: AppliedFilter[] = []
  if (filter) applied.push({ key: 'status', label: 'Trạng thái', value: SHIPMENT_STATUS_MAP[filter].label,
    onRemove: () => { update({ status: '' }); document.getElementById('customer-status')?.focus() } })
  if (trackingNumber) applied.push({ key: 'tracking', label: 'Mã vận đơn', value: trackingNumber,
    onRemove: () => { update({ trackingNumber: '' }); document.getElementById('customer-status')?.focus() } })
  return <div className="page-container customer-api-page">
    <div className="page-header"><div>
      <h1 className="page-title">Đơn hàng của tôi</h1>
      <p className="page-subtitle">Tra cứu thông tin và trạng thái mới nhất từ hệ thống.</p>
    </div></div>
    <form className="ui-search-form" onSubmit={event => {
      event.preventDefault()
      update({ trackingNumber: String(new FormData(event.currentTarget).get('trackingNumber') ?? '').trim() })
    }}>
      <div className="ui-search-field"><label htmlFor="customer-tracking">Mã vận đơn</label>
        <input key={trackingNumber ?? ''} id="customer-tracking" name="trackingNumber" defaultValue={trackingNumber ?? ''}
          placeholder="Nhập chính xác mã vận đơn…" spellCheck={false} autoComplete="off" /></div>
      <button type="submit" className="btn btn-outline">Tra cứu</button>
    </form>
    <div className="filter-toolbar" role="group" aria-label="Lọc đơn hàng">
      <label htmlFor="customer-status">Trạng thái</label>
      <select id="customer-status" value={filter} onChange={event => {
        update({ status: event.target.value })
      }}>
        <option value="">Tất cả trạng thái</option>
        {Object.entries(SHIPMENT_STATUS_MAP).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
      </select>
      <button type="button" className="btn btn-outline" onClick={() => setReload(value => value + 1)}>Làm mới</button>
    </div>
    <AppliedFilters filters={applied} onClear={clear} />
    <ShipmentListData key={scope + ':' + cursor + ':' + reload} status={filter || undefined} cursor={cursor}
      trackingNumber={trackingNumber}
      onClear={clear} pageNumber={cursors.length} onPrevious={() => setPaging({ scope, cursors: cursors.slice(0, -1) })}
      onNext={next => setPaging({ scope, cursors: [...cursors, next] })} onRetry={() => setReload(value => value + 1)} />
  </div>
}

function ShipmentListData({ status, cursor, trackingNumber, pageNumber, onPrevious, onNext, onRetry, onClear }: {
  status?: ShipmentStatus; cursor?: string; pageNumber: number
  trackingNumber?: string
  onPrevious: () => void; onNext: (cursor: string) => void; onRetry: () => void
  onClear: () => void
}) {
  const [page, setPage] = useState<ShipmentPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    getShipments({ status, cursor, ...(trackingNumber ? { trackingNumber } : {}) }, controller.signal).then(value => {
      if (!controller.signal.aborted) setPage(value)
    }).catch(cause => { if (!controller.signal.aborted) setError(shipmentErrorMessage(cause)) })
    return () => controller.abort()
  }, [status, cursor, trackingNumber])

  if (error) return <div className="customer-error" role="alert"><h2>Chưa tải được danh sách</h2><p>{error}</p>
    <button type="button" className="btn btn-outline" onClick={onRetry}>Thử lại</button></div>
  if (!page) return <DataSkeleton label="Đang tải danh sách đơn…" />
  const filtered = !!status || !!trackingNumber
  return <>
    <p className="ui-result-count" role="status">{page.data.length} đơn trên trang {pageNumber}{filtered ? ' theo bộ lọc hiện tại' : ''}.</p>
    {page.data.length === 0 ? <section className="customer-empty">
      <h2>{filtered ? 'Không có kết quả phù hợp' : pageNumber > 1 ? 'Không còn đơn trên trang này' : 'Chưa có đơn hàng'}</h2>
      <p>{filtered ? 'Thử bỏ bớt điều kiện hoặc kiểm tra lại mã vận đơn.' : pageNumber > 1 ? 'Quay về trang trước để tiếp tục xem đơn.' : 'Chọn “Tạo đơn mới” trên thanh điều hướng để tạo đơn giao hàng đầu tiên.'}</p>
      {filtered && <button type="button" className="btn btn-outline" onClick={onClear}>Xóa bộ lọc</button>}
    </section> : <div className="data-table-wrapper customer-orders-table" role="region" aria-label="Đơn hàng, cuộn ngang để xem đầy đủ" tabIndex={0}>
      <table className="data-table"><thead><tr><th scope="col">Mã vận đơn / Ngày tạo</th><th scope="col">Điểm lấy → Điểm giao</th>
        <th scope="col">Người nhận</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>{page.data.map(item => <tr key={item.id}>
          <td><strong className="tracking-code" translate="no">{item.trackingNumber}</strong><time className="ui-table-secondary" dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time></td>
          <td><span className="ui-order-address"><strong>Lấy:</strong> {item.pickupAddress}</span><span className="ui-order-address"><strong>Giao:</strong> {item.dropoffAddress}</span></td>
          <td>{item.recipientName}</td><td><StatusBadge status={item.status} /></td>
          <td><Link className="btn btn-outline" to={'/customer/shipments/' + item.id} aria-label={'Xem chi tiết đơn ' + item.trackingNumber}>Xem chi tiết</Link></td>
        </tr>)}</tbody></table>
    </div>}
    <nav className="customer-pagination" aria-label="Phân trang đơn hàng">
      <button type="button" className="btn btn-outline" disabled={pageNumber === 1} aria-describedby={pageNumber === 1 ? 'customer-page-boundary' : undefined} onClick={onPrevious}>Trang trước</button>
      <span>Trang {pageNumber}</span>
      <button type="button" className="btn btn-outline" data-testid="next-page" disabled={!page.pagination.hasMore} aria-describedby={!page.pagination.hasMore ? 'customer-page-boundary' : undefined}
        onClick={() => { if (page.pagination.nextCursor) onNext(page.pagination.nextCursor) }}>Trang tiếp</button>
    </nav>
    <p id="customer-page-boundary" className="ui-disabled-reason">{pageNumber === 1 ? 'Bạn đang ở trang đầu. ' : ''}{!page.pagination.hasMore ? 'Không còn trang tiếp theo trong kết quả hiện tại.' : ''}</p>
    <p className="data-note">Không phải tổng số đơn của tài khoản; số hiển thị chỉ thuộc trang hiện tại.</p>
  </>
}
