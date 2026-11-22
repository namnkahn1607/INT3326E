import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { getCustomers } from '../../api/endpoints/customers'
import { AuthContext, type AuthContextType, type UserProfile } from '../auth/context'
import { AdminAccountsPage } from './AdminAccountsPage'

vi.mock('../../api/endpoints/customers', () => ({ getCustomers: vi.fn() }))
const account: UserProfile = { id: 'admin-a', role: 'ADMIN', displayName: 'Quản trị', email: 'admin@example.invalid' }
const customer = { id: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAV', name: 'Khách từ API', email: 'buyer@example.invalid', phone: null }
const page = (data = [customer], nextCursor: string | null = null) => ({ data, pagination: { limit: 20, hasMore: nextCursor !== null, nextCursor } })
let root: Root, node: HTMLDivElement
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(getCustomers).mockResolvedValue(page())
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })
async function mount(user: UserProfile | null = account) {
  const auth: AuthContextType = { user, token: null, loading: false, error: null, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() }
  await act(async () => root.render(<AuthContext.Provider value={auth}><AdminAccountsPage /></AuthContext.Provider>))
}
async function click(text: string) {
  await act(async () => [...node.querySelectorAll<HTMLButtonElement>('button')].find(x => x.textContent === text)!.click())
}
it('shows only customer fields supplied by the directory, not invented roles/status', async () => {
  await mount()
  expect(node.textContent).toContain(customer.name)
  expect(node.textContent).toContain(customer.email)
  expect(node.textContent).not.toMatch(/U1|U2|U3|Hoạt động|tuan.admin/)
  expect(node.querySelector('tbody tr')?.children).toHaveLength(3)
  await click('Trang sau')
  expect(getCustomers).toHaveBeenCalledTimes(1)
})
it('paginates and refreshes the current cursor', async () => {
  vi.mocked(getCustomers).mockResolvedValue(page([customer], 'opaque+/='))
  await mount(); await click('Trang sau'); await click('Làm mới')
  expect(getCustomers).toHaveBeenLastCalledWith('opaque+/=', expect.any(AbortSignal))
  await click('Trang trước')
  expect(getCustomers).toHaveBeenLastCalledWith(undefined, expect.any(AbortSignal))
})
it('shows error/retry and a genuine empty state', async () => {
  vi.mocked(getCustomers).mockRejectedValue(new ApiError(503, 'SERVICE_UNAVAILABLE'))
  await mount()
  expect(node.querySelector('[role=alert]')).not.toBeNull()
  expect(node.textContent).not.toContain('Không có khách hàng.')
  vi.mocked(getCustomers).mockResolvedValue(page([])); await click('Tải lại khách hàng')
  expect(node.textContent).toContain('Không có khách hàng.')
})
it('aborts account-scoped reads and rejects late content on sign-out', async () => {
  let finish!: (value: ReturnType<typeof page>) => void
  vi.mocked(getCustomers).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await mount()
  const signal = vi.mocked(getCustomers).mock.calls[0][1]!
  await mount(null)
  expect(signal.aborted).toBe(true)
  await act(async () => finish(page()))
  expect(node.textContent).not.toContain(customer.email)
})
