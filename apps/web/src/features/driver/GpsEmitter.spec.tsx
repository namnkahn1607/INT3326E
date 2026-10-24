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

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-21T01:00:00.000Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  node = document.createElement('div')
  document.body.append(node)
  root = createRoot(node)
  onEmit = vi.fn()
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
    expect(events.map((event) => event.clientTimestamp)).toEqual([
      '2026-10-21T01:00:08.000Z', '2026-10-21T01:00:16.000Z',
    ])
    for (const event of events) {
      assertGpsLocationRequest(event)
      expect(Object.keys(event).sort()).toEqual(['clientTimestamp', 'lat', 'lng', 'seq'])
    }
    expect(JSON.parse(node.querySelector('code')!.textContent!)).toEqual(events[1])
    expect(node.textContent).toContain('Chưa gửi dữ liệu lên máy chủ.')
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
})
