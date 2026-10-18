import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Link, MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextType } from './context'
import { StartupExperience } from './StartupExperience'

const motion = vi.hoisted(() => ({ seen: false, reduced: false, remember: vi.fn() }))
vi.mock('./motion', () => ({ hasSeenIntro: () => motion.seen, rememberIntro: () => { motion.seen = true; motion.remember() }, useReducedMotion: () => motion.reduced }))
let root: Root
let node: HTMLDivElement
let auth: AuthContextType
let animations: { finish: () => void; cancel: ReturnType<typeof vi.fn> }[]
const originalAnimate = Element.prototype.animate
function tree(strict = false) {
  const content = <AuthContext.Provider value={auth}><MemoryRouter><StartupExperience>
    <h1>Login content</h1><Link to="/login">Back to login</Link>
  </StartupExperience></MemoryRouter></AuthContext.Provider>
  return strict ? <StrictMode>{content}</StrictMode> : content
}
async function render(strict = false) { await act(async () => root.render(tree(strict))) }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  motion.seen = false; motion.reduced = false; motion.remember.mockClear(); animations = []
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, writable: true, value: vi.fn(() => {
    let finish!: () => void
    const finished = new Promise<void>(done => { finish = done })
    const cancel = vi.fn(); animations.push({ finish, cancel })
    return { finished, cancel } as unknown as Animation
  }) })
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  auth = { user: null, token: null, loading: false, error: null, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() }
})
afterEach(async () => {
  await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals()
  if (originalAnimate) Element.prototype.animate = originalAnimate
  else Reflect.deleteProperty(Element.prototype, 'animate')
})

describe('Startup experience', () => {
  it('runs a single coordinated intro, removes its overlay, and never replays on routing', async () => {
    await render()
    expect(node.querySelector('[data-testid="startup-intro"]')).not.toBeNull()
    expect(node.querySelector('[inert]')).not.toBeNull()
    expect(motion.seen).toBe(true)
    expect(animations).toHaveLength(3)
    await act(async () => animations.forEach(animation => animation.finish()))
    expect(node.querySelector('[data-testid="startup-intro"]')).toBeNull()
    expect(node.querySelector('[inert]')).toBeNull()
    await act(async () => node.querySelector<HTMLAnchorElement>('a')!.click())
    expect(node.querySelector('[data-testid="startup-intro"]')).toBeNull()
    expect(animations).toHaveLength(3)
  })
  it('allows skipping and cancels all animations on unmount', async () => {
    await render()
    await act(async () => node.querySelector<HTMLButtonElement>('.auth-intro-skip')!.click())
    expect(node.querySelector('[inert]')).toBeNull()
    expect(animations.every(animation => animation.cancel.mock.calls.length === 1)).toBe(true)
  })
  it('skips intro when the same tab has already seen it', async () => {
    motion.seen = true; await render()
    expect(node.querySelector('[data-testid="startup-intro"]')).toBeNull()
    expect(animations).toHaveLength(0)
  })
  it('omits the scooter movement entirely for reduced motion', async () => {
    motion.reduced = true; await render()
    expect(node.querySelector('[data-testid="startup-intro"]')).toBeNull()
    expect(node.querySelector('h1')?.textContent).toBe('Login content')
    expect(animations).toHaveLength(0)
  })
  it('shows explicit loading during slow session verification, then bypasses intro for a valid session', async () => {
    auth.loading = true; await render()
    expect(node.querySelector('[role="status"]')?.textContent).toContain('Đang kiểm tra phiên')
    expect(node.querySelector('h1')).toBeNull()
    expect(animations).toHaveLength(0)
    auth = { ...auth, loading: false, user: { id: 'id', email: 'test@example.com', displayName: 'Tuấn', role: 'ADMIN' } }
    await render()
    expect(node.querySelector('[data-testid="startup-intro"]')).toBeNull()
    expect(node.querySelector('h1')).not.toBeNull()
    expect(motion.seen).toBe(true)
  })
  it('starts intro only after verification resolves as signed out', async () => {
    auth.loading = true; await render()
    auth = { ...auth, loading: false }; await render()
    expect(node.querySelector('[data-testid="startup-intro"]')).not.toBeNull()
  })
  it('does not replay when reduced motion is enabled mid-intro and then disabled', async () => {
    await render()
    motion.reduced = true; await render()
    expect(node.querySelector('[data-testid="startup-intro"]')).toBeNull()
    expect(animations.every(animation => animation.cancel.mock.calls.length === 1)).toBe(true)
    motion.reduced = false; await render()
    expect(node.querySelector('[data-testid="startup-intro"]')).toBeNull()
    expect(animations).toHaveLength(3)
  })
  it('cleans up the StrictMode probe and completes the live animation once', async () => {
    await render(true)
    expect(animations).toHaveLength(6)
    expect(animations.slice(0, 3).every(animation => animation.cancel.mock.calls.length === 1)).toBe(true)
    await act(async () => animations.forEach(animation => animation.finish()))
    expect(node.querySelector('[data-testid="startup-intro"]')).toBeNull()
  })
})
