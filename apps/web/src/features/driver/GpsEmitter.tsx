import { useEffect, useRef, useState } from 'react'
import { assertGpsLocationRequest, MAX_GPS_SEQUENCE } from '@parcelflow/types'
import type { GpsLocationRequest } from '@parcelflow/types'

export type GpsEmitterDraftEvent = GpsLocationRequest

interface GpsEmitterProps {
  driverId: string
  onEmit?: (event: GpsEmitterDraftEvent) => void
  description?: string
}

const EMIT_INTERVAL_MS = 8000
const POSITION_TIMEOUT_MS = 7000
const SIMULATED_ROUTE = [
  { lat: 21.028511, lng: 105.804817 },
  { lat: 21.028811, lng: 105.805117 },
  { lat: 21.029111, lng: 105.805417 },
  { lat: 21.028811, lng: 105.805117 },
]

function positionError(code: number): string {
  if (code === 1) return 'Chưa được cấp quyền vị trí. Hãy cho phép định vị trong trình duyệt rồi bắt đầu lại, hoặc chọn Mô phỏng.'
  if (code === 2) return 'Chưa xác định được vị trí thiết bị. Hãy kiểm tra dịch vụ định vị rồi bắt đầu lại, hoặc chọn Mô phỏng.'
  if (code === 3) return 'Chưa lấy được vị trí trong 7 giây. Hãy kiểm tra quyền định vị rồi bắt đầu lại, hoặc chọn Mô phỏng.'
  return 'Không lấy được vị trí từ trình duyệt. Hãy thử lại hoặc chọn Mô phỏng.'
}

export function GpsEmitter({ driverId, onEmit, description }: GpsEmitterProps) {
  const [source, setSource] = useState<'simulator' | 'browser'>('simulator')
  const [running, setRunning] = useState(false)
  const [acquiring, setAcquiring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastEvent, setLastEvent] = useState<GpsEmitterDraftEvent | null>(null)
  const [eventCount, setEventCount] = useState(0)
  const sequence = useRef(0)
  const emitCallback = useRef(onEmit)

  useEffect(() => {
    emitCallback.current = onEmit
  }, [onEmit])

  useEffect(() => {
    if (!running || !driverId.trim()) return

    let active = true
    let pendingPosition = false
    let positionTimeout: number | undefined

    function fail(message: string) {
      if (!active) return
      active = false
      pendingPosition = false
      window.clearInterval(intervalId)
      window.clearTimeout(positionTimeout)
      setAcquiring(false)
      setError(message)
      setRunning(false)
    }

    function emit(lat: number, lng: number, timestamp: number) {
      if (!active) return
      let event: GpsEmitterDraftEvent
      try {
        event = { lat, lng, clientTimestamp: new Date(timestamp).toISOString(), seq: sequence.current + 1 }
        assertGpsLocationRequest(event)
      } catch {
        fail('Dữ liệu vị trí không hợp lệ. Hãy kiểm tra định vị rồi bắt đầu lại, hoặc chọn Mô phỏng.')
        return
      }

      sequence.current++
      setLastEvent(event)
      setEventCount(sequence.current)
      if (sequence.current === MAX_GPS_SEQUENCE) {
        window.clearInterval(intervalId)
        setRunning(false)
      }
      emitCallback.current?.(event)
    }

    const intervalId = window.setInterval(() => {
      if (source === 'simulator') {
        const point = SIMULATED_ROUTE[sequence.current % SIMULATED_ROUTE.length]
        emit(point.lat, point.lng, Date.now())
        return
      }
      if (pendingPosition) return
      pendingPosition = true
      setAcquiring(true)
      // Native timeout may exclude the permission prompt, so bound the whole acquisition.
      positionTimeout = window.setTimeout(() => fail(positionError(3)), POSITION_TIMEOUT_MS)
      try {
        navigator.geolocation.getCurrentPosition(position => {
          if (!active || !pendingPosition) return
          pendingPosition = false
          window.clearTimeout(positionTimeout)
          setAcquiring(false)
          emit(position.coords.latitude, position.coords.longitude, position.timestamp)
        }, cause => {
          if (pendingPosition) fail(positionError(cause.code))
        }, { maximumAge: 0, enableHighAccuracy: true, timeout: POSITION_TIMEOUT_MS })
      } catch {
        fail(positionError(0))
      }
    }, EMIT_INTERVAL_MS)

    return () => {
      // One-shot geolocation cannot be cancelled; invalidate callbacks from this run.
      active = false
      window.clearInterval(intervalId)
      window.clearTimeout(positionTimeout)
    }
  }, [running, driverId, source])

  function start() {
    setError(null)
    if (source === 'browser') {
      if (!window.isSecureContext) {
        setError('Định vị cần HTTPS hoặc localhost. Hãy mở kết nối an toàn hoặc chọn Mô phỏng.')
        return
      }
      if (!navigator.geolocation) {
        setError('Trình duyệt không hỗ trợ định vị. Hãy dùng trình duyệt khác hoặc chọn Mô phỏng.')
        return
      }
    }
    setRunning(true)
  }

  return (
    <section aria-labelledby="gps-emitter-title" style={{ marginTop: '24px', textAlign: 'left' }}>
      <h3 id="gps-emitter-title">Nguồn vị trí GPS</h3>
      <p style={{ color: '#64748b', marginTop: '8px' }}>
        {description ?? 'Tạo mẫu mỗi 8 giây để xem payload. Chưa gửi dữ liệu lên máy chủ.'}
      </p>
      <div className="driver-gps-source">
        <label htmlFor="gps-source">Chọn nguồn vị trí</label>
        <select id="gps-source" value={source} disabled={running} aria-describedby="gps-source-note"
          onChange={event => {
            setSource(event.target.value as 'simulator' | 'browser')
            setLastEvent(null)
            setError(null)
          }}>
          <option value="simulator">Mô phỏng</option>
          <option value="browser">Vị trí trình duyệt</option>
        </select>
      </div>
      <p id="gps-source-note">{source === 'simulator'
        ? 'Mô phỏng: tọa độ di chuyển theo tuyến mẫu, không phải vị trí thật của thiết bị.'
        : 'Vị trí trình duyệt: cần cấp quyền định vị. Mỗi 8 giây lấy một vị trí mới, chờ tối đa 7 giây.'}</p>
      <p style={{ marginTop: '12px' }}>Tài khoản: {driverId}</p>
      <p role="status">
        Trạng thái: {running && driverId.trim() ? 'Đang phát mẫu' : 'Đã dừng'} · Số mẫu: {eventCount}
        {acquiring && ' · Đang lấy vị trí…'}
      </p>
      {error && <p className="driver-send-error" role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={running || !driverId.trim() || eventCount >= MAX_GPS_SEQUENCE}
          onClick={start}
        >
          Bắt đầu phát mẫu
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={!running}
          onClick={() => { setRunning(false); setAcquiring(false) }}
        >
          Dừng
        </button>
      </div>
      <p className="ui-disabled-reason">{!driverId.trim() ? 'Cần mã tài xế để phát mẫu.' : running ? 'Chọn Dừng để đổi nguồn vị trí hoặc kết thúc phát mẫu.' : 'Nút Dừng khả dụng sau khi bắt đầu phát mẫu.'}</p>
      {lastEvent ? (
        <pre style={{ marginTop: '16px', padding: '12px', background: '#f0fdf4', overflowX: 'auto' }}>
          <code>{JSON.stringify(lastEvent, null, 2)}</code>
        </pre>
      ) : (
        <p style={{ marginTop: '16px' }}>Chưa có mẫu. Mẫu đầu sớm nhất sau 8 giây; vị trí trình duyệt cần thêm thời gian định vị.</p>
      )}
    </section>
  )
}
