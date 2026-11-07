// Match the API and PostgreSQL char_length, which count Unicode code points.
export function characterCount(value: string): number {
  return [...value].length
}

/**
 * Format currency in VND.
 */
export function formatCurrencyVND(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

/**
 * Format date string into Vietnamese locale string.
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString || !Number.isFinite(Date.parse(isoString))) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString))
}

export function formatNumber(value: number | null | undefined, maximumFractionDigits = 2): string {
  return value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits }).format(value)
}
