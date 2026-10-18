import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextType, type UserProfile } from './context'
import { LoginPage } from './LoginPage'

let root: Root
let node: HTMLDivElement
let auth: AuthContextType
let from: string | undefined
const account = (role: UserProfile['role']): UserProfile => ({ id: 'account-id', email: 'test@example.com', role, displayName: 'Tuấn' })
function Destination() { const location = useLocation(); return <p data-testid="destination">{location.pathname}</p> }
function tree() {
  return <AuthContext.Provider value={auth}><MemoryRouter initialEntries={[{ pathname: '/login', state: { from } }]}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="*" element={<Destination />} />
  </Routes></MemoryRouter></AuthContext.Provider>
}
async function render() { await act(async () => root.render(tree())) }
async function change(selector: string, value: string) {
  await act(async () => {
    const input = node.querySelector<HTMLInputElement>(selector)!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function fill() { await change('#auth-email', 'test@example.com'); await change('#auth-password', 'test-password') }
const submit = () => node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  auth = { user: null, token: null, loading: false, error: null, login: vi.fn().mockResolvedValue(undefined), refresh: vi.fn().mockResolvedValue(undefined), logout: vi.fn() }
  from = undefined
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })

describe('ParcelFlow login', () => {
  it('provides Vietnamese labels and only supported actions', async () => {
    await render()
    expect(node.querySelector('h1')?.textContent).toBe('Chào mừng trở lại')
    expect(node.querySelector('label[for="auth-email"]')).not.toBeNull()
    expect(node.querySelector('label[for="auth-password"]')).not.toBeNull()
    expect(node.textContent).not.toMatch(/Quên mật khẩu|Ghi nhớ đăng nhập|Google|Đăng ký/)
    expect(node.querySelector('.auth-story svg')).not.toBeNull()
  })
  it('validates missing fields, focuses the first invalid input, and does not call auth', async () => {
    await render(); await act(async () => { submit() })
    expect(auth.login).not.toHaveBeenCalled()
    expect(node.querySelectorAll('[aria-invalid="true"]')).toHaveLength(2)
    expect(document.activeElement?.id).toBe('auth-email')
    expect(node.querySelector('#auth-password-error')?.textContent).toBe('Vui lòng nhập mật khẩu.')
  })
  it('rejects malformed email without imposing an unsupported password length', async () => {
    await render(); await change('#auth-email', 'invalid'); await change('#auth-password', 'short')
    await act(async () => { submit() })
    expect(auth.login).not.toHaveBeenCalled()
    expect(node.querySelector('#auth-email-error')?.textContent).toContain('email hợp lệ')
    expect(node.querySelector('#auth-password-error')).toBeNull()
  })
  it('toggles password visibility without submitting the form', async () => {
    await render(); await fill()
    await act(async () => node.querySelector<HTMLButtonElement>('[aria-label="Hiện mật khẩu"]')!.click())
    expect(node.querySelector<HTMLInputElement>('#auth-password')?.type).toBe('text')
    expect(node.querySelector('[aria-label="Ẩn mật khẩu"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(auth.login).not.toHaveBeenCalled()
  })
  it('validates email on blur, keeps errors for partial edits, and clears them only when valid', async () => {
    await render(); await change('#auth-email', 'partial')
    const input = node.querySelector<HTMLInputElement>('#auth-email')!
    expect(input.getAttribute('aria-invalid')).toBe('false')
    await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(input.getAttribute('aria-invalid')).toBe('true')
    input.focus(); await change('#auth-email', 'partial@')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(input)
    await change('#auth-email', 'test@example.com')
    expect(input.getAttribute('aria-invalid')).toBe('false')
    expect(node.querySelector('#auth-email-error')).toBeNull()
    expect(auth.login).not.toHaveBeenCalled()
  })
  it('prevents duplicate submits and waits for the backend role after Firebase resolves', async () => {
    let resolve!: () => void
    auth.login = vi.fn(() => new Promise<void>(done => { resolve = done }))
    await render(); await fill()
    await act(async () => { submit(); submit() })
    expect(auth.login).toHaveBeenCalledTimes(1)
    expect(node.querySelector<HTMLButtonElement>('.auth-submit')?.disabled).toBe(true)
    expect(node.querySelector('.auth-spinner')).not.toBeNull()
    await act(async () => resolve())
    expect(node.querySelector('[data-testid="destination"]')).toBeNull()
    expect(node.querySelector<HTMLButtonElement>('.auth-submit')?.disabled).toBe(true)
    expect(node.textContent).toContain('Đang xác nhận quyền')
    auth = { ...auth, loading: true }; await render()
    expect(node.querySelector('[data-testid="destination"]')).toBeNull()
    auth = { ...auth, user: account('CUSTOMER'), loading: false }; await render()
    expect(node.querySelector('[data-testid="destination"]')?.textContent).toBe('/customer')
  })
  it.each([
    ['auth/invalid-credential', 'Email hoặc mật khẩu chưa đúng'],
    ['auth/network-request-failed', 'kiểm tra mạng'],
    ['auth/too-many-requests', 'quá nhiều lần'],
  ])('keeps the form and announces a readable error for %s', async (code, message) => {
    auth.login = vi.fn().mockRejectedValue({ code })
    await render(); await fill(); await act(async () => { submit() })
    expect(node.querySelector('[role="alert"]')?.textContent).toContain(message)
    expect(document.activeElement).toBe(node.querySelector('[role="alert"]'))
    expect(node.querySelector<HTMLInputElement>('#auth-password')?.value).toBe('test-password')
    expect(node.querySelector<HTMLButtonElement>('.auth-submit')?.disabled).toBe(false)
    expect(node.querySelector('[data-testid="destination"]')).toBeNull()
  })
  it('allows recovery after role verification fails without pretending login succeeded', async () => {
    await render(); await fill(); await act(async () => { submit() })
    auth = { ...auth, error: 'Không xác nhận được quyền tài khoản.' }; await render()
    expect(node.querySelector<HTMLButtonElement>('.auth-submit')?.disabled).toBe(false)
    expect(node.querySelector('[data-testid="destination"]')).toBeNull()
    await act(async () => node.querySelector<HTMLButtonElement>('.auth-retry')!.click())
    expect(auth.refresh).toHaveBeenCalledTimes(1)
    auth = { ...auth, error: null, loading: true }; await render()
    expect(node.querySelector<HTMLButtonElement>('.auth-submit')?.disabled).toBe(true)
    auth = { ...auth, user: account('ADMIN'), loading: false }; await render()
    expect(node.querySelector('[data-testid="destination"]')?.textContent).toBe('/admin')
  })
  it.each([['CUSTOMER', '/customer'], ['DRIVER', '/driver'], ['ADMIN', '/admin']] as const)('routes a restored %s session to its own area', async (role, target) => {
    auth.user = account(role); auth.loading = true
    await render()
    expect(node.querySelector('[data-testid="destination"]')).toBeNull()
    auth = { ...auth, loading: false }; await render()
    expect(node.querySelector('[data-testid="destination"]')?.textContent).toBe(target)
    expect(auth.login).not.toHaveBeenCalled()
  })
  it('preserves a return path inside the permitted role area', async () => {
    from = '/customer/shipments/123'; auth.user = account('CUSTOMER'); await render()
    expect(node.querySelector('[data-testid="destination"]')?.textContent).toBe(from)
  })
  it.each(['/admin', '//example.com', '/customer-pretend', 'https://example.com'])('rejects the unsafe or wrong-role return path %s', async path => {
    from = path; auth.user = account('CUSTOMER'); await render()
    expect(node.querySelector('[data-testid="destination"]')?.textContent).toBe('/customer')
  })
})
