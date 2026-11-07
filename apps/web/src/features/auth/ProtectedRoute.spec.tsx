import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextType } from './context'
import { HomeRedirect, ProtectedRoute } from './ProtectedRoute'

let root: Root
let node: HTMLDivElement
beforeEach(() => { node = document.createElement('div'); document.body.append(node); root = createRoot(node); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true) })
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })

async function render(role: 'CUSTOMER' | 'DRIVER' | 'ADMIN' | null, loading = false) {
  const value: AuthContextType = { user: role ? { id: 'u', email: '', displayName: 'u', role } : null,
    token: null, loading, error: null, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() }
  await act(async () => root.render(<AuthContext.Provider value={value}>
    <MemoryRouter initialEntries={['/admin']}><Routes>
      <Route path="/login" element={<p>LOGIN</p>} />
      <Route element={<ProtectedRoute role="ADMIN" />}><Route path="/admin" element={<p>ADMIN CONTENT</p>} /></Route>
    </Routes></MemoryRouter>
  </AuthContext.Provider>))
}

describe('Role route protection', () => {
  it('waits for session restoration without exposing content', async () => {
    await render(null, true); expect(node.textContent).toContain('Đang kiểm tra'); expect(node.textContent).not.toContain('ADMIN CONTENT')
  })
  it('redirects signed-out visitors to login', async () => { await render(null); expect(node.textContent).toBe('LOGIN') })
  it.each(['CUSTOMER', 'DRIVER'] as const)('denies %s on Admin screens', async role => {
    await render(role); expect(node.textContent).toContain('Không có quyền'); expect(node.textContent).not.toContain('ADMIN CONTENT')
  })
  it('renders Admin content only for ADMIN', async () => { await render('ADMIN'); expect(node.textContent).toBe('ADMIN CONTENT') })
  it.each([null, 'CUSTOMER', 'DRIVER', 'ADMIN'] as const)('lands %s at the correct home', async role => {
    const value: AuthContextType = { user: role ? { id: 'u', email: '', displayName: 'u', role } : null,
      token: null, loading: false, error: null, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() }
    await act(async () => root.render(<AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/']}><Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<p>LOGIN</p>} />
        <Route path="/customer" element={<p>CUSTOMER</p>} />
        <Route path="/driver" element={<p>DRIVER</p>} />
        <Route path="/admin" element={<p>ADMIN</p>} />
      </Routes></MemoryRouter>
    </AuthContext.Provider>))
    expect(node.textContent).toBe(role ?? 'LOGIN')
  })
})
