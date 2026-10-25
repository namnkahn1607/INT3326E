export interface AdministrativeArea { code: number; name: string }
export interface AdministrativeSelection {
  province: AdministrativeArea | null
  district: AdministrativeArea | null
  ward: AdministrativeArea | null
}

const cache = new Map<string, AdministrativeArea[]>()
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'

export async function loadAdministrativeAreas(level: 'province' | 'district' | 'ward', parent: number | null, signal: AbortSignal): Promise<AdministrativeArea[]> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  if (level !== 'province' && (!Number.isSafeInteger(parent) || parent! <= 0)) throw new Error('Chọn khu vực cấp trên trước.')
  const path = level === 'province' ? '/p/' : `/${level === 'ward' ? 'd' : 'p'}/${parent}?depth=2`
  const key = path
  const saved = cache.get(key)
  if (saved) return saved
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, 8000)
  try {
    // Only public administrative codes go to this service, never shipment addresses or tokens.
    const response = await fetch('https://provinces.open-api.vn/api/v1' + path, {
      signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json' }, referrerPolicy: 'no-referrer',
    })
    if (!response.ok) throw new Error('Không tải được danh mục khu vực.')
    const data: unknown = await response.json()
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const list = level === 'province' ? data : object(data) ? data[level === 'district' ? 'districts' : 'wards'] : null
    if (!Array.isArray(list) || !list.every(item => object(item) && Number.isSafeInteger(item.code) && Number(item.code) > 0 && typeof item.name === 'string' && item.name.trim())) {
      throw new Error('Danh mục khu vực không hợp lệ.')
    }
    const results = list.map(item => ({ code: item.code as number, name: item.name as string }))
    if (cache.size >= 100) cache.delete(cache.keys().next().value!)
    cache.set(key, results)
    return results
  } catch (error) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    throw new Error(error instanceof Error && error.name !== 'AbortError' && error.message.startsWith('Danh mục') ? error.message : 'Không tải được danh mục khu vực.', { cause: error })
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', abort)
  }
}

export function administrativeAddress(value: AdministrativeSelection): string {
  return [value.ward?.name, value.district?.name, value.province?.name].filter(Boolean).join(', ')
}

export async function resolveAdministrativeSelection(regions: readonly string[], signal: AbortSignal): Promise<AdministrativeSelection> {
  const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim().replace(/\s+/g, ' ')
  const withoutPrefix = (name: string) => normalize(name).replace(/^(thanh pho|tinh|quan|huyen|thi xa|phuong|xa|thi tran)\s+/, '')
  const names = new Set(regions.flatMap(name => [normalize(name), withoutPrefix(name)]))
  const selection: AdministrativeSelection = { province: { code: 1, name: 'Thành phố Hà Nội' }, district: null, ward: null }
  if (!names.has('ha noi') && !names.has('hanoi')) return selection
  const districts = (await loadAdministrativeAreas('district', 1, signal)).filter(area => names.has(withoutPrefix(area.name)))
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  if (districts.length !== 1) return selection
  selection.district = districts[0]
  const wards = (await loadAdministrativeAreas('ward', districts[0].code, signal)).filter(area => names.has(withoutPrefix(area.name)))
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  if (wards.length === 1) selection.ward = wards[0]
  return selection
}
