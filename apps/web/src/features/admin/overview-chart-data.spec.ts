import { describe, expect, it } from 'vitest'
import { shipmentFixture } from '../customer/shipment-fixture'
import type { ShipmentResponse } from '../../types/shipment-api'
import { overviewChartData } from './overview-chart-data'

describe('Admin overview chart aggregation', () => {
  it('groups all loaded orders by Vietnam date, sorts dates, and preserves counts', () => {
    const orders: ShipmentResponse[] = [
      { ...shipmentFixture, status: 'DELIVERED', createdAt: '2026-10-31T17:01:00Z' },
      { ...shipmentFixture, status: 'CREATED', createdAt: '2026-10-31T16:59:00Z' },
      { ...shipmentFixture, status: 'ASSIGNED', createdAt: '2026-11-01T03:00:00Z' },
    ]
    const data = overviewChartData(orders)
    expect(data.days).toEqual([
      { date: '2026-10-31', count: 1, label: '31/10' },
      { date: '2026-11-01', count: 2, label: '01/11' },
    ])
    expect(data.days.reduce((sum, day) => sum + day.count, 0)).toBe(orders.length)
    expect(data.statuses.map(item => item.count)).toEqual([1, 1, 0, 1, 0])
    expect(data.statuses.reduce((sum, item) => sum + item.count, 0)).toBe(orders.length)
  })
  it('does not invent dates or activity when no orders were loaded', () => {
    const data = overviewChartData([])
    expect(data.days).toEqual([])
    expect(data.statuses.every(item => item.count === 0)).toBe(true)
  })
})
