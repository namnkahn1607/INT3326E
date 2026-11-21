import { assertGpsLocationRequest, type GpsLocationRequest } from '@parcelflow/types'
import { ApiError } from '../../api/client'
import { sendLocation, type LocationAccepted } from '../../api/endpoints/locations'
import { isGpsTimestampInWindow } from './gps-sample'

export const GPS_BUFFER_CAPACITY = 100
export const GPS_BUFFER_MAX_AGE_MS = 5 * 60_000
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000]

export interface GpsDeliveryState {
  sending: boolean
  queuedCount: number
  discardedCount: number
  acceptedCount: number
  lastAccepted: LocationAccepted | null
  error: string | null
  online: boolean
}

export const INITIAL_GPS_DELIVERY: GpsDeliveryState = {
  sending: false, queuedCount: 0, discardedCount: 0, acceptedCount: 0,
  lastAccepted: null, error: null, online: true,
}

function sendError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Chưa gửi được mẫu GPS. Hãy kiểm tra kết nối và thử lại.'
  if (error.status === 401) return 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Hãy đăng nhập lại.'
  if (error.status === 403) return 'Tài khoản không có quyền gửi vị trí Driver.'
  if (error.code === 'USER_NOT_PROVISIONED') return 'Tài khoản chưa được liên kết với tài xế. Liên hệ quản trị viên.'
  if (error.status === 404) return 'API nhận GPS chưa sẵn sàng. Cần phối hợp với nhóm backend.'
  if (error.code === 'REQUEST_TIMEOUT') return 'Chưa xác nhận được kết quả gửi trong 7 giây. Mẫu được giữ để gửi lại khi kết nối phục hồi.'
  if (error.code === 'NETWORK_ERROR') return 'Không kết nối được API. Mẫu được giữ để gửi lại khi kết nối phục hồi.'
  if (error.code === 'INVALID_RESPONSE') return 'Phản hồi API chưa đúng định dạng chấp nhận GPS.'
  if (error.status === 400 || error.status === 422) return 'API từ chối dữ liệu GPS. Cần kiểm tra contract với backend.'
  return 'API chưa nhận được mẫu GPS. Hãy kiểm tra dịch vụ và thử lại.'
}

export class GpsDeliveryQueue {
  private queue: GpsLocationRequest[] = []
  private pending: { event: GpsLocationRequest; controller: AbortController } | null = null
  private timer: number | undefined
  private retryAttempt = 0
  private running = false
  private live = true
  private blocked = false
  private state: GpsDeliveryState = { ...INITIAL_GPS_DELIVERY }
  private onChange: (state: GpsDeliveryState) => void
  private send: typeof sendLocation

  constructor(onChange: (state: GpsDeliveryState) => void, send = sendLocation) {
    this.onChange = onChange
    this.send = send
    window.addEventListener('online', this.onOnline)
    window.addEventListener('offline', this.onOffline)
  }

  setRunning(running: boolean) {
    if (!this.live) return
    this.running = running
    if (!running) this.clearRetry()
    else void this.flush()
  }

  enqueue(event: GpsLocationRequest) {
    if (!this.live) return
    this.prune()
    try {
      assertGpsLocationRequest(event)
      if (!isGpsTimestampInWindow(Date.parse(event.clientTimestamp), GPS_BUFFER_MAX_AGE_MS)) throw new Error('expired')
    } catch {
      this.state.discardedCount++
      this.notify()
      return
    }
    if (this.blocked) {
      this.state.discardedCount++
    } else {
      if (this.queue.length + Number(!!this.pending) >= GPS_BUFFER_CAPACITY) {
        this.queue.shift()
        this.state.discardedCount++
      }
      // Own a snapshot so replay cannot change the original deduplication key or coordinates.
      this.queue.push({ ...event })
    }
    this.notify()
    void this.flush()
  }

  dispose() {
    this.live = false
    this.running = false
    this.clearRetry()
    this.pending?.controller.abort()
    this.pending = null
    this.queue = []
    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('offline', this.onOffline)
  }

  private onOnline = () => {
    this.clearRetry()
    this.notify()
    void this.flush()
  }

  private onOffline = () => {
    this.clearRetry()
    this.notify()
  }

  private clearRetry() {
    window.clearTimeout(this.timer)
    this.timer = undefined
  }

  private isOnline() {
    return navigator.onLine !== false
  }

  private notify() {
    if (this.live) this.onChange({ ...this.state, sending: !!this.pending,
      queuedCount: this.queue.length + Number(!!this.pending), online: this.isOnline() })
  }

  private prune() {
    const before = this.queue.length
    this.queue = this.queue.filter(event => isGpsTimestampInWindow(Date.parse(event.clientTimestamp), GPS_BUFFER_MAX_AGE_MS))
    this.state.discardedCount += before - this.queue.length
  }

  private async flush() {
    if (!this.live || !this.running || this.blocked || this.pending || this.timer !== undefined || !this.isOnline()) return
    this.prune()
    const event = this.queue.shift()
    if (!event) { this.notify(); return }
    const controller = new AbortController()
    this.pending = { event, controller }
    this.notify()
    try {
      const response = await this.send(event, controller.signal)
      if (!this.live) return
      this.state.acceptedCount++
      this.state.lastAccepted = response
      this.state.error = null
      this.retryAttempt = 0
    } catch (error) {
      if (!this.live) return
      this.state.error = sendError(error)
      const denied = error instanceof ApiError && (error.status === 401 || error.status === 403 || error.code === 'USER_NOT_PROVISIONED')
      const retryable = error instanceof ApiError && (
        error.code === 'NETWORK_ERROR' || error.code === 'REQUEST_TIMEOUT' || error.status === 429 || error.status >= 500 && error.status <= 599)
      if (denied) {
        this.blocked = true
        this.state.discardedCount += this.queue.length + 1
        this.queue = []
      } else if (retryable && isGpsTimestampInWindow(Date.parse(event.clientTimestamp), GPS_BUFFER_MAX_AGE_MS)) {
        this.queue.unshift(event)
        if (this.running && this.isOnline()) {
          const delay = RETRY_DELAYS_MS[Math.min(this.retryAttempt++, RETRY_DELAYS_MS.length - 1)]
          this.timer = window.setTimeout(() => { this.timer = undefined; void this.flush() }, delay)
        }
      } else {
        this.state.discardedCount++
        this.retryAttempt = 0
      }
    } finally {
      if (this.live) {
        this.pending = null
        this.notify()
        void this.flush()
      }
    }
  }
}
