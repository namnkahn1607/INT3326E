export interface AddressMatch {
  id: string
  label: string
  point: { lat: number; lng: number }
  bounds?: [[number, number], [number, number]]
}

export class AddressSearchError extends Error {}

const cache = new Map<string, { results: AddressMatch[]; at: number }>()
let lastRequest: number | null = null
let inFlight = false
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function parseResults(value: unknown): AddressMatch[] {
  if (!object(value) || !Array.isArray(value.features)) throw new AddressSearchError('Dịch vụ tìm địa chỉ trả dữ liệu không hợp lệ. Thử lại hoặc chọn điểm thủ công.')
  return value.features.flatMap((feature): AddressMatch[] => {
    if (!object(feature) || !object(feature.geometry) || feature.geometry.type !== 'Point' || !Array.isArray(feature.geometry.coordinates) || !object(feature.properties)) return []
    const [lng, lat] = feature.geometry.coordinates
    if (!finite(lat) || !finite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return []
    const properties = feature.properties
    const label = [...new Set(['name', 'street', 'district', 'city', 'county', 'state', 'country']
      .map(key => properties[key]).filter((text): text is string => typeof text === 'string' && !!text.trim()))].join(', ')
    if (!label) return []
    const result: AddressMatch = { id: `${lat},${lng},${label}`, label, point: { lat, lng } }
    const extent = properties.extent
    if (Array.isArray(extent) && extent.length === 4 && extent.every(finite)) {
      const [west, north, east, south] = extent
      if (Math.abs(west) <= 180 && Math.abs(east) <= 180 && Math.abs(south) <= 90 && Math.abs(north) <= 90 && west <= east && south <= north) result.bounds = [[south, west], [north, east]]
    }
    return [result]
  }).slice(0, 5)
}

export async function searchAddress(query: string, signal?: AbortSignal): Promise<AddressMatch[]> {
  const normalized = query.trim().replace(/\s+/g, ' ')
  if (normalized.length < 3 || normalized.length > 255) throw new AddressSearchError('Nhập tên đường/tòa nhà và khu vực từ 3 đến 255 ký tự để tìm.')
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const key = normalized.toLocaleLowerCase('vi')
  const saved = cache.get(key)
  if (saved && Date.now() - saved.at < 300_000 && Date.now() >= saved.at) return saved.results
  if (inFlight || (lastRequest !== null && Date.now() - lastRequest < 1200)) throw new AddressSearchError('Vui lòng chờ một nhịp trước khi tìm địa chỉ tiếp theo.')
  inFlight = true; lastRequest = Date.now()
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const url = new URL('https://photon.komoot.io/api/')
    url.search = new URLSearchParams({ q: normalized, limit: '5' }).toString()
    // Third-party search must never receive the ParcelFlow token or session cookies.
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json' }, referrerPolicy: 'strict-origin-when-cross-origin' })
    if (!response.ok) throw new AddressSearchError(response.status === 429 ? 'Dịch vụ đang giới hạn lượt tìm. Chờ một lúc hoặc chọn điểm thủ công.' : 'Dịch vụ tìm địa chỉ tạm gián đoạn. Thử lại hoặc chọn điểm thủ công.')
    const results = parseResults(await response.json())
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
    if (cache.size >= 30) cache.delete(cache.keys().next().value!)
    cache.set(key, { results, at: Date.now() })
    return results
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (error instanceof AddressSearchError) throw error
    throw new AddressSearchError('Không kết nối được dịch vụ tìm địa chỉ. Kiểm tra mạng, thử lại hoặc chọn điểm thủ công.')
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort); inFlight = false
  }
}
