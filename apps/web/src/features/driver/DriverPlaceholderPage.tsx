import { GpsEmitter } from './GpsEmitter'

export function DriverPlaceholderPage() {
  return (
    <div style={{ padding: '32px 20px', textAlign: 'center' }}>
      <h2>Cổng Tài xế (Driver)</h2>
      <p style={{ color: '#64748b', marginTop: '8px' }}>
        Khung route ban đầu dành cho Thành viên 4 phát triển giao diện Driver.
      </p>
      <GpsEmitter driverId="demo-driver-1" />
    </div>
  )
}
