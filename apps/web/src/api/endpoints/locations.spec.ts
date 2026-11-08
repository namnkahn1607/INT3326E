import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendLocation } from './locations'
import { setTokenReader } from '../../features/auth/session'

const payload = { lat: 21.028511, lng: 105.804817, clientTimestamp: '2026-10-26T03:00:00.000Z', seq: 1 }
const accepted = { status: 'ACCEPTED', eventId: 'gps-test-1', receivedAt: '2026-10-26T03:00:00.120Z' }

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'http://localhost:3000/v1/')
  setTokenReader(async () => 'driver-token')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); setTokenReader(async () => null) })

describe('GPS API boundary', () => {
  it('sends the shared request via the authenticated API and requires broker acceptance', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(accepted), { status: 202 }))
    vi.stubGlobal('fetch', fetcher)
    expect(await sendLocation(payload)).toEqual(accepted)
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe('http://localhost:3000/v1/locations')
    expect(options.method).toBe('POST')
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer driver-token')
    expect(new Headers(options.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual(payload)
    expect(options.body).not.toContain('driverId')
  })

  it('rejects invalid coordinates and actor fields before sending', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(sendLocation({ ...payload, lat: 91 })).rejects.toBeInstanceOf(TypeError)
    await expect(sendLocation({ ...payload, driverId: 'forged' } as typeof payload)).rejects.toBeInstanceOf(TypeError)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([200, 201])('does not count HTTP %s as accepted', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(accepted), { status })))
    await expect(sendLocation(payload)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it.each([
    null, [], { ...accepted, status: 'OK' }, { ...accepted, eventId: '' },
    { ...accepted, receivedAt: '2026-02-30T03:00:00.120Z' },
    { ...accepted, receivedAt: '2026-10-26T03:00:00Z' },
  ])('rejects a malformed acceptance response: %j', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 202 })))
    await expect(sendLocation(payload)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it.each([400, 401, 403, 404, 503])('preserves an API rejection with status %s', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"code":"GPS_REJECTED"}', { status })))
    await expect(sendLocation(payload)).rejects.toMatchObject({ status, code: 'GPS_REJECTED' })
  })

  it('times out before the next sample without retrying', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    vi.stubGlobal('fetch', fetcher)
    const result = expect(sendLocation(payload)).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' })
    await vi.advanceTimersByTimeAsync(7000)
    await result
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('cancels an in-flight request when the page leaves', async () => {
    const fetcher = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    vi.stubGlobal('fetch', fetcher)
    const controller = new AbortController()
    const result = expect(sendLocation(payload, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    await Promise.resolve()
    controller.abort()
    await result
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  })
})
