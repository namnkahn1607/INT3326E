import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { sendLocation, type LocationAccepted } from '../../api/endpoints/locations'
import { AuthContext, type AuthContextType, type UserProfile } from '../auth/context'
import { ProtectedRoute } from '../auth/ProtectedRoute'
import { DriverPlaceholderPage } from './DriverPlaceholderPage'

vi.mock('../../api/endpoints/locations', () => ({ sendLocation: vi.fn() }))
const send = vi.mocked(sendLocation)
const accepted: LocationAccepted = { status: 'ACCEPTED', eventId: 'gps-test-1', receivedAt: '2026-10-26T03:00:08.120Z' }
const driver: UserProfile = { id: 'firebase-driver-uid', displayName: 'An', email: 'driver@example.test', role: 'DRIVER' }
let node: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-26T03:00:00.000Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  send.mockReset().mockResolvedValue(accepted)
  node = document.createElement('div')
  document.body.append(node)
  root = createRoot(node)
})
afterEach(async () => {
  await act(async () => root.unmount())
  node.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function render(user: UserProfile | null = driver, loading = false) {
  const auth: AuthContextType = { user, token: 'token', loading, error: null, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() }
  await act(async () => root.render(<StrictMode><AuthContext.Provider value={auth}>
    <MemoryRouter initialEntries={['/driver']}><Routes>
      <Route path="/login" element={<p>LOGIN</p>} />
      <Route path="/driver" element={<ProtectedRoute role="DRIVER"><DriverPlaceholderPage /></ProtectedRoute>} />
    </Routes></MemoryRouter>
  </AuthContext.Provider></StrictMode>))
}
async function click(label: string) {
  const button = [...node.querySelectorAll('button')].find(item => item.textContent === label)!
  await act(async () => button.click())
}
async function tick(ms: number) { await act(async () => vi.advanceTimersByTimeAsync(ms)) }
function deferred() {
  let resolve!: (value: LocationAccepted) => void
  const promise = new Promise<LocationAccepted>(done => { resolve = done })
  return { promise, resolve }
}

describe('Driver dashboard and GPS integration', () => {
  it('shows the signed-in account and a shipment placeholder without making requests on mount', async () => {
    await render()
    expect(node.textContent).toContain('Xin chào, An')
    expect(node.textContent).toContain(driver.email)
    expect(node.textContent).toContain('Danh sách đơn chưa được kết nối')
    expect(node.textContent).not.toContain('demo-driver-1')
    await tick(16000)
    expect(send).not.toHaveBeenCalled()
  })

  it('sends valid samples at eight-second intervals and shows API acceptance only', async () => {
    await render()
    await click('Bắt đầu phát mẫu')
    await tick(7999)
    expect(send).not.toHaveBeenCalled()
    await tick(1)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toEqual({ lat: 21.028511, lng: 105.804817, seq: 1, clientTimestamp: '2026-10-26T03:00:08.000Z' })
    expect(node.textContent).toContain('Số mẫu được API chấp nhận: 1')
    expect(node.textContent).toContain(accepted.eventId)
    expect(node.textContent).toContain('chưa xác nhận vị trí đã lưu')
    await tick(8000)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1][0].seq).toBe(2)
  })

  it('stops new requests and resumes with the next sequence', async () => {
    await render()
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    await click('Dừng')
    await tick(16000)
    expect(send).toHaveBeenCalledTimes(1)
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    expect(send.mock.calls[1][0].seq).toBe(2)
  })

  it('does not queue or overlap samples while a previous request is pending', async () => {
    const request = deferred()
    send.mockReturnValueOnce(request.promise)
    await render()
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    expect(node.textContent).toContain('Đang gửi mẫu GPS')
    await tick(8000)
    expect(send).toHaveBeenCalledTimes(1)
    expect(node.textContent).toContain('Đã bỏ qua 1 mẫu')
    await click('Dừng')
    await act(async () => request.resolve(accepted))
    expect(node.textContent).toContain('Số mẫu được API chấp nhận: 1')
    await tick(8000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it.each([
    [401, 'UNAUTHENTICATED', 'đăng nhập lại'], [403, 'FORBIDDEN', 'không có quyền'],
    [409, 'USER_NOT_PROVISIONED', 'chưa được liên kết'], [404, 'HTTP_ERROR', 'chưa sẵn sàng'],
    [400, 'VALIDATION_ERROR', 'từ chối dữ liệu'], [503, 'UNAVAILABLE', 'kiểm tra dịch vụ'],
    [0, 'REQUEST_TIMEOUT', 'Không tự gửi lại'], [0, 'NETWORK_ERROR', 'Không kết nối được'],
    [202, 'INVALID_RESPONSE', 'chưa đúng định dạng'],
  ])('reports %s/%s without counting a failure or exposing server details', async (status, code, message) => {
    send.mockRejectedValueOnce(new ApiError(status, code))
    await render()
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    expect(node.querySelector('[role="alert"]')?.textContent).toContain(message)
    expect(node.textContent).toContain('Số mẫu được API chấp nhận: 0')
    expect(send).toHaveBeenCalledTimes(1)
    await tick(8000)
    expect(node.querySelector('[role="alert"]')).toBeNull()
    expect(node.textContent).toContain('Số mẫu được API chấp nhận: 1')
  })

  it('aborts on unmount and does not send further samples', async () => {
    const request = deferred()
    send.mockReturnValueOnce(request.promise)
    await render()
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    const signal = send.mock.calls[0][1]!
    await act(async () => root.render(<p>Other route</p>))
    expect(signal.aborted).toBe(true)
    await act(async () => request.resolve(accepted))
    await tick(16000)
    expect(send).toHaveBeenCalledTimes(1)
    expect(node.textContent).toBe('Other route')
  })

  it('resets and cancels the old session when a different driver signs in', async () => {
    const request = deferred()
    send.mockReturnValueOnce(request.promise)
    await render()
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    const signal = send.mock.calls[0][1]!
    await render({ ...driver, id: 'second-driver', displayName: 'Bình' })
    expect(signal.aborted).toBe(true)
    await act(async () => request.resolve(accepted))
    expect(node.textContent).toContain('Xin chào, Bình')
    expect(node.textContent).toContain('Số mẫu được API chấp nhận: 0')
    expect(node.textContent).not.toContain(accepted.eventId)
    await tick(8000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('cancels requests when the session disappears', async () => {
    send.mockReturnValueOnce(deferred().promise)
    await render()
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    const signal = send.mock.calls[0][1]!
    await render(null)
    expect(signal.aborted).toBe(true)
    expect(node.textContent).toBe('LOGIN')
  })

  it.each(['CUSTOMER', 'ADMIN'] as const)('blocks %s from using Driver controls', async role => {
    await render({ ...driver, role })
    expect(node.textContent).toContain('Không có quyền truy cập')
    expect(node.querySelector('button')).toBeNull()
    expect(send).not.toHaveBeenCalled()
  })

  it('waits for authentication before showing the dashboard', async () => {
    await render(null, true)
    expect(node.textContent).toContain('Đang kiểm tra')
    expect(node.querySelector('button')).toBeNull()
    expect(send).not.toHaveBeenCalled()
  })
})
