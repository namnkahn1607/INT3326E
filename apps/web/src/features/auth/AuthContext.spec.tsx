import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

type SessionUser = { uid: string; getIdToken: () => Promise<string> }
type Change = (user: SessionUser | null) => Promise<void>
const sdk = vi.hoisted(() => ({
  auth: { currentUser: null as SessionUser | null },
  change: null as Change | null,
  fail: null as (() => void) | null,
  backend: vi.fn(), login: vi.fn(), logout: vi.fn(), unsubscribe: vi.fn(), init: vi.fn(),
}))
vi.mock('./firebase', () => ({ getClientAuth: sdk.init }))
vi.mock('../../api/client', () => ({ apiClient: sdk.backend }))
vi.mock('firebase/auth', () => ({
  onIdTokenChanged: (...args: unknown[]) => {
    sdk.change = args[1] as Change
    sdk.fail = args[2] as () => void
    return sdk.unsubscribe
  },
  signInWithEmailAndPassword: sdk.login,
  signOut: sdk.logout,
}))

let root: Root
let node: HTMLDivElement
function Probe() {
  const { user, loading, error, login, logout } = useAuth()
  return <div><p>{loading ? 'loading' : user?.role ?? 'signed-out'}{error ? ' error' : ''}</p>
    <button onClick={() => void login('user@auth.test', 'password')}>login</button>
    <button onClick={() => void logout()}>logout</button>
  </div>
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  sdk.init.mockReset().mockReturnValue(sdk.auth)
  sdk.backend.mockReset()
  sdk.login.mockReset().mockResolvedValue(undefined)
  sdk.logout.mockReset().mockImplementation(async () => { sdk.auth.currentUser = null })
  sdk.auth.currentUser = null
  sdk.change = null
  sdk.fail = null
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals() })
async function mount() { await act(async () => root.render(<AuthProvider><Probe /></AuthProvider>)) }
function user(uid = 'uid') { return { uid, getIdToken: vi.fn().mockResolvedValue('id-token') } }

describe('Firebase session integration', () => {
  it('starts without a fake demo identity and restores the signed-out state', async () => {
    await mount(); expect(node.textContent).toContain('loading')
    await act(async () => sdk.change!(null))
    expect(node.textContent).toContain('signed-out')
  })
  it.each(['CUSTOMER', 'DRIVER', 'ADMIN'])('uses the backend-verified %s profile', async role => {
    sdk.backend.mockResolvedValue({ uid: 'uid', email: 'u@auth.test', role })
    await mount()
    await act(async () => sdk.change!(user()))
    expect(node.querySelector('p')?.textContent).toBe(role)
    expect(sdk.backend).toHaveBeenCalledWith('/auth/me', { token: 'id-token' })
  })
  it('rejects a missing/invalid role or mismatched identity without showing protected content', async () => {
    await mount()
    for (const result of [{ uid: 'uid', role: 'DISPATCHER' }, { uid: 'uid' }, { uid: 'another', role: 'ADMIN' }]) {
      sdk.backend.mockResolvedValueOnce(result)
      await act(async () => sdk.change!(user()))
      expect(node.querySelector('p')?.textContent).toBe('signed-out error')
    }
  })
  it('does not revive a session when an old profile request finishes after logout', async () => {
    let finish!: (value: unknown) => void
    sdk.backend.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await mount()
    let pending!: Promise<void>
    await act(async () => { pending = sdk.change!(user()) })
    await act(async () => { node.querySelectorAll('button')[1].click() })
    await act(async () => { finish({ uid: 'uid', role: 'ADMIN' }); await pending })
    expect(node.querySelector('p')?.textContent).toBe('signed-out')
  })
  it('does not replace a newer session with an older in-flight response', async () => {
    let finish!: (value: unknown) => void
    sdk.backend.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    sdk.backend.mockResolvedValueOnce({ uid: 'new-user', role: 'DRIVER' })
    await mount()
    let old!: Promise<void>
    await act(async () => { old = sdk.change!(user('old-user')) })
    await act(async () => sdk.change!(user('new-user')))
    await act(async () => { finish({ uid: 'old-user', role: 'ADMIN' }); await old })
    expect(node.querySelector('p')?.textContent).toBe('DRIVER')
  })
  it('clears authenticated state on observer failure', async () => {
    sdk.backend.mockResolvedValue({ uid: 'uid', role: 'ADMIN' })
    await mount(); await act(async () => sdk.change!(user()))
    await act(async () => sdk.fail!())
    expect(node.querySelector('p')?.textContent).toBe('signed-out error')
  })
  it('keeps the current screen mounted during a same-account token refresh', async () => {
    sdk.backend.mockResolvedValueOnce({ uid: 'uid', role: 'ADMIN' })
    await mount(); await act(async () => sdk.change!(user()))
    let finish!: (value: unknown) => void
    sdk.backend.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    let pending!: Promise<void>
    await act(async () => { pending = sdk.change!(user()) })
    expect(node.querySelector('p')?.textContent).toBe('ADMIN')
    await act(async () => { finish({ uid: 'uid', role: 'ADMIN' }); await pending })
  })
  it('uses Firebase email/password login without accepting a user-selected role', async () => {
    await mount(); await act(async () => sdk.change!(null))
    await act(async () => node.querySelector('button')!.click())
    expect(sdk.login).toHaveBeenCalledWith(sdk.auth, 'user@auth.test', 'password')
  })
  it('fails closed when Firebase configuration is missing', async () => {
    sdk.init.mockImplementationOnce(() => { throw new Error('Missing configuration') })
    await mount()
    expect(node.querySelector('p')?.textContent).toBe('signed-out error')
    expect(sdk.backend).not.toHaveBeenCalled()
  })
})
