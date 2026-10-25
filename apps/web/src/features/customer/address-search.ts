export interface AddressSuggestion {
  id: string
  label: string
  reference?: string
  point?: { lat: number; lng: number }
  bounds?: [[number, number], [number, number]]
  address?: { street: string; area: string; regions?: string[] }
}
export interface AddressMatch extends AddressSuggestion { point: { lat: number; lng: number } }

export class AddressSearchError extends Error {}

const cache = new Map<string, { results: AddressSuggestion[]; at: number }>()
let lastRequest: number | null = null
let inFlight = false
let requestDone: Promise<void> = Promise.resolve()
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const hanoi = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^thanh pho\s+/, '').replace(/\s+/g, '') === 'hanoi'

function parseResults(value: unknown, operation: 'search' | 'reverse' | 'place', reference?: string): AddressSuggestion[] {
  if (operation === 'place' ? !object(value) : !Array.isArray(value)) throw new AddressSearchError('Dữ liệu địa chỉ không hợp lệ.')
  const items: unknown[] = operation === 'place' ? [value] : value as unknown[]
  return items.flatMap((item): AddressSuggestion[] => {
    if (!object(item)) return []
    const boundaries = Array.isArray(item.boundaries) ? item.boundaries.filter(object) : []
    const city = operation === 'place' ? text(item.city) : text(boundaries.find(region => region.type === 0)?.full_name)
    if (!hanoi(city)) return []
    const regions = operation === 'place' ? [text(item.ward), text(item.district), city].filter(Boolean)
      : boundaries.map(region => text(region.full_name)).filter(Boolean)
    const street = operation === 'place' ? text(item.street) || text(item.name) || text(item.address) : text(item.name)
    const label = text(item.display) || [street, ...regions].filter(Boolean).join(', ')
    const ref = reference || text(item.ref_id)
    const point = finite(item.lat) && finite(item.lng) && Math.abs(item.lat) <= 90 && Math.abs(item.lng) <= 180
      ? { lat: item.lat, lng: item.lng } : undefined
    if ((item.lat !== undefined || item.lng !== undefined) && !point) return []
    if (!label || (operation === 'search' ? !ref : !point)) return []
    return [{ id: ref || label, label, ...(point ? { point } : {}), ...(ref ? { reference: ref } : {}),
      address: { street, area: regions.join(', '), regions } }]
  }).slice(0, 5)
}

export async function searchAddress(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const normalized = query.trim().replace(/\s+/g, ' ')
  if (normalized.length < 3 || normalized.length > 255) throw new AddressSearchError('Nhập tên đường/tòa nhà và khu vực từ 3 đến 255 ký tự để tìm.')
  const key = normalized.toLocaleLowerCase('vi')
  return fetchAddress('search', { query: normalized }, key, signal)
}

export async function reverseAddress(point: { lat: number; lng: number }, signal?: AbortSignal): Promise<AddressMatch | null> {
  if (!finite(point.lat) || !finite(point.lng) || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) {
    throw new AddressSearchError('Điểm được chọn không hợp lệ.')
  }
  const selected = { lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) }
  const results = await fetchAddress('reverse', selected, 'reverse:' + JSON.stringify(selected), signal, true)
  const result = results.find((match): match is AddressMatch => !!match.point)
  return result ?? null
}

export async function resolveAddressSuggestion(match: AddressSuggestion, signal?: AbortSignal): Promise<AddressMatch> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  if (match.point) return { ...match, point: match.point }
  if (!match.reference) throw new AddressSearchError('Chưa lấy được vị trí địa chỉ.')
  const results = await fetchAddress('place', { reference: match.reference }, 'place:' + match.reference, signal, true)
  const result = results.find((item): item is AddressMatch => !!item.point)
  if (!result) throw new AddressSearchError('Chưa lấy được vị trí địa chỉ.')
  return result
}

function waitFor(promise: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal?.removeEventListener('abort', abort)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal?.removeEventListener('abort', abort))
  })
}

async function fetchAddress(operation: 'search' | 'reverse' | 'place', body: Record<string, string | number>, key: string, signal?: AbortSignal, waitForSlot = false): Promise<AddressSuggestion[]> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const apiKey = import.meta.env.VITE_VIETMAP_API_KEY?.trim()
  if (!apiKey) throw new AddressSearchError('Chưa cấu hình khóa tra địa chỉ VIETMAP.')
  const saved = cache.get(key)
  if (saved && Date.now() - saved.at < 300_000 && Date.now() >= saved.at) return saved.results
  if (waitForSlot) while (inFlight) await waitFor(requestDone, signal)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  if (inFlight || (!waitForSlot && lastRequest !== null && Date.now() - lastRequest < 1200)) {
    throw new AddressSearchError('Vui lòng chờ một nhịp trước khi tìm địa chỉ tiếp theo.')
  }
  inFlight = true
  let release!: () => void
  requestDone = new Promise(resolve => { release = resolve })
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  let delay: ReturnType<typeof setTimeout> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const pause = waitForSlot && lastRequest !== null ? Math.max(0, 1200 - (Date.now() - lastRequest)) : 0
    if (pause) await waitFor(new Promise(resolve => { delay = setTimeout(resolve, pause) }), controller.signal)
    if (signal?.aborted || controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
    lastRequest = Date.now()
    const url = new URL('https://maps.vietmap.vn/api/' + (operation === 'search' ? 'autocomplete' : operation) + '/v4')
    url.searchParams.set('apikey', apiKey)
    if (operation === 'search') {
      url.searchParams.set('text', String(body.query)); url.searchParams.set('focus', '21.0369,105.7906')
      url.searchParams.set('display_type', '2')
    } else if (operation === 'reverse') {
      url.searchParams.set('lat', Number(body.lat).toFixed(6)); url.searchParams.set('lng', Number(body.lng).toFixed(6))
      url.searchParams.set('display_type', '2')
    } else url.searchParams.set('refid', String(body.reference))
    timeout = setTimeout(() => controller.abort(), 12_000)
    // Temporary user-approved demo: the browser key is public; never forward the Firebase token.
    const response = await fetch(url.href, { method: 'GET', credentials: 'omit', redirect: 'error',
      headers: { Accept: 'application/json' }, signal: controller.signal })
    if (response.status === 401 || response.status === 403) throw new AddressSearchError('Khóa tra địa chỉ VIETMAP không hợp lệ hoặc chưa được cấp quyền.')
    if (response.status === 423 || response.status === 429) throw new AddressSearchError('Đã đạt giới hạn tra địa chỉ. Vui lòng thử lại sau.')
    if (!response.ok) throw new AddressSearchError('Chưa kết nối được dịch vụ địa chỉ VIETMAP. Vui lòng thử lại.')
    let value: unknown
    try { value = await response.json() } catch { throw new AddressSearchError('Dữ liệu địa chỉ không hợp lệ.') }
    const results = parseResults(value, operation, operation === 'place' ? String(body.reference) : undefined)
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
    if (cache.size >= 30) cache.delete(cache.keys().next().value!)
    cache.set(key, { results, at: Date.now() })
    return results
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (error instanceof AddressSearchError) throw error
    throw new AddressSearchError('Chưa kết nối được dịch vụ địa chỉ VIETMAP. Vui lòng thử lại.')
  } finally {
    clearTimeout(delay); clearTimeout(timeout); signal?.removeEventListener('abort', abort); inFlight = false; release()
  }
}
