import { useId } from 'react'
import type { ShipmentResponse } from '../../types/shipment-api'
import { overviewChartData } from './overview-chart-data'

const percentage = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

export function AdminOverviewCharts({ orders }: { orders: ShipmentResponse[] }) {
  const id = useId()
  const { days, statuses } = overviewChartData(orders)
  const maximum = Math.max(1, ...days.map(day => day.count))
  const ticks = [...new Set([0, Math.ceil(maximum / 2), maximum])]
  const slot = 520 / Math.max(days.length, 1)
  const width = Math.min(36, slot * .55)
  const radius = 66, circumference = 2 * Math.PI * radius
  const segments = statuses.map((item, index) => ({
    ...item,
    length: item.count / Math.max(orders.length, 1) * circumference,
    start: statuses.slice(0, index).reduce((sum, previous) => sum + previous.count, 0) / Math.max(orders.length, 1) * circumference,
  }))
  return <div className="admin-overview-charts" title="Biểu đồ của tối đa 20 đơn gần nhất">
    <section className="dashboard-panel admin-daily-chart" aria-labelledby={id + '-daily'}>
      <div className="dashboard-panel-heading"><div>
        <h2 id={id + '-daily'}>Đơn theo ngày tạo</h2><p>Giờ Việt Nam</p>
      </div></div>
      {orders.length ? <>
        <svg className="admin-bar-chart" viewBox="0 0 580 224" role="img" aria-labelledby={id + '-bars'}>
          <title id={id + '-bars'}>Số đơn theo ngày tạo. Bảng số liệu chi tiết ở ngay sau biểu đồ.</title>
          {ticks.map(tick => {
            const y = 180 - tick / maximum * 144
            return <g key={tick}><line x1="36" x2="560" y1={y} y2={y} /><text x="24" y={y + 4} textAnchor="end">{tick}</text></g>
          })}
          {days.map((day, index) => {
            const x = 38 + slot * (index + .5), height = day.count / maximum * 144
            const showLabel = index % Math.ceil(days.length / 6) === 0 || index === days.length - 1
            return <g key={day.date}>
              <rect x={x - width / 2} y={180 - height} width={width} height={height} rx="3"><title>{day.date}: {day.count} đơn</title></rect>
              {days.length <= 8 && <text x={x} y={170 - height} textAnchor="middle" className="admin-bar-value">{day.count}</text>}
              {showLabel && <text x={x} y="207" textAnchor="middle">{day.label}</text>}
            </g>
          })}
        </svg>
        <details className="admin-chart-data"><summary>Xem số liệu theo ngày</summary>
          <dl>{days.map(day => <div key={day.date}><dt><time dateTime={day.date}>{day.label}/{day.date.slice(0, 4)}</time></dt><dd>{day.count} đơn</dd></div>)}</dl>
        </details>
      </> : <p className="admin-chart-empty">Chưa có đơn để hiển thị biểu đồ.</p>}
    </section>
    <section className="dashboard-panel admin-status-chart" aria-labelledby={id + '-statuses'}>
      <div className="dashboard-panel-heading"><h2 id={id + '-statuses'}>Trạng thái đơn hàng</h2></div>
      <div className="admin-status-chart-body">
        <div className="admin-donut">
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <circle className="admin-donut-track" cx="80" cy="80" r={radius} />
            {segments.filter(item => item.count > 0).map(item => <circle key={item.status} data-status={item.status} cx="80" cy="80" r={radius}
              strokeDasharray={`${item.length} ${circumference - item.length}`} strokeDashoffset={-item.start} transform="rotate(-90 80 80)" />)}
          </svg>
          <div><strong>{orders.length}</strong><span>đơn gần đây</span></div>
        </div>
        <ul className="admin-chart-legend">{statuses.map(item => <li key={item.status}>
          <span className="admin-chart-key" data-status={item.status} aria-hidden="true" />
          <span>{item.label}</span><strong>{item.count}</strong>
          <span className="admin-chart-percent">{percentage.format(orders.length ? item.count / orders.length * 100 : 0)}%</span>
        </li>)}</ul>
      </div>
    </section>
  </div>
}
