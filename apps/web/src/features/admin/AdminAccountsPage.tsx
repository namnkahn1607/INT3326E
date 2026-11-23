import { useCallback } from 'react'
import { getCustomers } from '../../api/endpoints/customers'
import { useAuth } from '../auth/useAuth'
import { AdminPageFeedback, AdminPager } from './AdminPageFeedback'
import { useAdminPage } from './useAdminPage'
import './admin-api.css'

export function AdminAccountsPage() {
  const { user, loading } = useAuth()
  if (loading) return <p role="status">Đang kiểm tra phiên đăng nhập.</p>
  if (!user || user.role !== 'ADMIN') return <p role="alert">Cần đăng nhập bằng tài khoản Admin.</p>
  return <CustomerDirectory key={user.id} />
}

function CustomerDirectory() {
  const load = useCallback((cursor: string | undefined, signal: AbortSignal) => getCustomers(cursor, signal), [])
  const state = useAdminPage(load, 'customers')
  return <div className="admin-page admin-api-page admin-accounts-page">
    <div className="page-header"><h1 className="page-title">Tài khoản khách hàng</h1>
      <button className="btn btn-outline" type="button" disabled={state.loading} onClick={state.refresh}>Làm mới</button>
    </div>
    <AdminPageFeedback loading={state.loading} error={state.error} empty={state.page?.data.length === 0}
      label="khách hàng" onRetry={state.refresh} />
    {state.page && <>
      {!!state.page.data.length && <div className="data-table-wrapper" role="region" aria-label="Danh sách khách hàng, cuộn ngang để xem đầy đủ" tabIndex={0}>
        <table className="data-table"><thead><tr><th>Khách hàng</th><th>Email</th><th>Số điện thoại</th></tr></thead>
          <tbody>{state.page.data.map(customer => <tr key={customer.id}>
            <td><strong>{customer.name}</strong><p className="admin-api-id" translate="no">{customer.id}</p></td>
            <td>{customer.email}</td><td>{customer.phone ?? '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <AdminPager label="khách hàng" number={state.number} hasMore={state.page.pagination.hasMore}
        onPrevious={state.previous} onNext={state.next} />
    </>}
  </div>
}
