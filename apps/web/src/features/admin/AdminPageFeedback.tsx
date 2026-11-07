import { adminErrorMessage } from './admin-errors'
import { DataSkeleton } from '../../components/ui/DataSkeleton'

export function AdminPageFeedback({ loading, error, empty, label, onRetry }: {
  loading: boolean; error?: unknown; empty?: boolean; label: string; onRetry: () => void
}) {
  if (loading) return <DataSkeleton label={`Đang tải ${label}…`} />
  if (error) return <section className="admin-api-message admin-api-error" role="alert">
    <h3>Chưa tải được {label}</h3><p>{adminErrorMessage(error)}</p>
    <button className="btn btn-outline" type="button" onClick={onRetry}>Tải lại {label}</button>
  </section>
  if (empty) return <p className="admin-api-message" role="status">Không có {label} trong trang hoặc bộ lọc này.</p>
  return null
}

export function AdminPager({ number, hasMore, disabled, label, onPrevious, onNext }: {
  number: number; hasMore: boolean; disabled?: boolean; label: string; onPrevious: () => void; onNext: () => void
}) {
  return <nav className="admin-api-pager" aria-label={`Phân trang ${label}`}>
    <button className="btn btn-outline" type="button" disabled={disabled || number === 1} onClick={onPrevious}>Trang trước</button>
    <span>Trang {number}</span>
    <button className="btn btn-outline" type="button" disabled={disabled || !hasMore} onClick={onNext}>Trang sau</button>
  </nav>
}
