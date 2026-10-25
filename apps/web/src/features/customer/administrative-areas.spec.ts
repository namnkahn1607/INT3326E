import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let areas: typeof import('./administrative-areas')
const fetchMock = vi.fn()
const province = { code: 1, name: 'Thành phố Hà Nội' }
const district = { code: 5, name: 'Quận Cầu Giấy' }
const ward = { code: 160, name: 'Phường Quan Hoa' }
beforeEach(async () => { vi.resetModules(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); areas = await import('./administrative-areas') })
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
describe('Legacy administrative directory (mock fetch)', () => {
  it('loads public codes for one level only, never the full depth=3 dataset', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([province])).mockResolvedValueOnce(Response.json({ ...province, districts: [district] }))
      .mockResolvedValueOnce(Response.json({ ...district, wards: [ward] }))
    const signal = new AbortController().signal
    expect(await areas.loadAdministrativeAreas('province', null, signal)).toEqual([province])
    expect(await areas.loadAdministrativeAreas('district', 1, signal)).toEqual([district])
    expect(await areas.loadAdministrativeAreas('ward', 5, signal)).toEqual([ward])
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://provinces.open-api.vn/api/v1/p/', 'https://provinces.open-api.vn/api/v1/p/1?depth=2', 'https://provinces.open-api.vn/api/v1/d/5?depth=2',
    ])
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.credentials).toBe('omit'); expect(options.body).toBeUndefined()
      expect(new Headers(options.headers).has('Authorization')).toBe(false)
    }
  })
  it('caches responses across reopening and both shipment addresses', async () => {
    fetchMock.mockResolvedValue(Response.json([province]))
    await areas.loadAdministrativeAreas('province', null, new AbortController().signal)
    await areas.loadAdministrativeAreas('province', null, new AbortController().signal)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('validates parents and aborts before issuing a request', async () => {
    await expect(areas.loadAdministrativeAreas('district', null, new AbortController().signal)).rejects.toThrow('cấp trên')
    await expect(areas.loadAdministrativeAreas('ward', -2, new AbortController().signal)).rejects.toThrow('cấp trên')
    const controller = new AbortController(); controller.abort()
    await expect(areas.loadAdministrativeAreas('province', null, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('rejects invalid data and HTTP errors without caching failures', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([{ code: '1', name: 'Invalid' }])).mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json([province]))
    await expect(areas.loadAdministrativeAreas('province', null, new AbortController().signal)).rejects.toThrow('không hợp lệ')
    await expect(areas.loadAdministrativeAreas('province', null, new AbortController().signal)).rejects.toThrow('Không tải được danh mục khu vực.')
    expect(await areas.loadAdministrativeAreas('province', null, new AbortController().signal)).toEqual([province])
  })
  it('times out and releases its timer/listener', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))))
    const result = expect(areas.loadAdministrativeAreas('province', null, new AbortController().signal)).rejects.toThrow('Không tải được danh mục khu vực.')
    await vi.advanceTimersByTimeAsync(8000); await result
    expect(vi.getTimerCount()).toBe(0)
  })
  it('formats the selected hierarchy in address order', () => {
    expect(areas.administrativeAddress({ province, district, ward })).toBe('Phường Quan Hoa, Quận Cầu Giấy, Thành phố Hà Nội')
  })
  it.each(['Ha Noi', 'Hanoi'])('matches public region names against districts and their own wards for %s', async city => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...province, districts: [district] }))
      .mockResolvedValueOnce(Response.json({ ...district, wards: [ward] }))
    expect(await areas.resolveAdministrativeSelection([city, 'Cau Giay', 'Quan Hoa'], new AbortController().signal)).toEqual({ province, district, ward })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['https://provinces.open-api.vn/api/v1/p/1?depth=2', 'https://provinces.open-api.vn/api/v1/d/5?depth=2'])
  })
  it('never invents or reuses codes for missing, ambiguous or non-Hanoi region names', async () => {
    expect(await areas.resolveAdministrativeSelection(['Hồ Chí Minh', 'Cầu Giấy'], new AbortController().signal)).toEqual({ province, district: null, ward: null })
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockResolvedValueOnce(Response.json({ ...province, districts: [district, { code: 6, name: 'Cau Giay' }] }))
    expect(await areas.resolveAdministrativeSelection(['Hà Nội', 'Cầu Giấy'], new AbortController().signal)).toEqual({ province, district: null, ward: null })
  })
  it('keeps only the matched district if its ward is missing from the legacy list', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...province, districts: [district] }))
      .mockResolvedValueOnce(Response.json({ ...district, wards: [ward] }))
    expect(await areas.resolveAdministrativeSelection(['Hà Nội', 'Cầu Giấy', 'Phường mới'], new AbortController().signal)).toEqual({ province, district, ward: null })
  })
})
