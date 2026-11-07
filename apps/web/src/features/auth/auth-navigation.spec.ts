import { afterEach, describe, expect, it, vi } from 'vitest'
import { navigateAfterLogin } from './auth-navigation'

const original = document.startViewTransition
afterEach(() => {
  if (original) document.startViewTransition = original
  else Reflect.deleteProperty(document, 'startViewTransition')
  document.documentElement.classList.remove('auth-navigating')
})

describe('Post-login navigation', () => {
  it('navigates immediately without transition APIs, using the CSS arrival fallback', () => {
    Reflect.deleteProperty(document, 'startViewTransition')
    const commit = vi.fn(); navigateAfterLogin(commit, true)
    expect(commit).toHaveBeenCalledExactlyOnceWith(true)
  })
  it('does not animate reduced-motion or restored-session navigation', () => {
    const transition = vi.fn(); document.startViewTransition = transition
    const commit = vi.fn(); navigateAfterLogin(commit, false)
    expect(commit).toHaveBeenCalledExactlyOnceWith(false)
    expect(transition).not.toHaveBeenCalled()
  })
  it('commits inside the native snapshot callback with no artificial timer and cleans up', async () => {
    let finish!: () => void
    const finished = new Promise<void>(resolve => { finish = resolve })
    document.startViewTransition = vi.fn(callback => {
      (callback as () => void)()
      return { finished } as ViewTransition
    })
    const commit = vi.fn(); navigateAfterLogin(commit, true)
    expect(commit).toHaveBeenCalledExactlyOnceWith(false)
    expect(document.documentElement.classList.contains('auth-navigating')).toBe(true)
    finish(); await finished; await Promise.resolve(); await Promise.resolve()
    expect(document.documentElement.classList.contains('auth-navigating')).toBe(false)
  })
  it('still navigates when a browser cannot create the transition', () => {
    document.startViewTransition = vi.fn(() => { throw new Error('Unsupported context') })
    const commit = vi.fn(); navigateAfterLogin(commit, true)
    expect(commit).toHaveBeenCalledExactlyOnceWith(true)
    expect(document.documentElement.classList.contains('auth-navigating')).toBe(false)
  })
  it('falls back exactly once if a native transition fails before its update', async () => {
    document.startViewTransition = vi.fn(() => ({ finished: Promise.reject(new Error('Aborted')) }) as ViewTransition)
    const commit = vi.fn(); navigateAfterLogin(commit, true)
    await Promise.resolve(); await Promise.resolve()
    expect(commit).toHaveBeenCalledExactlyOnceWith(true)
    expect(document.documentElement.classList.contains('auth-navigating')).toBe(false)
  })
})
