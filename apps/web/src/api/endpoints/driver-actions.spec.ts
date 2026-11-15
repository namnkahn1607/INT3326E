import { afterEach, describe, expect, it, vi } from 'vitest'
import { deliverShipment, pickupShipment } from './shipments'
import { setTokenReader } from '../../features/auth/session'
import { shipmentFixture } from '../../features/customer/shipment-fixture'

const picked = { ...shipmentFixture, driverId: 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX', status: 'PICKED_UP' }
const delivered = { ...picked, status: 'DELIVERED', proofOfDeliveryNotes: 'Gửi lễ tân' }
afterEach(() => { vi.unstubAllGlobals(); setTokenReader(async () => null) })

describe('Driver pickup/deliver contract', () => {
  it('posts pickup without body/actor/idempotency and uses the session Bearer token', async () => {
    setTokenReader(async () => 'driver-token')
    const fetcher = vi.fn().mockResolvedValue(Response.json(picked)); vi.stubGlobal('fetch', fetcher)
    await expect(pickupShipment(picked.id)).resolves.toEqual(picked)
    const [url, options] = fetcher.mock.calls[0]
    expect(new URL(url).pathname).toBe('/v1/shipments/' + picked.id + '/pickup')
    expect(options.method).toBe('POST'); expect(options.body).toBeUndefined()
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer driver-token')
    expect(new Headers(options.headers).has('Idempotency-Key')).toBe(false)
  })
  it.each(['  Gửi lễ tân  ', '', '🚚'.repeat(255)])('sends only optional trimmed delivery notes', async notes => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(delivered)); vi.stubGlobal('fetch', fetcher)
    await expect(deliverShipment(picked.id, notes)).resolves.toEqual(delivered)
    const [url, options] = fetcher.mock.calls[0]
    expect(new URL(url).pathname).toBe('/v1/shipments/' + picked.id + '/deliver')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual(notes.trim() ? { proofOfDeliveryNotes: notes.trim() } : {})
  })
  it('validates ID and notes before any request', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    await expect(pickupShipment('../admin')).rejects.toMatchObject({ code: 'INVALID_SHIPMENT_ID' })
    await expect(deliverShipment('../admin', '')).rejects.toMatchObject({ code: 'INVALID_SHIPMENT_ID' })
    await expect(deliverShipment(picked.id, '🚚'.repeat(256))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each(['pickup', 'deliver'] as const)('rejects wrong ID/state/HTTP status and never retries %s', async action => {
    const call = () => action === 'pickup' ? pickupShipment(picked.id) : deliverShipment(picked.id, '')
    const valid = action === 'pickup' ? picked : delivered
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    for (const body of [{ ...valid, id: 'sh_01ARZ3NDEKTSV4RRFFQ69G5FAX' }, shipmentFixture]) {
      fetcher.mockResolvedValueOnce(Response.json(body))
      await expect(call()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    }
    fetcher.mockResolvedValueOnce(Response.json(valid, { status: 202 }))
    await expect(call()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    fetcher.mockResolvedValueOnce(Response.json({ code: 'INVALID_STATE_TRANSITION' }, { status: 409 }))
    await expect(call()).rejects.toMatchObject({ status: 409 })
    expect(fetcher).toHaveBeenCalledTimes(4)
  })
})
