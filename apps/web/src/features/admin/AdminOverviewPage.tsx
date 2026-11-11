import { useCallback } from 'react'
import { Link } from 'react-router'
import { getShipments } from '../../api/endpoints/shipments'
import { Icon } from '../../components/ui/Icon'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { formatDateTime } from '../../utils'
import { useAuth } from '../auth/useAuth'
import { AdminPageFeedback } from './AdminPageFeedback'
import { useAdminPage } from './useAdminPage'
import { AdminOverviewCharts } from './AdminOverviewCharts'
import './admin-api.css'

export function AdminOverviewPage() {
  const { user } = useAuth()
  return <OperationsOverview key={user?.id ?? 'signed-out'} />
}

function OperationsOverview() {
  const load = useCallback((_: string | undefined, signal: AbortSignal) => getShipments({ limit: 20 }, signal), [])
  const state = useAdminPage(load, 'overview')
  const orders = state.page?.data
  const metrics = orders ? [
    { label: 'Đơn gần đây', value: orders.length, icon: 'box' },
    { label: 'Chờ phân công', value: orders.filter(item => item.status === 'CREATED').length, icon: 'clock' },
    { label: 'Đang vận chuyển', value: orders.filter(item => ['ASSIGNED', 'PICKED_UP'].includes(item.status)).length, icon: 'truck' },
    { label: 'Đã giao', value: orders.filter(item => item.status === 'DELIVERED').length, icon: 'check' },
  ] as const : []
  return <div className="admin-page admin-api-page operations-overview">
    <div className="page-header"><div>
      <h1 className="page-title">Tổng quan vận hành</h1>
      <p className="page-subtitle">Đơn hàng gần đây</p></div>
      <div className="admin-header-actions"><button type="button" className="btn btn-outline" disabled={state.loading} onClick={state.refresh}>Làm mới</button>
        <Link to="/admin/assignment" className="btn btn-primary">Phân công tài xế<Icon name="arrow" /></Link></div>
    </div>
    <AdminPageFeedback loading={state.loading} error={state.error} empty={orders?.length === 0} label="tổng quan đơn hàng" onRetry={state.refresh} />
    {orders && <>
      <section className="dashboard-metrics" aria-label="Số liệu của tối đa 20 đơn gần nhất" title="Số liệu của tối đa 20 đơn gần nhất">
        {metrics.map(metric => <article className="dashboard-metric" key={metric.label}>
          <div><span>{metric.label}</span><Icon name={metric.icon} /></div><strong>{metric.value}</strong>
        </article>)}
      </section>
      <AdminOverviewCharts orders={orders} />
      <section className="dashboard-panel operations-recent" aria-labelledby="recent-orders-title">
        <div className="dashboard-panel-heading"><h2 id="recent-orders-title">Đơn gần đây</h2><Link to="/admin/shipments">Tất cả đơn<Icon name="arrow" /></Link></div>
        {orders.length > 0 && <div className="data-table-wrapper" role="region" aria-label="Đơn hàng vừa tải, cuộn ngang để xem đầy đủ" tabIndex={0}>
          <table className="data-table"><thead><tr><th>Mã đơn</th><th>Người nhận</th><th>Trạng thái</th><th>Tạo lúc</th></tr></thead>
            <tbody>{orders.slice(0, 7).map(item => <tr key={item.id}><td><Link className="dashboard-order-link" to={'/admin/shipments/' + encodeURIComponent(item.id)}>{item.trackingNumber}</Link></td>
              <td>{item.recipientName}</td><td><StatusBadge status={item.status} /></td><td><time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time></td></tr>)}</tbody></table>
        </div>}
      </section>
    </>}
  </div>
}
