import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiClient } from './client'
import { setTokenReader } from '../features/auth/session'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); setTokenReader(async () => null) })

describe('API boundary', () => {
  it('uses a fresh token and merges Headers without losing custom headers', async () => {
    setTokenReader(async () => 'fresh-token')
    const fetcher = vi.fn().mockResolvedValue(new Response('{"ok":true}'))
    vi.stubGlobal('fetch', fetcher)
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000/v1/')
    expect(await apiClient('/probe', { headers: new Headers({ 'Idempotency-Key': 'key' }) })).toEqual({ ok: true })
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe('http://localhost:3000/v1/probe')
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer fresh-token')
    expect(new Headers(options.headers).get('Idempotency-Key')).toBe('key')
  })
  it('preserves HTTP status/code/errors and never displays the raw body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'VALIDATION_ERROR', detail: 'private stack', errors: [{ field: 'recipientPhone', message: 'Invalid' }],
    }), { status: 400 })))
    try { await apiClient('/probe'); expect.fail('must reject') }
    catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', errors: [{ field: 'recipientPhone', message: 'Invalid' }] })
      expect(String(error)).not.toContain('private stack')
    }
  })
  it('handles non-JSON errors without reading a consumed body twice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>private upstream</html>', { status: 503 })))
    await expect(apiClient('/probe', { token: null })).rejects.toMatchObject({ status: 503 })
  })
  it('respects an explicit null token instead of reading the session', async () => {
    const read = vi.fn().mockResolvedValue('session-token')
    setTokenReader(read)
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetcher)
    await apiClient('/probe', { token: null, headers: [['X-Request-Id', 'test']] })
    expect(read).not.toHaveBeenCalled()
    expect(new Headers(fetcher.mock.calls[0][1].headers).get('Authorization')).toBeNull()
    expect(new Headers(fetcher.mock.calls[0][1].headers).get('X-Request-Id')).toBe('test')
  })
  it('aborts on timeout and distinguishes external cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    await expect(apiClient('/probe', { timeoutMs: 5 })).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' })
    const controller = new AbortController()
    const request = apiClient('/probe', { signal: controller.signal })
    await Promise.resolve(); controller.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })
})
