import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => { vi.resetModules(); sessionStorage.clear() })
describe('Tab-local intro memory', () => {
  it('remembers only an intro flag in sessionStorage', async () => {
    const motion = await import('./motion')
    expect(motion.hasSeenIntro()).toBe(false)
    motion.rememberIntro()
    expect(motion.hasSeenIntro()).toBe(true)
    expect(sessionStorage.length).toBe(1)
    expect(sessionStorage.getItem('parcelflow:intro-seen:v1')).toBe('1')
  })
  it('survives a module reload within the same tab', async () => {
    const first = await import('./motion'); first.rememberIntro(); vi.resetModules()
    const next = await import('./motion')
    expect(next.hasSeenIntro()).toBe(true)
  })
  it('falls back to memory when private-mode storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
    const motion = await import('./motion')
    expect(motion.hasSeenIntro()).toBe(false)
    expect(() => motion.rememberIntro()).not.toThrow()
    expect(motion.hasSeenIntro()).toBe(true)
  })
})
