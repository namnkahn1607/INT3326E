import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerOverviewPage } from './CustomerOverviewPage'
import { CustomerHomeHeader } from './CustomerHomeHeader'
import { CustomerLayout } from '../../layouts/CustomerLayout'
import { shipmentFixture } from './shipment-fixture'

const api = vi.hoisted(() => ({ list: vi.fn(), userId: 'customer-a' }))
vi.mock('../../api/endpoints/shipments', () => ({ getShipments: api.list }))
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { id: api.userId, displayName: 'Tega' }, logout: vi.fn() }) }))
let node: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  api.list.mockReset(); api.userId = 'customer-a'
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })
function Target() { return <p data-testid="target">{useLocation().search}</p> }
async function mount() {
  await act(async () => root.render(<MemoryRouter initialEntries={['/customer']}><Routes>
    <Route path="/customer" element={<><CustomerHomeHeader /><CustomerOverviewPage /></>} />
    <Route path="/customer/shipments" element={<Target />} />
  </Routes></MemoryRouter>))
}
const page = (data: unknown[]) => ({ data, pagination: { limit: 20, hasMore: false, nextCursor: null } })

describe('Premium Customer home', () => {
  it('greets the signed-in user and shows only canonical shipment progress', async () => {
    api.list.mockResolvedValue(page([{ ...shipmentFixture, status: 'PICKED_UP', driverId: shipmentFixture.customerId, packageDescription: 'Electronics' }]))
    await mount()
    expect(node.querySelector('h1')!.textContent).toContain('Hello, Tega!')
    expect(node.textContent).toContain('Deliveringwhat matters.')
    expect(node.textContent).toContain(shipmentFixture.trackingNumber)
    expect(node.querySelector('[aria-current="step"]')!.textContent).toContain('In transit')
    expect(node.querySelector('.pf-home-nav a[aria-current="page"]')?.textContent).toBe('Tổng quan')
    expect(node.textContent).not.toContain('Out for delivery')
  })
  it('does not invent a shipment on empty or failed reads', async () => {
    api.list.mockResolvedValue(page([])); await mount()
    expect(node.textContent).toContain('Ready for your next delivery?')
    expect(node.textContent).not.toContain('TRK782910')
  })
  it('offers recovery when the shipment API is unavailable', async () => {
    api.list.mockRejectedValue(new Error('unavailable')); await mount()
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('Updates are unavailable')
    expect(node.querySelector('.pf-shipment-detail')?.getAttribute('href')).toBe('/customer/shipments')
  })
  it('carries the entered tracking number into the existing order list', async () => {
    api.list.mockResolvedValue(page([])); await mount()
    await act(async () => {
      const input = node.querySelector<HTMLInputElement>('[name="trackingNumber"]')!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, ' PF20261018ABC234 ')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(node.querySelector('[data-testid="target"]')!.textContent).toBe('?trackingNumber=PF20261018ABC234')
  })
  it('keeps one search entry and removes the redundant quick-actions row', async () => {
    api.list.mockResolvedValue(page([])); await mount()
    expect(node.querySelectorAll('form[aria-label="Tra cứu đơn hàng"]')).toHaveLength(1)
    expect(node.querySelectorAll('input[name="trackingNumber"]')).toHaveLength(1)
    expect(node.querySelector('.pf-quick-actions')).toBeNull()
    expect(node.querySelector('.pf-more-actions')).toBeNull()
    expect(node.querySelector('.pf-promo')).not.toBeNull()
    expect(node.querySelector('.pf-active-shipment')).not.toBeNull()
    expect(node.querySelector('.pf-home-nav a[href="/customer/shipments"]')).not.toBeNull()
  })
  it('opens all orders when the home search is submitted without a tracking number', async () => {
    api.list.mockResolvedValue(page([])); await mount()
    await act(async () => node.querySelector<HTMLButtonElement>('.pf-track-form button')!.click())
    expect(node.querySelector('[data-testid="target"]')).not.toBeNull()
    expect(node.querySelector('[data-testid="target"]')?.textContent).toBe('')
  })
  it('aborts the active shipment request on unmount', async () => {
    api.list.mockReturnValue(new Promise(() => {})); await mount()
    const signal = api.list.mock.calls[0][1] as AbortSignal
    await act(async () => root.render(<p>Other route</p>))
    expect(signal.aborted).toBe(true)
  })

  it('cycles the banner in both directions and keeps inactive slides inert', async () => {
    api.list.mockResolvedValue(page([])); await mount()
    const current = () => node.querySelector('.pf-promo-copy[aria-hidden="false"]')!
    expect(current().textContent).toContain('Deliveringwhat matters.')
    expect(node.querySelectorAll('.pf-promo-copy[inert]')).toHaveLength(2)
    const next = node.querySelector<HTMLButtonElement>('button[aria-label="Nội dung tiếp theo"]')!
    const previous = node.querySelector<HTMLButtonElement>('button[aria-label="Nội dung trước"]')!
    await act(async () => next.click())
    expect(current().querySelector('a')?.getAttribute('href')).toBe('/customer/shipments')
    expect(node.querySelector('.pf-promo [role="status"]')?.textContent).toContain('2 / 3')
    await act(async () => previous.click())
    await act(async () => previous.click())
    expect(current().querySelector('a')?.getAttribute('href')).toBe('/customer/history')
    await act(async () => next.click())
    expect(current().querySelector('a')?.getAttribute('href')).toBe('/customer/create')
    expect(node.querySelectorAll('.pf-promo-copy[inert]')).toHaveLength(2)
  })

  it('selects a banner directly using dots with no transition for keyboard activation', async () => {
    api.list.mockResolvedValue(page([])); await mount()
    const dots = node.querySelectorAll<HTMLButtonElement>('.pf-promo-dots button')
    await act(async () => dots[2].dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
    expect(dots[2].getAttribute('aria-pressed')).toBe('true')
    expect(node.querySelector('.pf-promo--animated')).not.toBeNull()
    await act(async () => dots[1].click())
    expect(dots[1].getAttribute('aria-pressed')).toBe('true')
    expect(node.querySelectorAll('.pf-promo-dots [aria-pressed="true"]')).toHaveLength(1)
    expect(node.querySelector('.pf-promo--animated')).toBeNull()
  })

  it('uses an independent image slot for each banner slide', async () => {
    api.list.mockResolvedValue(page([])); await mount()
    const dots = node.querySelectorAll<HTMLButtonElement>('.pf-promo-dots button')
    expect(node.querySelector('.pf-promo-visual img')).not.toBeNull()
    await act(async () => dots[1].click())
    expect(node.querySelector('.pf-promo-visual img')).toBeNull()
    expect(node.querySelector('.pf-promo-visual [role="img"]')?.getAttribute('aria-label')).toContain('slide 2')
    await act(async () => dots[2].click())
    expect(node.querySelector('.pf-promo-visual [role="img"]')?.getAttribute('aria-label')).toContain('slide 3')
    await act(async () => dots[0].click())
    expect(node.querySelector('.pf-promo-visual img')).not.toBeNull()
  })
})

describe('Shared Customer navigation', () => {
  it.each([
    ['/customer', 'Tổng quan'],
    ['/customer/create', 'Tạo đơn mới'],
    ['/customer/shipments', 'Đơn hàng'],
    ['/customer/shipments/' + shipmentFixture.id, 'Đơn hàng'],
    ['/customer/history', 'Lịch sử'],
    ['/customer/notifications', 'Thông báo'],
  ])('keeps the shared shell and selects only the current tab on %s', async (path, label) => {
    await act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/customer/*" element={<CustomerLayout />} />
    </Routes></MemoryRouter>))
    expect(node.querySelector('.customer-layout--premium')).not.toBeNull()
    expect(node.querySelectorAll('header')).toHaveLength(1)
    expect(node.querySelectorAll('.pf-home-nav a')).toHaveLength(4)
    expect(node.querySelectorAll('header a[href="/customer/create"]')).toHaveLength(1)
    expect(node.querySelector('.pf-home-nav a[href="/customer/create"]')).toBeNull()
    expect(node.querySelector('.pf-header-send')?.textContent).toBe('Tạo đơn mới')
    expect(node.querySelector('.pf-home-header-actions')?.firstElementChild).toBe(node.querySelector('.pf-header-send'))
    const selected = node.querySelectorAll('.pf-home-nav [aria-current="page"], .pf-header-send[aria-current="page"]')
    expect(selected).toHaveLength(1)
    expect(selected[0].textContent).toBe(label)
    expect(node.querySelector('.customer-announcement')).toBeNull()
    expect(node.querySelector('.pf-home-footer')).not.toBeNull()
  })

  it('updates the active tab when following a navigation link', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/customer']}><CustomerHomeHeader /></MemoryRouter>))
    const link = node.querySelector<HTMLAnchorElement>('.pf-home-nav a[href="/customer/history"]')!
    await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
    expect(node.querySelector('.pf-home-nav [aria-current="page"]')?.textContent).toBe('Lịch sử')
  })

  it('opens create using the single header action without a duplicate tab', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/customer']}><CustomerHomeHeader /></MemoryRouter>))
    await act(async () => node.querySelector<HTMLAnchorElement>('.pf-header-send')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
    expect(node.querySelector('.pf-header-send')?.getAttribute('aria-current')).toBe('page')
    expect(node.querySelector('.pf-home-nav [aria-current="page"]')).toBeNull()
  })
})

describe('Customer ambient background', () => {
  async function mountShell() {
    await act(async () => root.render(<MemoryRouter initialEntries={['/customer']}><Routes>
      <Route path="/customer/*" element={<CustomerLayout />} />
    </Routes></MemoryRouter>))
  }

  it('keeps decoration hidden from screen readers and lets the user pause and resume', async () => {
    await mountShell()
    expect(node.querySelector('.pf-customer-backdrop')?.getAttribute('aria-hidden')).toBe('true')
    expect(node.querySelector('.pf-backdrop-wash')).toBeNull()
    expect(node.querySelectorAll('.pf-backdrop-parcel')).toHaveLength(2)
    const button = node.querySelector<HTMLButtonElement>('.pf-background-toggle')!
    expect(button.getAttribute('aria-pressed')).toBe('false')
    await act(async () => button.click())
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(node.querySelector('.customer-layout')?.getAttribute('data-background-paused')).toBe('true')
    await act(async () => button.click())
    expect(node.querySelector('.customer-layout')?.getAttribute('data-background-paused')).toBe('false')
  })

  it('preserves the pause choice while navigating within Customer', async () => {
    await mountShell()
    await act(async () => node.querySelector<HTMLButtonElement>('.pf-background-toggle')!.click())
    await act(async () => node.querySelector<HTMLAnchorElement>('.pf-home-nav a[href="/customer/history"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
    expect(node.querySelector('.pf-home-nav [aria-current="page"]')?.textContent).toBe('Lịch sử')
    expect(node.querySelector('.pf-background-toggle')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('uses a static background when the system requests reduced motion', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    await mountShell()
    const button = node.querySelector<HTMLButtonElement>('.pf-background-toggle')!
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain('Nền tĩnh')
    expect(node.querySelector('.customer-layout')?.getAttribute('data-background-paused')).toBe('true')
  })
})
