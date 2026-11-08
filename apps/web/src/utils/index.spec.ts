import { describe, expect, it } from 'vitest'
import { formatCurrencyVND, formatDateTime, formatNumber } from './index'

describe('Vietnamese presentation formats', () => {
  it('distinguishes zero from unavailable numeric values', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(null)).toBe('—')
    expect(formatNumber(undefined)).toBe('—')
    expect(formatNumber(Number.NaN)).toBe('—')
    expect(formatNumber(1.25)).toBe('1,25')
    expect(formatCurrencyVND(0)).toMatch(/^0/)
    expect(formatCurrencyVND(null)).toBe('—')
  })
  it('does not render Invalid Date or raw missing values', () => {
    expect(formatDateTime('bad-date')).toBe('—')
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('2026-10-18T10:00:00.000Z')).toContain('18/10/2026')
  })
})
