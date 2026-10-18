import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let lookup: typeof import('./address-search')
const fetchMock = vi.fn()
const feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [105.78, 21.03] },
  properties: { name: 'Duong Xuan Thuy', city: 'Ha Noi', extent: [105.77, 21.04, 105.79, 21.02] } }
const response = (features: unknown[] = [feature]) => new Response(JSON.stringify({ features }), { status: 200 })
beforeEach(async () => {
  vi.resetModules(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock)
  lookup = await import('./address-search')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('Photon search client (mock fetch)', () => {
  it('uses only the approved query and never forwards ParcelFlow auth, cookies or a body', async () => {
    fetchMock.mockResolvedValue(response())
    const results = await lookup.searchAddress('  Duong Xuan Thuy,   Ha Noi  ')
    const [url, options] = fetchMock.mock.calls[0]
    expect(url.origin).toBe('https://photon.komoot.io')
    expect(url.pathname).toBe('/api/')
    expect([...url.searchParams.keys()]).toEqual(['q', 'limit'])
    expect(url.searchParams.get('q')).toBe('Duong Xuan Thuy, Ha Noi')
    expect(options.credentials).toBe('omit')
    expect(new Headers(options.headers).has('Authorization')).toBe(false)
    expect(new Headers(options.headers).has('Cookie')).toBe(false)
    expect(options.body).toBeUndefined()
    expect(results[0]).toMatchObject({ point: { lat: 21.03, lng: 105.78 }, bounds: [[21.02, 105.77], [21.04, 105.79]] })
  })
  it('caches equivalent queries in memory and expires them', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-18T12:00:00Z'))
    fetchMock.mockImplementation(async () => response())
    await lookup.searchAddress('Duong Xuan Thuy')
    await lookup.searchAddress(' duong   xuan thuy ')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(300_001)
    await lookup.searchAddress('Duong Xuan Thuy')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('rejects invalid queries before sending requests', async () => {
    await expect(lookup.searchAddress('ab')).rejects.toBeInstanceOf(lookup.AddressSearchError)
    await expect(lookup.searchAddress('x'.repeat(256))).rejects.toBeInstanceOf(lookup.AddressSearchError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('limits rapid different queries across both pickers', async () => {
    fetchMock.mockResolvedValue(response())
    await lookup.searchAddress('Duong Xuan Thuy')
    await expect(lookup.searchAddress('Duong Dai Co Viet')).rejects.toThrow('chờ một nhịp')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('does not run parallel lookups', async () => {
    let finish!: (value: Response) => void
    fetchMock.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const first = lookup.searchAddress('Duong Xuan Thuy')
    await expect(lookup.searchAddress('Duong Dai Co Viet')).rejects.toBeInstanceOf(lookup.AddressSearchError)
    finish(response()); await first
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('skips invalid points and ignores invalid extents', async () => {
    fetchMock.mockResolvedValue(response([
      { ...feature, geometry: { type: 'Point', coordinates: [105, 91] } },
      { ...feature, geometry: { type: 'LineString', coordinates: [] } },
      { ...feature, properties: { name: 'Valid', extent: [105, 'bad', 106, 20] } },
    ]))
    const results = await lookup.searchAddress('Test place')
    expect(results).toHaveLength(1)
    expect(results[0].bounds).toBeUndefined()
  })
  it.each([429, 503])('handles provider HTTP %s without exposing its response', async status => {
    fetchMock.mockResolvedValue(new Response('private upstream diagnostic', { status }))
    await expect(lookup.searchAddress('Test place')).rejects.toBeInstanceOf(lookup.AddressSearchError)
  })
  it('rejects an invalid response envelope', async () => {
    fetchMock.mockResolvedValue(new Response('{}'))
    await expect(lookup.searchAddress('Test place')).rejects.toThrow('không hợp lệ')
  })
  it('aborts a stale lookup without converting it into a visible provider error', async () => {
    fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const controller = new AbortController()
    const pending = lookup.searchAddress('Test place', controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('times out and leaves retry under user control', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const pending = expect(lookup.searchAddress('Test place')).rejects.toBeInstanceOf(lookup.AddressSearchError)
    await vi.advanceTimersByTimeAsync(12_000); await pending
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
