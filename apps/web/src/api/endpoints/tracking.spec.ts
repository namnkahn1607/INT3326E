import { afterEach, describe, expect, it, vi } from 'vitest'
import { getShipmentTracking } from './tracking'
import { shipmentFixture } from '../../features/customer/shipment-fixture'

const snapshot = () => ({
  shipmentId: shipmentFixture.id, status: 'ASSIGNED', driverId: shipmentFixture.customerId,
  pickupLocation: { lat: 21, lng: 105 }, dropoffLocation: { lat: 21.1, lng: 105.1 },
  currentDriverLocation: { lat: 0, lng: 0 }, lastLocationUpdatedAt: '2026-10-30T03:00:00.000Z',
  locationClientTimestamp: '2026-10-30T03:00:00.000Z', isLocationStale: false,
  eta: null, etaUnavailableReason: 'NOT_PICKED_UP', expectedDeliveryAt: null, isLate: null,
})
afterEach(() => vi.unstubAllGlobals())
function respond(value: unknown, status = 200) {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(value), { status }))
  vi.stubGlobal('fetch', fetcher); return fetcher
}
describe('Tracking SC05 contract', () => {
  it('reads the authenticated endpoint and accepts actual 0,0', async () => {
    const value = snapshot(), fetcher = respond(value)
    await expect(getShipmentTracking(value.shipmentId, 'test-token')).resolves.toEqual(value)
    expect(new URL(fetcher.mock.calls[0][0]).pathname).toBe('/v1/shipments/' + value.shipmentId + '/tracking')
    expect(new Headers(fetcher.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer test-token')
  })
  it.each(['CREATED', 'DELIVERED', 'DELIVERY_FAILED'])('requires hidden GPS for %s', async status => {
    const value = { ...snapshot(), status, driverId: status === 'CREATED' ? null : shipmentFixture.customerId,
      currentDriverLocation: null, lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null }
    respond(value); await expect(getShipmentTracking(value.shipmentId)).resolves.toEqual(value)
    respond({ ...value, currentDriverLocation: { lat: 0, lng: 0 } })
    await expect(getShipmentTracking(value.shipmentId)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it.each([
    { status: 'PICKED_UP', etaUnavailableReason: 'CONFIG_INVALID' },
    { status: 'PICKED_UP', isLocationStale: true, etaUnavailableReason: 'LOCATION_STALE' },
    { status: 'PICKED_UP', currentDriverLocation: null, lastLocationUpdatedAt: null,
      locationClientTimestamp: null, isLocationStale: null, etaUnavailableReason: 'LOCATION_MISSING' },
    { status: 'PICKED_UP', eta: { distanceMeters: 0, estimatedSeconds: 0, estimatedArrivalAt: '2026-10-30T03:00:00.000Z' }, etaUnavailableReason: null },
  ])('accepts nullable/ETA coherence %#', async change => {
    const value = { ...snapshot(), ...change }; respond(value)
    await expect(getShipmentTracking(value.shipmentId)).resolves.toEqual(value)
  })
  it.each([
    { shipmentId: 'sh_01ARZ3NDEKTSV4RRFFQ69G5FAX' }, { driverId: null }, { status: 'UNKNOWN' },
    { currentDriverLocation: { lat: 91, lng: 0 } }, { currentDriverLocation: null },
    { locationClientTimestamp: 'not-a-date' }, { locationClientTimestamp: '2026-10-30T03:00:01.000Z' },
    { isLocationStale: null }, { isLate: false }, { extra: true },
    { etaUnavailableReason: 'LOCATION_MISSING' },
    { status: 'PICKED_UP', etaUnavailableReason: null },
    { status: 'PICKED_UP', isLocationStale: true, etaUnavailableReason: 'CONFIG_INVALID' },
    { status: 'PICKED_UP', eta: { distanceMeters: -1, estimatedSeconds: 0, estimatedArrivalAt: '2026-10-30T03:00:00.000Z' }, etaUnavailableReason: null },
  ])('rejects inconsistent snapshots %#', async change => {
    respond({ ...snapshot(), ...change })
    await expect(getShipmentTracking(shipmentFixture.id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('rejects missing fields, bad IDs and unexpected success status without retrying', async () => {
    const value: Record<string, unknown> = snapshot(); delete value.eta
    const fetcher = respond(value)
    await expect(getShipmentTracking(shipmentFixture.id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    await expect(getShipmentTracking('../admin')).rejects.toMatchObject({ code: 'INVALID_SHIPMENT_ID' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    respond(snapshot(), 202)
    await expect(getShipmentTracking(shipmentFixture.id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it.each(['+010000-10-30T03:00:00.000Z', '2026-10-30T03:00:00.0000Z', '2026-10-30T03:00:00.000+00:00'])('rejects noncanonical sample timestamp %s', async timestamp => {
    respond({ ...snapshot(), lastLocationUpdatedAt: timestamp, locationClientTimestamp: timestamp })
    await expect(getShipmentTracking(shipmentFixture.id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})
