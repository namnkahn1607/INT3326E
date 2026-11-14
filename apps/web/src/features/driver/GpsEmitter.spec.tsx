import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertGpsLocationRequest } from '@parcelflow/types'
import { GpsEmitter, type GpsEmitterDraftEvent } from './GpsEmitter'

vi.mock('@parcelflow/types', async (importOriginal) => ({
  ...await importOriginal<typeof import('@parcelflow/types')>(),
  MAX_GPS_SEQUENCE: 3,
}))

let node: HTMLDivElement
let root: Root
let onEmit: ReturnType<typeof vi.fn<(event: GpsEmitterDraftEvent) => void>>
let locate: ReturnType<typeof vi.fn<Geolocation['getCurrentPosition']>>

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-21T01:00:00.000Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  node = document.createElement('div')
  document.body.append(node)
  root = createRoot(node)
  onEmit = vi.fn()
  locate = vi.fn()
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: locate } })
})

afterEach(async () => {
  await act(async () => root.unmount())
  node.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function mount(driverId = 'demo-driver-1', callback = onEmit) {
  await act(async () => root.render(
    <StrictMode><GpsEmitter driverId={driverId} onEmit={callback} /></StrictMode>,
  ))
}

function button(label: string) {
  return [...node.querySelectorAll('button')].find((item) => item.textContent === label)!
}

async function click(label: string) {
  await act(async () => button(label).click())
}

async function tick(milliseconds: number) {
  await act(async () => vi.advanceTimersByTime(milliseconds))
}

async function selectSource(value: 'simulator' | 'browser') {
  await act(async () => {
    const select = node.querySelector('select')!
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function position(lat: number, lng: number, timestamp = Date.now(), accuracy = 10): GeolocationPosition {
  return { coords: { latitude: lat, longitude: lng, accuracy }, timestamp } as GeolocationPosition
}

describe('Driver GPS sample emitter', () => {
  it('starts stopped and produces one valid request per eight seconds under StrictMode', async () => {
    await mount()
    expect(button('Dừng').disabled).toBe(true)
    expect(node.querySelector('code')).toBeNull()
    await click('Bắt đầu phát mẫu')
    expect(onEmit).not.toHaveBeenCalled()
    expect(button('Bắt đầu phát mẫu').disabled).toBe(true)
    await tick(7999)
    expect(onEmit).not.toHaveBeenCalled()
    await tick(1)
    await tick(8000)
    expect(onEmit).toHaveBeenCalledTimes(2)
    const events = onEmit.mock.calls.map(([event]) => event)
    expect(events.map((event) => event.seq)).toEqual([1, 2])
    expect([events[0].lat, events[0].lng]).not.toEqual([events[1].lat, events[1].lng])
    expect(events.map((event) => event.clientTimestamp)).toEqual([
      '2026-10-21T01:00:08.000Z', '2026-10-21T01:00:16.000Z',
    ])
    for (const event of events) {
      assertGpsLocationRequest(event)
      expect(Object.keys(event).sort()).toEqual(['clientTimestamp', 'lat', 'lng', 'seq'])
    }
    expect(JSON.parse(node.querySelector('code')!.textContent!)).toEqual(events[1])
    expect(node.textContent).toContain('Chưa gửi dữ liệu lên máy chủ.')
    expect(node.textContent).toContain('không phải vị trí thật')
    expect(locate).not.toHaveBeenCalled()
  })

  it('preserves the last sample when stopped and continues the sequence after restart', async () => {
    await mount()
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    const first = JSON.stringify(onEmit.mock.calls[0][0])
    await click('Dừng')
    await tick(16000)
    expect(onEmit).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(JSON.parse(node.querySelector('code')!.textContent!))).toBe(first)
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    expect(onEmit.mock.calls[1][0].seq).toBe(2)
    expect(JSON.stringify(onEmit.mock.calls[0][0])).toBe(first)
  })

  it('uses the latest callback without resetting the pending interval on rerender', async () => {
    await mount()
    await click('Bắt đầu phát mẫu')
    await tick(4000)
    const nextCallback = vi.fn()
    await mount('demo-driver-1', nextCallback)
    await tick(4000)
    expect(onEmit).not.toHaveBeenCalled()
    expect(nextCallback).toHaveBeenCalledTimes(1)
    await tick(8000)
    expect(nextCallback.mock.calls[1][0].seq).toBe(2)
  })

  it('cancels the timer on unmount and starts a new mount stopped at zero', async () => {
    await mount()
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    await act(async () => root.render(<p>Other route</p>))
    await tick(16000)
    expect(onEmit).toHaveBeenCalledTimes(1)
    await mount()
    expect(node.querySelector('[role="status"]')!.textContent).toContain('Số mẫu: 0')
    expect(button('Dừng').disabled).toBe(true)
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    expect(onEmit.mock.calls[1][0].seq).toBe(1)
  })

  it.each(['', '   '])('does not start with a blank sample driver identifier: %j', async (driverId) => {
    await mount(driverId)
    expect(button('Bắt đầu phát mẫu').disabled).toBe(true)
    await click('Bắt đầu phát mẫu')
    await tick(16000)
    expect(onEmit).not.toHaveBeenCalled()
  })

  it('stops at the sequence limit without emitting an extra or wrapped sample', async () => {
    await mount()
    await click('Bắt đầu phát mẫu')
    await tick(24000)
    expect(onEmit.mock.calls.map(([event]) => event.seq)).toEqual([1, 2, 3])
    expect(button('Bắt đầu phát mẫu').disabled).toBe(true)
    expect(button('Dừng').disabled).toBe(true)
    expect(node.querySelector('[role="status"]')!.textContent).toContain('Đã dừng')
    await tick(16000)
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    expect(onEmit).toHaveBeenCalledTimes(3)
  })

  it('does not acquire location until Start and the first eight-second tick', async () => {
    await mount()
    await selectSource('browser')
    await tick(16000)
    expect(locate).not.toHaveBeenCalled()
    await click('Bắt đầu phát mẫu')
    expect(node.querySelector('select')!.disabled).toBe(true)
    await tick(7999)
    expect(locate).not.toHaveBeenCalled()
    await tick(1)
    expect(locate).toHaveBeenCalledTimes(1)
    expect(locate.mock.calls[0][2]).toEqual({ maximumAge: 0, enableHighAccuracy: true, timeout: 7000 })
    expect(node.textContent).toContain('Đang lấy vị trí')
    expect(onEmit).not.toHaveBeenCalled()
  })

  it('uses measured coordinates and timestamp, then acquires again on the next tick', async () => {
    await mount()
    await selectSource('browser')
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    await tick(1000)
    const measured = Date.parse('2026-10-21T01:00:08.200Z')
    await act(async () => locate.mock.calls[0][0](position(10.762622, 106.660172, measured)))
    expect(onEmit).toHaveBeenLastCalledWith({ lat: 10.762622, lng: 106.660172, seq: 1,
      clientTimestamp: '2026-10-21T01:00:08.200Z' })
    assertGpsLocationRequest(onEmit.mock.calls[0][0])
    await tick(7000)
    expect(locate).toHaveBeenCalledTimes(2)
    await act(async () => locate.mock.calls[1][0](position(10.763, 106.661)))
    expect(onEmit.mock.calls[1][0].seq).toBe(2)
    expect(onEmit.mock.calls[1][0].lat).toBe(10.763)
    expect(node.textContent).not.toContain('Đang lấy vị trí')
  })

  it.each([
    [1, 'Chưa được cấp quyền'], [2, 'Chưa xác định được vị trí'], [3, 'trong 7 giây'],
  ])('stops for geolocation error %s without falling back or consuming a sequence', async (code, message) => {
    await mount()
    await selectSource('browser')
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    await act(async () => locate.mock.calls[0][1]!({ code, message: 'private native detail' } as GeolocationPositionError))
    expect(node.querySelector('[role="alert"]')?.textContent).toContain(message)
    expect(node.textContent).not.toContain('private native detail')
    expect(node.textContent).toContain('Đã dừng')
    expect(node.querySelector('select')!.disabled).toBe(false)
    await tick(24000)
    expect(locate).toHaveBeenCalledTimes(1)
    expect(onEmit).not.toHaveBeenCalled()
    await selectSource('simulator')
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    expect(onEmit.mock.calls[0][0].seq).toBe(1)
  })

  it('bounds permission waiting and discards a result arriving after the deadline', async () => {
    await mount()
    await selectSource('browser')
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    const previous = locate.mock.calls[0][0]
    await tick(6999)
    expect(node.querySelector('[role="alert"]')).toBeNull()
    await tick(1)
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('trong 7 giây')
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    await act(async () => previous(position(20, 105)))
    expect(onEmit).not.toHaveBeenCalled()
    await act(async () => locate.mock.calls[1][0](position(21, 106)))
    expect(onEmit.mock.calls[0][0]).toMatchObject({ lat: 21, lng: 106, seq: 1 })
  })

  it('cancels the interval immediately after a synchronous error even before effect cleanup', async () => {
    locate.mockImplementation((_success, failure) => failure!({ code: 1 } as GeolocationPositionError))
    await mount()
    await selectSource('browser')
    await click('Bắt đầu phát mẫu')
    await tick(24000)
    expect(locate).toHaveBeenCalledTimes(1)
    expect(onEmit).not.toHaveBeenCalled()
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('Chưa được cấp quyền')
  })

  it('ignores late success and error after Stop, including when a new source is running', async () => {
    await mount()
    await selectSource('browser')
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    const [success, failure] = locate.mock.calls[0]
    await click('Dừng')
    await selectSource('simulator')
    await click('Bắt đầu phát mẫu')
    await act(async () => {
      success(position(20, 105))
      failure!({ code: 1 } as GeolocationPositionError)
    })
    await tick(8000)
    expect(onEmit).toHaveBeenCalledTimes(1)
    expect(onEmit.mock.calls[0][0]).toMatchObject({ lat: 21.028511, lng: 105.804817, seq: 1 })
    expect(node.querySelector('[role="alert"]')).toBeNull()
  })

  it('discards an outstanding position after unmount and clears all acquisition timers', async () => {
    await mount()
    await selectSource('browser')
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    const [success, failure] = locate.mock.calls[0]
    await act(async () => root.render(<p>Other route</p>))
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => {
      success(position(20, 105))
      failure!({ code: 2 } as GeolocationPositionError)
    })
    await tick(16000)
    expect(onEmit).not.toHaveBeenCalled()
    expect(node.textContent).toBe('Other route')
  })

  it.each([
    [NaN, 105, 0], [91, 105, 0], [21, -181, 0], [21, Infinity, 0], [21, 105, NaN],
  ])('rejects malformed measured data (%s, %s, %s) before emitting', async (lat, lng, timestamp) => {
    await mount()
    await selectSource('browser')
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    await act(async () => locate.mock.calls[0][0](position(lat, lng, timestamp)))
    expect(onEmit).not.toHaveBeenCalled()
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('không hợp lệ')
    expect(node.textContent).toContain('Số mẫu: 0')
  })

  it.each(['insecure', 'unsupported', 'throws'])('reports an %s browser without emitting a simulator sample', async kind => {
    if (kind === 'insecure') vi.stubGlobal('isSecureContext', false)
    if (kind === 'unsupported') vi.stubGlobal('navigator', {})
    if (kind === 'throws') locate.mockImplementation(() => { throw new Error('native details') })
    await mount()
    await selectSource('browser')
    await click('Bắt đầu phát mẫu')
    await tick(16000)
    expect(node.querySelector('[role="alert"]')?.textContent).toContain(
      kind === 'insecure' ? 'HTTPS' : kind === 'unsupported' ? 'không hỗ trợ' : 'Không lấy được vị trí')
    expect(onEmit).not.toHaveBeenCalled()
    expect(node.textContent).toContain('Đã dừng')
  })

  it.each([NaN, Infinity, -1, 100.001])('skips accuracy %s without consuming a sequence and recovers on the next tick', async accuracy => {
    await mount()
    await selectSource('browser')
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    await act(async () => locate.mock.calls[0][0](position(21, 105, Date.now(), accuracy)))
    expect(onEmit).not.toHaveBeenCalled()
    expect(node.textContent).toContain('độ chính xác')
    expect(node.textContent).toContain('Đang phát mẫu')
    await tick(8000)
    await act(async () => locate.mock.calls[1][0](position(21, 105, Date.now(), 100)))
    expect(onEmit.mock.calls[0][0].seq).toBe(1)
    expect(node.querySelector('[role="alert"]')).toBeNull()
  })

  it.each([30_001, -60_001])('skips an acquisition with age %s ms but keeps measuring', async age => {
    await mount()
    await selectSource('browser')
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    await act(async () => locate.mock.calls[0][0](position(21, 105, Date.now() - age)))
    expect(onEmit).not.toHaveBeenCalled()
    expect(node.textContent).toContain('sai thời gian')
    await tick(8000)
    await act(async () => locate.mock.calls[1][0](position(21, 105)))
    expect(onEmit.mock.calls[0][0].seq).toBe(1)
  })

  it.each([30_000, -60_000])('accepts the exact acquisition age boundary %s ms', async age => {
    await mount()
    await selectSource('browser')
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    await act(async () => locate.mock.calls[0][0](position(21, 105, Date.now() - age, 0)))
    expect(onEmit).toHaveBeenCalledTimes(1)
  })

  it.each([0, -1])('ignores a repeated or regressing measurement timestamp (%s ms)', async delta => {
    await mount()
    await selectSource('browser')
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    const timestamp = Date.now()
    await act(async () => locate.mock.calls[0][0](position(21, 105, timestamp)))
    await tick(8000)
    await act(async () => locate.mock.calls[1][0](position(22, 106, timestamp + delta)))
    expect(onEmit).toHaveBeenCalledTimes(1)
    await tick(8000)
    await act(async () => locate.mock.calls[2][0](position(22, 106)))
    expect(onEmit.mock.calls[1][0].seq).toBe(2)
  })

  it('keeps acquiring after an invalid coordinate instead of stopping the emitter', async () => {
    await mount()
    await selectSource('browser')
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    await act(async () => locate.mock.calls[0][0](position(91, 105)))
    await tick(8000)
    await act(async () => locate.mock.calls[1][0](position(90, -180)))
    expect(onEmit).toHaveBeenCalledTimes(1)
    expect(onEmit.mock.calls[0][0]).toMatchObject({ lat: 90, lng: -180, seq: 1 })
  })

  it('clears the old source preview and keeps the sequence when changing sources', async () => {
    await mount()
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    await click('Dừng')
    await selectSource('browser')
    expect(node.querySelector('code')).toBeNull()
    await click('Bắt đầu phát mẫu')
    await tick(8000)
    await act(async () => locate.mock.calls[0][0](position(20, 105)))
    expect(onEmit.mock.calls[1][0]).toMatchObject({ lat: 20, lng: 105, seq: 2 })
  })
})
