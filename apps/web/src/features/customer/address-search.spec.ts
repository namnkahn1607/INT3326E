import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let lookup: typeof import('./address-search')
const fetchMock = vi.fn()
const feature = { id: 'auto:test', reference: 'auto:test', label: 'Đường Cầu Giấy, Hà Nội',
  address: { street: 'Đường Cầu Giấy', area: 'Phường Quan Hoa, Quận Cầu Giấy, Thành phố Hà Nội',
    regions: ['Phường Quan Hoa', 'Quận Cầu Giấy', 'Thành phố Hà Nội'] } }
const match = { ...feature, point: { lat: 21.03, lng: 105.78 } }
const rawFeature = { ref_id: feature.reference, name: feature.address.street, display: feature.label,
  boundaries: feature.address.regions.map((full_name, index) => ({ type: 2 - index, full_name })) }
const rawReverse = { ...rawFeature, ...match.point }
const rawPlace = { ...match.point, display: feature.label, street: feature.address.street,
  ward: feature.address.regions[0], district: feature.address.regions[1], city: feature.address.regions[2] }
const response = () => Response.json([rawFeature])
beforeEach(async () => {
  vi.resetModules(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('VITE_API_URL', 'http://localhost:3000/v1')
  vi.stubEnv('VITE_VIETMAP_API_KEY', 'demo-service-key')
  lookup = await import('./address-search')
  const session = await import('../auth/session'); session.setTokenReader(async () => 'session-token')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Direct VIETMAP demo (mock provider fetch)', () => {
  it('calls VIETMAP directly with only the public query and demo key, never Firebase credentials', async () => {
    fetchMock.mockResolvedValue(response())
    expect(await lookup.searchAddress('  Đường Cầu Giấy,   Hà Nội  ')).toEqual([feature])
    const [url, options] = fetchMock.mock.calls[0]
    const request = new URL(url)
    expect(request.origin + request.pathname).toBe('https://maps.vietmap.vn/api/autocomplete/v4')
    expect(request.searchParams.get('text')).toBe('Đường Cầu Giấy, Hà Nội')
    expect(request.searchParams.get('apikey')).toBe('demo-service-key')
    expect(request.searchParams.get('display_type')).toBe('2')
    expect(request.searchParams.get('focus')).toBe('21.0369,105.7906')
    expect(options.method).toBe('GET')
    expect(options.body).toBeUndefined()
    expect(options.credentials).toBe('omit')
    expect(new Headers(options.headers).has('Authorization')).toBe(false)
    expect(new Headers(options.headers).has('Cookie')).toBe(false)
    expect(options.redirect).toBe('error')
    expect(url).not.toContain('session-token')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('resolves only the selected suggestion, then caches its coordinates', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(response()).mockResolvedValueOnce(Response.json(rawPlace))
    const [suggestion] = await lookup.searchAddress('Đường Cầu Giấy')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const pending = lookup.resolveAddressSuggestion(suggestion)
    await vi.advanceTimersByTimeAsync(1200)
    expect(await pending).toEqual(match)
    const request = new URL(fetchMock.mock.calls[1][0])
    expect(request.pathname).toBe('/api/place/v4')
    expect(request.searchParams.get('refid')).toBe(feature.reference)
    expect(await lookup.resolveAddressSuggestion(suggestion)).toEqual(match)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('does not request details for an already resolved result', async () => {
    expect(await lookup.resolveAddressSuggestion(match)).toEqual(match)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('caches equivalent queries in memory and expires them', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-18T12:00:00Z'))
    fetchMock.mockImplementation(async () => response())
    await lookup.searchAddress('Đường Cầu Giấy')
    await lookup.searchAddress(' đường   cầu giấy ')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(300_001)
    await lookup.searchAddress('Đường Cầu Giấy')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('rejects invalid queries and coordinates before sending requests', async () => {
    await expect(lookup.searchAddress('ab')).rejects.toBeInstanceOf(lookup.AddressSearchError)
    await expect(lookup.searchAddress('x'.repeat(256))).rejects.toBeInstanceOf(lookup.AddressSearchError)
    await expect(lookup.reverseAddress({ lat: 91, lng: 1 })).rejects.toBeInstanceOf(lookup.AddressSearchError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('limits rapid different queries across both pickers', async () => {
    fetchMock.mockResolvedValue(response())
    await lookup.searchAddress('Đường Cầu Giấy')
    await expect(lookup.searchAddress('Đường Đại Cồ Việt')).rejects.toThrow('chờ một nhịp')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('does not run parallel searches', async () => {
    let finish!: (value: Response) => void
    fetchMock.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const first = lookup.searchAddress('Đường Cầu Giấy')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await expect(lookup.searchAddress('Đường Đại Cồ Việt')).rejects.toBeInstanceOf(lookup.AddressSearchError)
    finish(response()); await first
  })
  it('skips invalid points and rejects malformed response envelopes', async () => {
    fetchMock.mockResolvedValue(Response.json([{ ...rawFeature, lat: 91, lng: 105 }, {}, rawFeature]))
    expect(await lookup.searchAddress('Địa điểm')).toEqual([feature])
    vi.useFakeTimers(); await vi.advanceTimersByTimeAsync(1200)
    fetchMock.mockResolvedValue(Response.json({}))
    await expect(lookup.searchAddress('Địa điểm khác')).rejects.toThrow('không hợp lệ')
  })
  it.each([[401, 'Khóa tra'], [403, 'Khóa tra'], [404, 'VIETMAP'], [423, 'giới hạn'], [429, 'giới hạn'], [503, 'VIETMAP']])('handles provider HTTP %s without exposing diagnostics', async (status, message) => {
    fetchMock.mockResolvedValue(Response.json({ title: 'private upstream diagnostic' }, { status: Number(status) }))
    await expect(lookup.searchAddress('Địa điểm')).rejects.toThrow(String(message))
  })
  it('aborts stale lookups without showing a provider error', async () => {
    fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const controller = new AbortController()
    const pending = lookup.searchAddress('Địa điểm', controller.signal)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('times out and leaves retry under user control', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const pending = expect(lookup.searchAddress('Địa điểm')).rejects.toBeInstanceOf(lookup.AddressSearchError)
    await vi.advanceTimersByTimeAsync(12_000); await pending
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('reverse geocodes only rounded coordinates, not driver instructions or contacts', async () => {
    fetchMock.mockResolvedValue(Response.json([rawReverse]))
    const result = await lookup.reverseAddress({ lat: 21.0300001, lng: 105.7800001 })
    const [url, options] = fetchMock.mock.calls[0]
    const request = new URL(url)
    expect(request.origin + request.pathname).toBe('https://maps.vietmap.vn/api/reverse/v4')
    expect([...request.searchParams.keys()].sort()).toEqual(['apikey', 'display_type', 'lat', 'lng'])
    expect(request.searchParams.get('lat')).toBe('21.030000')
    expect(request.searchParams.get('lng')).toBe('105.780000')
    expect(request.searchParams.get('display_type')).toBe('2')
    expect(options.body).toBeUndefined()
    expect(new Headers(options.headers).has('Authorization')).toBe(false)
    expect(result?.address?.regions).toEqual(feature.address.regions)
    expect(await lookup.reverseAddress({ lat: 21.03, lng: 105.78 })).toEqual(match)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('waits for the rate window before a reverse lookup', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(response()).mockResolvedValueOnce(Response.json([rawReverse]))
    await lookup.searchAddress('Đường Cầu Giấy')
    const pending = lookup.reverseAddress({ lat: 21.03, lng: 105.78 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1200)
    expect(await pending).toEqual(match)
  })
  it('cancels a queued reverse lookup without sending it', async () => {
    vi.useFakeTimers(); fetchMock.mockResolvedValue(response())
    await lookup.searchAddress('Đường Cầu Giấy')
    const controller = new AbortController()
    const pending = expect(lookup.reverseAddress({ lat: 21.03, lng: 105.78 }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort(); await pending
    await vi.advanceTimersByTimeAsync(1500)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('returns null for a point with no result', async () => {
    fetchMock.mockResolvedValue(Response.json([]))
    expect(await lookup.reverseAddress({ lat: 21, lng: 105 })).toBeNull()
  })
  it('shows missing key without contacting ParcelFlow or another provider', async () => {
    vi.stubEnv('VITE_VIETMAP_API_KEY', '')
    await expect(lookup.searchAddress('Cầu Giấy')).rejects.toThrow('Chưa cấu hình')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('filters other provinces instead of guessing a legacy Hanoi district', async () => {
    fetchMock.mockResolvedValue(Response.json([{ ...rawReverse, boundaries: [{ type: 0, full_name: 'Hồ Chí Minh' }] }]))
    expect(await lookup.reverseAddress(match.point)).toBeNull()
  })
})
