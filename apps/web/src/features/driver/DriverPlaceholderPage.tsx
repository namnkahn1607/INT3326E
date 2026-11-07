import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { sendLocation, type LocationAccepted } from '../../api/endpoints/locations'
import { useAuth } from '../auth/useAuth'
import { GpsEmitter, type GpsEmitterDraftEvent } from './GpsEmitter'
import './driver.css'

function sendError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Chưa gửi được mẫu GPS. Hãy kiểm tra kết nối và thử lại.'
  if (error.status === 401) return 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Hãy đăng nhập lại.'
  if (error.status === 403) return 'Tài khoản không có quyền gửi vị trí Driver.'
  if (error.code === 'USER_NOT_PROVISIONED') return 'Tài khoản chưa được liên kết với tài xế. Liên hệ quản trị viên.'
  if (error.status === 404) return 'API nhận GPS chưa sẵn sàng. Cần phối hợp với nhóm backend.'
  if (error.code === 'REQUEST_TIMEOUT') return 'Chưa xác nhận được kết quả gửi trong 7 giây. Không tự gửi lại mẫu này.'
  if (error.code === 'NETWORK_ERROR') return 'Không kết nối được API. Hãy kiểm tra mạng và cấu hình máy chủ.'
  if (error.code === 'INVALID_RESPONSE') return 'Phản hồi API chưa đúng định dạng chấp nhận GPS.'
  if (error.status === 400 || error.status === 422) return 'API từ chối dữ liệu GPS. Cần kiểm tra contract với backend.'
  return 'API chưa nhận được mẫu GPS. Hãy kiểm tra dịch vụ và thử lại.'
}

function DriverDashboard({ accountId, displayName, email }: { accountId: string; displayName: string; email: string }) {
  const [sending, setSending] = useState(false)
  const [acceptedCount, setAcceptedCount] = useState(0)
  const [lastAccepted, setLastAccepted] = useState<LocationAccepted | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [skippedCount, setSkippedCount] = useState(0)
  const pending = useRef<AbortController | null>(null)

  useEffect(() => () => {
    pending.current?.abort()
    pending.current = null
  }, [])

  async function publish(event: GpsEmitterDraftEvent) {
    if (pending.current) { setSkippedCount(count => count + 1); return }
    const controller = new AbortController()
    pending.current = controller
    setSending(true)
    setError(null)
    try {
      const response = await sendLocation(event, controller.signal)
      if (controller.signal.aborted) return
      setLastAccepted(response)
      setAcceptedCount(count => count + 1)
    } catch (cause) {
      if (!controller.signal.aborted) setError(sendError(cause))
    } finally {
      if (!controller.signal.aborted) { pending.current = null; setSending(false) }
    }
  }

  return <div className="driver-dashboard">
    <section className="driver-welcome" aria-labelledby="driver-title">
      <p className="driver-eyebrow">CỔNG TÀI XẾ</p>
      <h1 id="driver-title">Xin chào, {displayName || email || accountId}</h1>
      <p>{email || accountId} · Tài xế</p>
    </section>

    <section className="driver-panel" aria-labelledby="driver-shipments-title">
      <h2 id="driver-shipments-title">Đơn được phân công</h2>
      <p>Khu vực nhận và giao đơn đang được chuẩn bị. Danh sách đơn chưa được kết nối.</p>
    </section>

    <section className="driver-panel" aria-labelledby="driver-gps-title">
      <h2 id="driver-gps-title">Thử gửi vị trí GPS</h2>
      <p>Dùng tọa độ mô phỏng để thử kết nối. Chưa lấy vị trí thật từ thiết bị.</p>
      <GpsEmitter driverId={accountId} onEmit={publish}
        description="Mẫu đầu sau 8 giây khi bắt đầu, sau đó gửi qua API mỗi 8 giây. Dừng để ngừng gửi mẫu mới; yêu cầu đã gửi có thể hoàn tất." />
      <div className="driver-send-status" role="status" aria-live="polite" aria-busy={sending}>
        <p>{sending ? 'Đang gửi mẫu GPS…' : 'Không có yêu cầu đang gửi.'}</p>
        <p>Số mẫu được API chấp nhận: <strong>{acceptedCount}</strong></p>
        {lastAccepted && <dl>
          <dt>Mã sự kiện gần nhất</dt><dd>{lastAccepted.eventId}</dd>
          <dt>Thời điểm API tiếp nhận</dt><dd><time dateTime={lastAccepted.receivedAt}>{lastAccepted.receivedAt}</time></dd>
        </dl>}
      </div>
      {error && <p className="driver-send-error" role="alert">{error}</p>}
      {skippedCount > 0 && <p>Đã bỏ qua {skippedCount} mẫu vì yêu cầu trước vẫn đang chờ. Không lưu hàng đợi.</p>}
      <p className="driver-note">API chấp nhận chưa xác nhận vị trí đã lưu hoặc hiển thị trên bản đồ.</p>
    </section>
  </div>
}

export function DriverPlaceholderPage() {
  const { user, loading } = useAuth()
  if (loading) return <p role="status">Đang kiểm tra phiên tài xế…</p>
  if (!user || user.role !== 'DRIVER') return <p role="alert">Cần đăng nhập bằng tài khoản Driver.</p>
  return <DriverDashboard key={user.id} accountId={user.id} displayName={user.displayName} email={user.email} />
}
