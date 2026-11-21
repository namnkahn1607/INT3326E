import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GpsLocationRequest } from '@parcelflow/types'
import { ApiError } from '../../api/client'
import { sendLocation, type LocationAccepted } from '../../api/endpoints/locations'
import { GpsDeliveryQueue, GPS_BUFFER_CAPACITY, GPS_BUFFER_MAX_AGE_MS, INITIAL_GPS_DELIVERY, type GpsDeliveryState } from './gps-delivery'

vi.mock('../../api/endpoints/locations', () => ({ sendLocation: vi.fn() }))
const send = vi.mocked(sendLocation)
const accepted: LocationAccepted = { status: 'ACCEPTED', eventId: 'gps-accepted', receivedAt: '2026-11-15T01:00:00.000Z' }
let queue: GpsDeliveryQueue
let state: GpsDeliveryState
let changed: ReturnType<typeof vi.fn<(state: GpsDeliveryState) => void>>

function sample(seq = 1, ageMs = 0): GpsLocationRequest {
  return { lat: 21 + seq / 1e6, lng: 105, seq,
    clientTimestamp: new Date(Date.now() - ageMs).toISOString() }
}

function network(online: boolean) {
  vi.stubGlobal('navigator', { onLine: online })
  window.dispatchEvent(new Event(online ? 'online' : 'offline'))
}

function deferred() {
  let resolve!: (response: LocationAccepted) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<LocationAccepted>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

async function tick(ms = 0) { await vi.advanceTimersByTimeAsync(ms) }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-15T01:00:00.000Z'))
  vi.stubGlobal('navigator', { onLine: true })
  send.mockReset().mockResolvedValue(accepted)
  state = { ...INITIAL_GPS_DELIVERY }
  changed = vi.fn((next: GpsDeliveryState) => { state = next })
  queue = new GpsDeliveryQueue(changed)
})

afterEach(() => {
  queue.dispose()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('GPS delivery buffer', () => {
  it('holds offline samples and replays their unchanged payloads FIFO on reconnect', async () => {
    network(false)
    queue.setRunning(true)
    const first = sample(1)
    const second = sample(2)
    queue.enqueue(first)
    queue.enqueue(second)
    expect(state).toMatchObject({ queuedCount: 2, acceptedCount: 0, online: false })
    expect(send).not.toHaveBeenCalled()
    await tick(40_000)
    network(true)
    await tick()
    expect(send.mock.calls.map(([event]) => event)).toEqual([first, second])
    expect(state).toMatchObject({ acceptedCount: 2, queuedCount: 0, discardedCount: 0 })
  })

  it('never overlaps HTTP requests or loses samples arriving during a request', async () => {
    const pending = deferred()
    send.mockReturnValueOnce(pending.promise)
    queue.setRunning(true)
    queue.enqueue(sample(1))
    queue.enqueue(sample(2))
    queue.enqueue(sample(3))
    expect(send).toHaveBeenCalledTimes(1)
    expect(state).toMatchObject({ queuedCount: 3, sending: true })
    pending.resolve(accepted)
    await tick()
    expect(send.mock.calls.map(([event]) => event.seq)).toEqual([1, 2, 3])
    expect(state).toMatchObject({ acceptedCount: 3, queuedCount: 0, sending: false })
  })

  it.each([
    [0, 'NETWORK_ERROR'], [0, 'REQUEST_TIMEOUT'], [429, 'HTTP_ERROR'], [503, 'UNAVAILABLE'],
  ])('retries %s/%s with the original timestamp, coordinates and sequence', async (status, code) => {
    send.mockRejectedValueOnce(new ApiError(status, code))
    queue.setRunning(true)
    const event = sample()
    queue.enqueue(event)
    await tick()
    expect(state).toMatchObject({ queuedCount: 1, acceptedCount: 0 })
    await tick(999)
    expect(send).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(send.mock.calls.map(([body]) => body)).toEqual([event, event])
    expect(state).toMatchObject({ queuedCount: 0, acceptedCount: 1, error: null })
  })

  it('uses capped exponential backoff even when the browser reports online', async () => {
    send.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'))
    queue.setRunning(true)
    queue.enqueue(sample())
    await tick()
    for (const [index, delay] of [1000, 2000, 4000, 8000, 16000, 30000, 30000].entries()) {
      await tick(delay - 1)
      expect(send).toHaveBeenCalledTimes(index + 1)
      await tick(1)
      expect(send).toHaveBeenCalledTimes(index + 2)
    }
  })

  it('does not bypass backoff when another sample arrives', async () => {
    send.mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE'))
    queue.setRunning(true)
    queue.enqueue(sample(1))
    await tick()
    queue.enqueue(sample(2))
    await tick(999)
    expect(send).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(send.mock.calls.map(([event]) => event.seq)).toEqual([1, 1, 2])
  })

  it('reconnects immediately, cancels scheduled retry and does not create a second sender', async () => {
    send.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'))
    queue.setRunning(true)
    queue.enqueue(sample())
    await tick()
    network(false)
    await tick(5000)
    expect(send).toHaveBeenCalledTimes(1)
    network(true)
    network(true)
    await tick()
    await tick(5000)
    expect(send).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('drops the oldest waiting sample when full and preserves the in-flight request', async () => {
    const pending = deferred()
    send.mockReturnValueOnce(pending.promise)
    queue.setRunning(true)
    for (let seq = 1; seq <= GPS_BUFFER_CAPACITY + 1; seq++) queue.enqueue(sample(seq))
    expect(state).toMatchObject({ queuedCount: GPS_BUFFER_CAPACITY, discardedCount: 1 })
    expect(send.mock.calls[0][1]?.aborted).toBe(false)
    pending.resolve(accepted)
    await tick()
    expect(send.mock.calls.map(([event]) => event.seq)).toEqual([1, ...Array.from({ length: 99 }, (_, i) => i + 3)])
    expect(state).toMatchObject({ acceptedCount: 100, queuedCount: 0 })
  })

  it('bounds an offline buffer and retains the newest samples', async () => {
    network(false)
    queue.setRunning(true)
    for (let seq = 1; seq <= GPS_BUFFER_CAPACITY + 5; seq++) queue.enqueue(sample(seq))
    expect(state).toMatchObject({ queuedCount: GPS_BUFFER_CAPACITY, discardedCount: 5 })
    network(true)
    await tick()
    expect(send.mock.calls[0][0].seq).toBe(6)
    expect(send.mock.calls.at(-1)?.[0].seq).toBe(105)
  })

  it('expires samples before replay and accepts the exact five-minute boundary', async () => {
    network(false)
    queue.setRunning(true)
    queue.enqueue(sample(1, GPS_BUFFER_MAX_AGE_MS))
    queue.enqueue(sample(2, GPS_BUFFER_MAX_AGE_MS - 1))
    await tick(1)
    network(true)
    await tick()
    expect(send.mock.calls.map(([event]) => event.seq)).toEqual([2])
    expect(state).toMatchObject({ discardedCount: 1, acceptedCount: 1 })
  })

  it('prunes expired samples before enqueueing and never retries them indefinitely', async () => {
    send.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'))
    queue.setRunning(true)
    queue.enqueue(sample())
    await tick(GPS_BUFFER_MAX_AGE_MS + 30_000)
    expect(state).toMatchObject({ queuedCount: 0, discardedCount: 1, acceptedCount: 0 })
    expect(vi.getTimerCount()).toBe(0)
    const attempts = send.mock.calls.length
    await tick(60_000)
    expect(send).toHaveBeenCalledTimes(attempts)
    network(false)
    queue.enqueue(sample(2))
    await tick(GPS_BUFFER_MAX_AGE_MS + 1)
    queue.enqueue(sample(3))
    expect(state.queuedCount).toBe(1)
  })

  it.each([400, 404, 409, 422, 202])('does not retry permanent status %s or malformed acceptance', async status => {
    send.mockRejectedValueOnce(new ApiError(status, status === 202 ? 'INVALID_RESPONSE' : 'HTTP_ERROR'))
    queue.setRunning(true)
    queue.enqueue(sample())
    await tick(60_000)
    expect(send).toHaveBeenCalledTimes(1)
    expect(state).toMatchObject({ discardedCount: 1, queuedCount: 0, acceptedCount: 0 })
    expect(state.error).not.toBeNull()
  })

  it.each([[401, 'UNAUTHENTICATED'], [403, 'FORBIDDEN'], [409, 'USER_NOT_PROVISIONED']])(
    'clears and blocks the account buffer after %s/%s', async (status, code) => {
      const pending = deferred()
      send.mockReturnValueOnce(pending.promise)
      queue.setRunning(true)
      queue.enqueue(sample(1))
      queue.enqueue(sample(2))
      pending.reject(new ApiError(status as number, code as string))
      await tick()
      queue.enqueue(sample(3))
      network(true)
      queue.setRunning(false)
      queue.setRunning(true)
      await tick(60_000)
      expect(send).toHaveBeenCalledTimes(1)
      expect(state).toMatchObject({ queuedCount: 0, discardedCount: 3, acceptedCount: 0 })
    })

  it('pauses queued replay on Stop but lets a sent request finish; Start resumes', async () => {
    const pending = deferred()
    send.mockReturnValueOnce(pending.promise)
    queue.setRunning(true)
    queue.enqueue(sample(1))
    queue.enqueue(sample(2))
    queue.setRunning(false)
    pending.resolve(accepted)
    await tick(10_000)
    expect(send).toHaveBeenCalledTimes(1)
    expect(state).toMatchObject({ acceptedCount: 1, queuedCount: 1 })
    queue.setRunning(true)
    await tick()
    expect(send.mock.calls[1][0].seq).toBe(2)
  })

  it('cancels backoff on Stop and keeps the failed sample for Start', async () => {
    send.mockRejectedValueOnce(new ApiError(0, 'REQUEST_TIMEOUT'))
    queue.setRunning(true)
    queue.enqueue(sample())
    await tick()
    queue.setRunning(false)
    await tick(10_000)
    expect(send).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    queue.setRunning(true)
    await tick()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it.each(['resolve', 'reject'] as const)('disposes pending work and ignores a late %s after account/route cleanup', async outcome => {
    const pending = deferred()
    send.mockReturnValueOnce(pending.promise)
    queue.setRunning(true)
    queue.enqueue(sample(1))
    queue.enqueue(sample(2))
    const signal = send.mock.calls[0][1]!
    queue.dispose()
    const calls = changed.mock.calls.length
    if (outcome === 'resolve') pending.resolve(accepted)
    else pending.reject(new ApiError(0, 'NETWORK_ERROR'))
    network(true)
    queue.enqueue(sample(3))
    queue.setRunning(true)
    await tick(60_000)
    expect(signal.aborted).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    expect(changed).toHaveBeenCalledTimes(calls)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not retain a caller-mutable payload or accept malformed/expired samples', async () => {
    const event = sample()
    queue.enqueue(event)
    event.lat = 22
    queue.enqueue({ ...sample(2), lat: NaN })
    queue.enqueue(sample(3, GPS_BUFFER_MAX_AGE_MS + 1))
    queue.setRunning(true)
    await tick()
    expect(send.mock.calls[0][0].lat).not.toBe(22)
    expect(state).toMatchObject({ acceptedCount: 1, discardedCount: 2 })
  })
})
