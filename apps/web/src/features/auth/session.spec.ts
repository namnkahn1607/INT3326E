import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseAccount, readSessionToken, setTokenReader } from './session'
import { apiClient } from '../../api/client'

afterEach(() => { setTokenReader(async () => null); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Authenticated client boundary', () => {
  it.each(['CUSTOMER', 'DRIVER', 'ADMIN'])('reads a verified backend %s profile', role => {
    expect(parseAccount({ uid: 'uid', role, email: 'user@example.test' })).toMatchObject({ id: 'uid', role })
  })
  it.each([null, {}, { uid: 'u', role: 'DISPATCHER' }, { uid: 'u', role: 'admin' }, { uid: 'u', role: 'ADMIN', email: {} }])(
    'rejects invalid or unsupported profiles', value => { expect(() => parseAccount(value)).toThrow() },
  )
  it('reads a fresh token for each API call and stops using it when signed out', async () => {
    const token = vi.fn().mockResolvedValueOnce('first-id-token').mockResolvedValueOnce('new-id-token')
    setTokenReader(token)
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', request)
    await apiClient('/auth/me')
    await apiClient('/auth/me')
    expect(request.mock.calls[0][1].headers.Authorization).toBe('Bearer first-id-token')
    expect(request.mock.calls[1][1].headers.Authorization).toBe('Bearer new-id-token')
    setTokenReader(async () => null)
    await apiClient('/auth/me')
    expect(request.mock.calls[2][1].headers.Authorization).toBeUndefined()
    expect(await readSessionToken()).toBeNull()
  })
})
