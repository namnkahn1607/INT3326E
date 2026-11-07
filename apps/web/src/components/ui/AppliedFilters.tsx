export interface AppliedFilter {
  key: string
  label: string
  value: string
  onRemove: () => void
}

export function AppliedFilters({ filters, onClear }: { filters: AppliedFilter[]; onClear: () => void }) {
  if (!filters.length) return null
  return <div className="ui-applied-filters" role="group" aria-label="Bộ lọc đang áp dụng">
    <span className="ui-filter-caption">Đang lọc:</span>
    {filters.map(filter => <button key={filter.key} type="button" className="ui-filter-token"
      aria-label={`Bỏ lọc ${filter.label}: ${filter.value}`} onClick={filter.onRemove}>
      <span>{filter.label}: <strong>{filter.value}</strong></span><span aria-hidden="true">×</span>
    </button>)}
    <button type="button" className="ui-clear-filters" onClick={onClear}>Xóa tất cả</button>
  </div>
}
