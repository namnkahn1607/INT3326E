import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShipmentAddressModal, type ShipmentAddressValue } from './ShipmentAddressModal'
import type { AddressMatch } from './address-search'

const mocks = vi.hoisted(() => ({ load: vi.fn(), resolve: vi.fn(), save: vi.fn(), close: vi.fn(), search: vi.fn(),
  select: undefined as undefined | ((point: { lat: number; lng: number }, address?: AddressMatch['address']) => void | Promise<void>),
  resolving: undefined as undefined | ((kind: 'pickup' | 'dropoff', loading: boolean) => void),
  query: '', districtArea: null as AddressMatch | null, hideToggle: false,
}))
vi.mock('./address-search', async original => ({ ...await original<typeof import('./address-search')>(), searchAddress: mocks.search }))
vi.mock('./administrative-areas', async original => ({ ...await original<typeof import('./administrative-areas')>(), loadAdministrativeAreas: mocks.load, resolveAdministrativeSelection: mocks.resolve }))
vi.mock('./ShipmentLocationPicker', () => ({ ShipmentLocationPicker: ({ query, needsReview, onSelect, onResolvingChange, districtArea, hideToggle }: {
  query: string; needsReview: boolean; onSelect: typeof mocks.select; onResolvingChange: typeof mocks.resolving; districtArea: AddressMatch | null; hideToggle: boolean
}) => {
  mocks.select = onSelect; mocks.resolving = onResolvingChange; mocks.query = query
  mocks.districtArea = districtArea; mocks.hideToggle = hideToggle
  return <button type="button" data-review={!!needsReview} onClick={() => onSelect?.({ lat: 21.03, lng: 105.78 })}>Chọn điểm thử</button>
} }))
const province = { code: 1, name: 'Thành phố Hà Nội' }
const district = { code: 5, name: 'Quận Cầu Giấy' }
const ward = { code: 160, name: 'Phường Quan Hoa' }
const empty: ShipmentAddressValue = { street: '', area: '', details: '', point: null, divisions: null }
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.open = false } })
})
afterAll(() => {
  for (const [name, descriptor] of [['showModal', originalShow], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
})
let node: HTMLDivElement
let root: Root
const dialog = () => document.querySelector('dialog')!
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.search.mockReset().mockResolvedValue([]); mocks.districtArea = null; mocks.hideToggle = false
  mocks.resolve.mockReset().mockResolvedValue({ province, district, ward })
  mocks.save.mockReset(); mocks.close.mockReset(); mocks.load.mockReset().mockImplementation(async level => level === 'province' ? [province] : level === 'district' ? [district] : [ward])
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  await act(async () => root.render(<ShipmentAddressModal kind="pickup" value={empty} onSave={mocks.save} onClose={mocks.close} />))
  await act(async () => document.getElementById('address-modal-pickupLocation-launch')!.click())
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
async function input(id: string, value: string) {
  await act(async () => {
    const element = document.getElementById(id) as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function choose(id: string, value: string) {
  await act(async () => { const element = document.getElementById(id) as HTMLSelectElement; element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })) })
}
async function submit() { await act(async () => dialog().querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))) }
async function hierarchy() { await choose('address-district', '5'); await choose('address-ward', '160') }

describe('Address modal (real form/directory controls; mock map and directory API)', () => {
  it('reports directory lookup failure instead of silently replacing the current address', async () => {
    await input('address-street', 'User-entered street'); await input('address-details', 'Private instructions')
    await hierarchy()
    mocks.resolve.mockRejectedValue(new Error('Private directory diagnostic'))
    await act(async () => {
      await expect(mocks.select!({ lat: 21.03, lng: 105.78 }, { street: 'Provider street', area: 'Provider area' }))
        .rejects.toThrow('Chưa tải được quận/phường')
    })
    expect((document.getElementById('address-street') as HTMLInputElement).value).toBe('User-entered street')
    expect((document.getElementById('address-details') as HTMLInputElement).value).toBe('Private instructions')
    expect(document.querySelector('[data-review]')?.getAttribute('data-review')).toBe('true')
    await submit(); expect(mocks.save).not.toHaveBeenCalled()
  })
  it('opens an accessible dialog, labels the legacy data and defers descendant requests', () => {
    expect(dialog().open).toBe(true); expect(dialog().getAttribute('aria-labelledby')).toBe('address-modal-title')
    expect(dialog().textContent).toContain('trước 07/2025')
    expect(mocks.load).toHaveBeenCalledTimes(1)
    expect((document.getElementById('address-province') as HTMLSelectElement).disabled).toBe(true)
    expect(mocks.load).toHaveBeenCalledWith('district', 1, expect.any(AbortSignal))
    expect(document.body.style.overflow).toBe('hidden')
  })
  it('fixes the province to Hanoi and clears the ward when the district changes', async () => {
    await hierarchy()
    expect(mocks.query).toContain('Phường Quan Hoa, Quận Cầu Giấy, Thành phố Hà Nội')
    await choose('address-district', '')
    expect((document.getElementById('address-district') as HTMLSelectElement).value).toBe('')
    expect((document.getElementById('address-ward') as HTMLSelectElement).disabled).toBe(true)
    expect(mocks.query).not.toContain('Quan Hoa')
  })
  it('places region controls before street/details and opens a separate icon-only map dialog', async () => {
    const order = Array.from(dialog().querySelectorAll('input,select')).map(element => element.id)
    expect(order.indexOf('address-ward')).toBeLessThan(order.indexOf('address-street'))
    expect(order.indexOf('address-street')).toBeLessThan(order.indexOf('address-details'))
    const toggle = document.getElementById('address-modal-pickupLocation-launch')!
    expect(toggle.getAttribute('aria-label')).toBe('Mở bản đồ chọn vị trí')
    expect(toggle.getAttribute('aria-haspopup')).toBe('dialog')
    expect(toggle.textContent).toBe('')
    const mapDialog = document.querySelector<HTMLDialogElement>('.shipment-map-dialog')!
    expect(mapDialog.open).toBe(true)
    expect(dialog().contains(mapDialog)).toBe(false)
    expect(mocks.hideToggle).toBe(true)
    const picker = mapDialog.querySelector('[data-review]')
    await act(async () => mapDialog.querySelector<HTMLButtonElement>('[aria-label="Đóng bản đồ"]')!.click())
    expect(mapDialog.open).toBe(false)
    await act(async () => toggle.click())
    expect(mapDialog.open).toBe(true)
    expect(mapDialog.querySelector('[data-review]')).toBe(picker)
  })
  it('only frames a matching Hanoi district after opening, never sending private details or selecting a pin', async () => {
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Đóng bản đồ"]')!.click())
    const area: AddressMatch = { id: 'district', label: 'Cầu Giấy, Hà Nội, Việt Nam', point: { lat: 21.035, lng: 105.79 } }
    mocks.search.mockResolvedValue([area])
    await hierarchy(); await input('address-details', 'Private number TEST'); await input('address-street', 'Street TEST')
    expect(mocks.search).not.toHaveBeenCalled()
    await act(async () => document.getElementById('address-modal-pickupLocation-launch')!.click())
    expect(mocks.search).toHaveBeenCalledWith('Quận Cầu Giấy, Thành phố Hà Nội', expect.any(AbortSignal))
    expect(mocks.districtArea).toEqual(area)
    expect(mocks.save).not.toHaveBeenCalled()
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Đóng bản đồ"]')!.click())
    await submit()
    expect(dialog().textContent).toContain('Chọn hoặc xác nhận điểm')
  })
  it('skips district lookup when none is selected and keeps manual map selection available', () => {
    expect(mocks.search).not.toHaveBeenCalled()
    expect(mocks.districtArea).toBeNull()
    expect(document.querySelector('.shipment-map-dialog [data-review]')).not.toBeNull()
  })
  it('closes only the map on Escape, including when a search control has focus', async () => {
    const mapDialog = document.querySelector<HTMLDialogElement>('.shipment-map-dialog')!
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    await act(async () => mapDialog.querySelector('button')!.dispatchEvent(escape))
    expect(escape.defaultPrevented).toBe(true)
    expect(mapDialog.open).toBe(false)
    expect(dialog().open).toBe(true)
    expect(mocks.close).not.toHaveBeenCalled()
  })
  it('keeps the saved pin instead of looking up its district again', async () => {
    await act(async () => root.render(<ShipmentAddressModal key="saved" kind="pickup" value={{ ...empty, point: { lat: 21.03, lng: 105.79 },
      street: 'Saved road', area: 'Saved area', divisions: { province, district, ward } }} onSave={mocks.save} onClose={mocks.close} />))
    await act(async () => document.getElementById('address-modal-pickupLocation-launch')!.click())
    expect(mocks.search).not.toHaveBeenCalled()
    expect(mocks.districtArea).toBeNull()
  })
  it('does not consume duplicate district requests during Strict Mode effect replay', async () => {
    await act(async () => root.render(<StrictMode><ShipmentAddressModal key="strict" kind="pickup" value={{ ...empty, divisions: { province, district, ward } }} onSave={mocks.save} onClose={mocks.close} /></StrictMode>))
    await act(async () => document.getElementById('address-modal-pickupLocation-launch')!.click())
    expect(mocks.search).toHaveBeenCalledTimes(1)
  })
  it.each(['empty', 'failure', 'wrong district', 'outside Hanoi'])('falls back without framing or replacing the address on %s', async scenario => {
    if (scenario === 'failure') mocks.search.mockRejectedValue(new Error('Unavailable'))
    else mocks.search.mockResolvedValue(scenario === 'empty' ? [] : [{ id: 'wrong', label: scenario === 'wrong district' ? 'Ba Đình, Hà Nội' : 'Cầu Giấy, Hà Nội', point: { lat: 10, lng: 106 } }])
    await hierarchy()
    expect(mocks.districtArea).toBeNull()
    expect(document.querySelector('.shipment-map-dialog')?.textContent).toContain('Không tìm thấy khu vực.')
    expect((document.getElementById('address-street') as HTMLInputElement).value).toBe('')
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('aborts district lookup on close and ignores late results while retaining the address dialog', async () => {
    let finish!: (matches: AddressMatch[]) => void
    mocks.search.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await hierarchy()
    const signal = mocks.search.mock.calls.at(-1)![1] as AbortSignal
    await act(async () => document.querySelector('.shipment-map-dialog')!.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true })))
    expect(signal.aborted).toBe(true)
    expect(dialog().open).toBe(true)
    expect(mocks.close).not.toHaveBeenCalled()
    await act(async () => finish([{ id: 'late', label: 'Cầu Giấy, Hà Nội', point: { lat: 21.03, lng: 105.79 } }]))
    expect(mocks.districtArea).toBeNull()
  })
  it('accepts a short road and house number without a five-character requirement in the modal', async () => {
    await hierarchy(); await input('address-street', 'D1'); await input('address-details', '2')
    await act(async () => mocks.select!({ lat: 21, lng: 105 }))
    await submit()
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ street: 'D1', details: '2' }))
    expect(dialog().textContent).not.toContain('5–255')
  })
  it('saves street, private details, hierarchy and point atomically without posting an order', async () => {
    await input('address-street', 'Duong Xuan Thuy'); await input('address-details', 'So 144, tang 2'); await hierarchy()
    await act(async () => mocks.select!({ lat: 0, lng: 0 }))
    expect(mocks.query).not.toContain('tang 2')
    await submit()
    expect(mocks.save).toHaveBeenCalledWith({ street: 'Duong Xuan Thuy', details: 'So 144, tang 2',
      area: 'Phường Quan Hoa, Quận Cầu Giấy, Thành phố Hà Nội', point: { lat: 0, lng: 0 }, divisions: { province, district, ward } })
  })
  it('updates district and ward from the chosen point while preserving driver instructions', async () => {
    const newDistrict = { code: 1, name: 'Quận Ba Đình' }, newWard = { code: 10, name: 'Phường Phúc Xá' }
    mocks.resolve.mockResolvedValue({ province, district: newDistrict, ward: newWard })
    await hierarchy(); await input('address-details', 'Private instructions')
    await act(async () => mocks.select!({ lat: 21, lng: 105 }, { street: 'Public road', area: 'Phúc Xá, Ba Đình, Hà Nội' }))
    await submit()
    expect((document.getElementById('address-district') as HTMLSelectElement).value).toBe('1')
    expect((document.getElementById('address-ward') as HTMLSelectElement).value).toBe('10')
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ area: 'Phường Phúc Xá, Quận Ba Đình, Thành phố Hà Nội', details: 'Private instructions', divisions: { province, district: newDistrict, ward: newWard } })
  })
  it('updates the point and public street automatically without changing driver instructions', async () => {
    await hierarchy(); await input('address-details', 'Số 144, tầng 2, cổng sau')
    await act(async () => mocks.select!({ lat: 21.03, lng: 105.78 }, { street: 'Đường cũ', area: 'Khu vực cũ' }))
    await act(async () => mocks.select!({ lat: 21.04, lng: 105.79 }))
    await act(async () => mocks.select!({ lat: 21.04, lng: 105.79 }, { street: 'Đường mới', area: 'Khu vực mới' }))
    await submit()
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ point: { lat: 21.04, lng: 105.79 }, street: 'Đường mới',
      details: 'Số 144, tầng 2, cổng sau', area: 'Phường Quan Hoa, Quận Cầu Giấy, Thành phố Hà Nội' }))
  })
  it('keeps map-filled street and private details, with no free-text area mode', async () => {
    mocks.resolve.mockResolvedValueOnce({ province, district: null, ward: null })
    await input('address-details', 'Apartment TEST')
    await act(async () => mocks.select!({ lat: 21, lng: 105 }, { street: 'Road TEST', area: 'Area TEST' }))
    expect(document.getElementById('address-area')).toBeNull()
    expect(dialog().querySelector('input[type=checkbox]')).toBeNull()
    expect((document.getElementById('address-street') as HTMLInputElement).value).toBe('Road TEST')
    await submit(); expect(mocks.save).not.toHaveBeenCalled()
    expect(dialog().querySelector('[role=alert]')?.textContent).toContain('Chọn đủ')
    await hierarchy()
    await act(async () => mocks.select!({ lat: 21, lng: 105 }))
    await submit()
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ street: 'Road TEST', area: 'Phường Quan Hoa, Quận Cầu Giấy, Thành phố Hà Nội', details: 'Apartment TEST', divisions: { province, district, ward } })
  })
  it('clears old district/ward when the new point cannot be matched to the legacy directory', async () => {
    await hierarchy()
    mocks.resolve.mockResolvedValue({ province, district: null, ward: null })
    await act(async () => mocks.select!({ lat: 21, lng: 105 }, { street: 'Road', area: 'Unknown area' }))
    expect((document.getElementById('address-district') as HTMLSelectElement).value).toBe('')
    expect((document.getElementById('address-ward') as HTMLSelectElement).value).toBe('')
    await submit(); expect(mocks.save).not.toHaveBeenCalled()
  })
  it('ignores administrative results from a point replaced while its lookup was pending', async () => {
    let finish!: (value: { province: typeof province; district: typeof district; ward: typeof ward }) => void
    mocks.resolve.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    let pending!: Promise<void> | void
    await act(async () => { pending = mocks.select!({ lat: 21.03, lng: 105.78 }, { street: 'Old road', area: 'Old area' }) })
    const signal = mocks.resolve.mock.calls[0][1] as AbortSignal
    await act(async () => mocks.select!({ lat: 21.04, lng: 105.79 }))
    await act(async () => mocks.select!({ lat: 21.04, lng: 105.79 }, { street: 'New road', area: 'New area' }))
    expect(signal.aborted).toBe(true)
    await act(async () => { finish({ province, district, ward }); await pending })
    await submit()
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ street: 'New road', point: { lat: 21.04, lng: 105.79 } })
  })
  it('requires reconfirmation after public address edits, but not private detail edits', async () => {
    await hierarchy()
    await act(async () => mocks.select!({ lat: 21, lng: 105 }, { street: 'Road TEST', area: 'Area TEST' }))
    await input('address-details', 'Apartment TEST')
    expect(document.querySelector('[data-review]')?.getAttribute('data-review')).toBe('false')
    await input('address-street', 'New road')
    expect(document.querySelector('[data-review]')?.getAttribute('data-review')).toBe('true')
    await submit(); expect(mocks.save).not.toHaveBeenCalled()
    expect(dialog().querySelector('[role=alert]')?.textContent).toContain('xác nhận điểm')
    await act(async () => mocks.select!({ lat: 21, lng: 105 })); await submit()
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })
  it('blocks save while resolving and focuses validation feedback on a missing address', async () => {
    await act(async () => mocks.resolving!('pickup', true))
    expect(dialog().querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true)
    await submit(); expect(mocks.save).not.toHaveBeenCalled()
    await act(async () => mocks.resolving!('pickup', false)); await submit()
    expect(document.activeElement).toBe(dialog().querySelector('[role=alert]'))
  })
  it('offers directory retry without bringing back manual area input', async () => {
    mocks.load.mockRejectedValue(new Error('Danh mục tạm gián đoạn'))
    await choose('address-district', '5')
    expect(dialog().textContent).toContain('Thử tải lại danh mục')
    expect(dialog().querySelector('input[type=checkbox]')).toBeNull()
    expect(document.getElementById('address-area')).toBeNull()
    mocks.load.mockImplementation(async level => level === 'district' ? [district] : [ward])
    await act(async () => Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Thử tải lại danh mục')!.click())
    expect((document.getElementById('address-ward') as HTMLSelectElement).disabled).toBe(false)
  })
  it('supports Escape/cancel without saving and confirms before discarding edits', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await input('address-street', 'Edited road')
    await act(async () => dialog().dispatchEvent(new Event('cancel', { cancelable: true })))
    expect(confirm).toHaveBeenCalled(); expect(mocks.close).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    await act(async () => dialog().dispatchEvent(new Event('cancel', { cancelable: true })))
    expect(mocks.close).toHaveBeenCalledTimes(1); expect(mocks.save).not.toHaveBeenCalled()
  })
})
