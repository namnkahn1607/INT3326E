import { useEffect, useState } from 'react'

export interface GpsEmitterDraftEvent {
  driverId: string
  lat: number
  lng: number
  clientTimestamp: string
}

interface GpsEmitterProps {
  driverId: string
  onEmit?: (event: GpsEmitterDraftEvent) => void
}

const EMIT_INTERVAL_MS = 8000
const SAMPLE_COORDINATES = { lat: 21.0285, lng: 105.8542 }

export function GpsEmitter({ driverId, onEmit }: GpsEmitterProps) {
  const [running, setRunning] = useState(false)
  const [lastEvent, setLastEvent] = useState<GpsEmitterDraftEvent | null>(null)
  const [eventCount, setEventCount] = useState(0)

  useEffect(() => {
    if (!running || !driverId.trim()) return

    const intervalId = window.setInterval(() => {
      const event: GpsEmitterDraftEvent = {
        driverId,
        ...SAMPLE_COORDINATES,
        clientTimestamp: new Date().toISOString(),
      }

      setLastEvent(event)
      setEventCount((count) => count + 1)
      onEmit?.(event)
    }, EMIT_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [running, driverId, onEmit])

  return (
    <section aria-labelledby="gps-emitter-title" style={{ marginTop: '24px', textAlign: 'left' }}>
      <h3 id="gps-emitter-title">GPS emitter — bản phác thảo</h3>
      <p style={{ color: '#64748b', marginTop: '8px' }}>
        Phát tọa độ mẫu mỗi 8 giây để xem payload. Chưa gửi dữ liệu lên máy chủ.
      </p>
      <p style={{ marginTop: '12px' }}>Tài xế mẫu: {driverId}</p>
      <p role="status">
        Trạng thái: {running && driverId.trim() ? 'Đang phát mẫu' : 'Đã dừng'} · Số mẫu: {eventCount}
      </p>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={running || !driverId.trim()}
          onClick={() => setRunning(true)}
        >
          Bắt đầu phát mẫu
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={!running}
          onClick={() => setRunning(false)}
        >
          Dừng
        </button>
      </div>
      {lastEvent ? (
        <pre style={{ marginTop: '16px', padding: '12px', background: '#f0fdf4', overflowX: 'auto' }}>
          <code>{JSON.stringify(lastEvent, null, 2)}</code>
        </pre>
      ) : (
        <p style={{ marginTop: '16px' }}>Chưa có mẫu. Mẫu đầu tiên xuất hiện sau 8 giây khi bắt đầu.</p>
      )}
    </section>
  )
}
