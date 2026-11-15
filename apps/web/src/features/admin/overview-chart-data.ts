import { SHIPMENT_STATUS_MAP, type ShipmentStatus } from '../../types/shipment'
import type { ShipmentResponse } from '../../types/shipment-api'

const vietnamDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function overviewChartData(orders: readonly ShipmentResponse[]) {
  const dates = new Map<string, number>()
  for (const order of orders) {
    const parts = vietnamDate.formatToParts(new Date(order.createdAt))
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)!.value
    const key = `${part('year')}-${part('month')}-${part('day')}`
    dates.set(key, (dates.get(key) ?? 0) + 1)
  }
  return {
    days: [...dates].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({
      date, count, label: date.slice(8) + '/' + date.slice(5, 7),
    })),
    statuses: (Object.keys(SHIPMENT_STATUS_MAP) as ShipmentStatus[]).map(status => ({
      status, label: SHIPMENT_STATUS_MAP[status].label,
      count: orders.filter(order => order.status === status).length,
    })),
  }
}
