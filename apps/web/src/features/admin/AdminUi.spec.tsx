import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminLayout } from '../../layouts/AdminLayout'
import { AdminShipmentsPage } from './AdminShipmentsPage'
import { AdminAssignmentPage } from './AdminAssignmentPage'

vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { displayName: 'Admin' }, logout: vi.fn() }) }))
let root: Root
let node: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })
async function mount(path: string) {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin" element={<AdminLayout />}>
    <Route path="shipments" element={<AdminShipmentsPage />} /><Route path="assignment" element={<AdminAssignmentPage />} />
  </Route></Routes></MemoryRouter>))
}

describe('Admin UI — honest demo boundaries', () => {
  it('labels demo data, provides a skip link, and does not claim live system health', async () => {
    await mount('/admin/shipments')
    expect(node.querySelector('.ui-demo-notice')?.textContent).toContain('dữ liệu mẫu')
    expect(node.querySelector('a[href="#admin-main"]')).not.toBeNull()
    expect(node.textContent).not.toContain('Hệ thống ổn định')
    expect(node.querySelector('.ui-result-count')?.textContent).toContain('5 kết quả')
    expect(node.querySelector('.data-table-wrapper[tabindex="0"]')).not.toBeNull()
  })
  it('uses the same sample set for combined filters and result counts and clears independently', async () => {
    await mount('/admin/shipments')
    await act(async () => {
      const input = node.querySelector<HTMLInputElement>('#admin-order-search')!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '89024')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const status = [...node.querySelectorAll<HTMLButtonElement>('.filter-chip')].find(button => button.textContent?.includes('Đang giao'))!
    await act(async () => status.click())
    expect(status.getAttribute('aria-pressed')).toBe('true')
    expect(node.querySelectorAll('.ui-filter-token')).toHaveLength(2)
    expect(node.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(node.querySelector('.ui-result-count')?.textContent).toContain('1 kết quả')
    await act(async () => node.querySelector<HTMLButtonElement>('[aria-label^="Bỏ lọc Tìm kiếm"]')!.click())
    expect(status.getAttribute('aria-pressed')).toBe('true')
    await act(async () => node.querySelector<HTMLButtonElement>('.ui-clear-filters')!.click())
    expect(node.querySelectorAll('tbody tr')).toHaveLength(5)
  })
  it('never announces a successful assignment or writes data from the demo selector', async () => {
    await mount('/admin/assignment')
    const submit = node.querySelector<HTMLButtonElement>('.assignment-action-bar button')!
    expect(submit.disabled).toBe(true)
    expect(node.querySelector('#assignment-disabled')?.textContent).toContain('Chọn một đơn')
    const cards = node.querySelectorAll<HTMLButtonElement>('.assignment-select-card')
    await act(async () => { cards[0].click(); cards[3].click() })
    expect(node.querySelectorAll('.assignment-select-card[aria-pressed="true"]')).toHaveLength(2)
    expect(submit.disabled).toBe(true)
    expect(node.querySelector('#assignment-disabled')?.textContent).toContain('Chưa kết nối API')
    await act(async () => submit.click())
    expect(node.textContent).not.toContain('Đã phân công đơn')
  })
})
