import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDrivers } from './drivers'

const driver = { id: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAV', name: 'Tài xế thử nghiệm', activeShipmentCount: 0,
  currentLocation: null, lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null }
const page = (data: unknown[]) => ({ data, pagination: { limit: 20, hasMore: false, nextCursor: null } })
afterEach(() => vi.unstubAllGlobals())

describe('Admin API11 contract', () => {
  it('uses /drivers and preserves an opaque cursor without extra query fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(page([driver]))))
    vi.stubGlobal('fetch', fetcher)
    expect(await getDrivers({ cursor: 'opaque+/=' })).toEqual(page([driver]))
    const url = new URL(fetcher.mock.calls[0][0])
    expect(url.pathname).toBe('/v1/drivers')
    expect([...url.searchParams]).toEqual([['limit', '20'], ['cursor', 'opaque+/=']])
  })
  it('accepts zero coordinates for active drivers and nullable GPS without inventing online status', async () => {
    const located = { ...driver, activeShipmentCount: 3, currentLocation: { lat: 0, lng: 0 },
      lastLocationUpdatedAt: '2026-10-24T01:00:00.000Z', locationClientTimestamp: '2026-10-24T00:59:59.000Z', isLocationStale: false }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(page([located, { ...driver, id: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX', activeShipmentCount: 1 }])))))
    expect((await getDrivers()).data).toHaveLength(2)
  })
  it.each([
    { ...driver, id: 'D01' }, { ...driver, activeShipmentCount: -1 }, { ...driver, activeShipmentCount: 1.5 },
    { ...driver, currentLocation: { lat: 0, lng: 0 } }, { ...driver, isLocationStale: false },
    { ...driver, online: true }, { ...driver, activeShipmentCount: 2, currentLocation: { lat: 91, lng: 0 } },
  ])('rejects invalid driver rows %j', async value => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(page([value])))))
    await expect(getDrivers()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('rejects an invalid cursor envelope and does not mask dependency failures as empty', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [], pagination: { limit: 20, hasMore: true, nextCursor: 'x' } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'SERVICE_UNAVAILABLE' }), { status: 503 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(getDrivers()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    await expect(getDrivers()).rejects.toMatchObject({ status: 503 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
