import { useEffect, useRef, useState } from 'react'
import { sendLocation } from '../../api/endpoints/locations'
import { useAuth } from '../auth/useAuth'
import { GpsEmitter } from './GpsEmitter'
import { GpsDeliveryQueue, INITIAL_GPS_DELIVERY } from './gps-delivery'
import { DriverShipments } from './DriverShipments'
import './driver.css'

function DriverDashboard({ accountId, displayName, email, token }: { accountId: string; displayName: string; email: string; token: string | null }) {
  const [deliveryState, setDeliveryState] = useState(INITIAL_GPS_DELIVERY)
  const delivery = useRef<GpsDeliveryQueue | null>(null)
  const accountToken = useRef(token)
  const { sending, acceptedCount, lastAccepted, error, queuedCount, discardedCount, online } = deliveryState

  useEffect(() => { accountToken.current = token }, [token])
  useEffect(() => {
    // A buffered sample must never read the global token of a newly signed-in account.
    const queue = new GpsDeliveryQueue(setDeliveryState, (event, signal) => sendLocation(event, signal, accountToken.current))
    delivery.current = queue
    return () => { queue.dispose(); delivery.current = null }
  }, [])

  return <div className="driver-dashboard">
    <section className="driver-welcome" aria-labelledby="driver-title">
      <p className="driver-eyebrow">CỔNG TÀI XẾ</p>
      <h1 id="driver-title">Xin chào, {displayName || email || accountId}</h1>
      <p>{email || accountId} · Tài xế</p>
    </section>

    <DriverShipments />

    <section className="driver-panel" aria-labelledby="driver-gps-title">
      <h2 id="driver-gps-title">Gửi vị trí GPS</h2>
      <p>Chọn vị trí trình duyệt để gửi vị trí thiết bị, hoặc Mô phỏng để thử theo tuyến mẫu.</p>
      <GpsEmitter driverId={accountId} onEmit={event => delivery.current?.enqueue(event)}
        onRunningChange={running => delivery.current?.setRunning(running)}
        description="Sau khi bắt đầu, mỗi 8 giây tạo hoặc lấy một mẫu rồi gửi. Dừng để ngừng lấy mẫu và tạm dừng gửi bù; yêu cầu đã gửi có thể hoàn tất." />
      <div className="driver-send-status" role="status" aria-live="polite" aria-busy={sending}>
        <p>{sending ? 'Đang gửi mẫu GPS…' : 'Không có yêu cầu đang gửi.'}</p>
        <p>Số mẫu được API chấp nhận: <strong>{acceptedCount}</strong></p>
        <p>Số mẫu chờ gửi: <strong>{queuedCount}</strong></p>
        {discardedCount > 0 && <p>Đã bỏ {discardedCount} mẫu hết hạn, vượt giới hạn hoặc bị từ chối.</p>}
        {!online && <p>Đang mất mạng. Mẫu được giữ tạm để gửi bù khi kết nối phục hồi.</p>}
        {lastAccepted && <dl>
          <dt>Mã sự kiện gần nhất</dt><dd>{lastAccepted.eventId}</dd>
          <dt>Thời điểm API tiếp nhận</dt><dd><time dateTime={lastAccepted.receivedAt}>{lastAccepted.receivedAt}</time></dd>
        </dl>}
      </div>
      {error && <p className="driver-send-error" role="alert">{error}</p>}
      <p>Giữ tạm tối đa 100 mẫu trong 5 phút. Rời trang hoặc đổi tài khoản sẽ xóa các mẫu chưa gửi.</p>
      <p className="driver-note">API chấp nhận chưa xác nhận vị trí đã lưu hoặc hiển thị trên bản đồ.</p>
    </section>
  </div>
}

export function DriverPlaceholderPage() {
  const { user, token, loading } = useAuth()
  if (loading) return <p role="status">Đang kiểm tra phiên tài xế…</p>
  if (!user || user.role !== 'DRIVER') return <p role="alert">Cần đăng nhập bằng tài khoản Driver.</p>
  return <DriverDashboard key={user.id} accountId={user.id} displayName={user.displayName} email={user.email} token={token} />
}
