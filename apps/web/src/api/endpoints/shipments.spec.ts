import { afterEach, describe, expect, it, vi } from 'vitest'
import { assignShipment, createShipment, getShipmentById, getShipments } from './shipments'
import { shipmentFixture } from '../../features/customer/shipment-fixture'

afterEach(() => vi.unstubAllGlobals())

describe('Admin Assign contract', () => {
  const driverId = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX'
  const assigned = { ...shipmentFixture, status: 'ASSIGNED', driverId }
  it('posts only driverId, no actor/idempotency field, and waits for 200', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(assigned)))
    vi.stubGlobal('fetch', fetcher)
    expect(await assignShipment(shipmentFixture.id, driverId)).toEqual(assigned)
    expect(new URL(fetcher.mock.calls[0][0]).pathname).toBe(`/v1/shipments/${shipmentFixture.id}/assign`)
    const options = fetcher.mock.calls[0][1]
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ driverId })
    expect(new Headers(options.headers).has('Idempotency-Key')).toBe(false)
  })
  it.each([
    { ...assigned, id: 'sh_01ARZ3NDEKTSV4RRFFQ69G5FAX' },
    { ...assigned, driverId: shipmentFixture.customerId },
    { ...assigned, status: 'PICKED_UP' }, shipmentFixture,
  ])('does not confirm mismatched success %j', async response => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(response))))
    await expect(assignShipment(shipmentFixture.id, driverId)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('rejects malformed IDs without writing and does not retry 409', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'CONFLICT' }), { status: 409 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(assignShipment('../admin', driverId)).rejects.toMatchObject({ status: 400 })
    await expect(assignShipment(shipmentFixture.id, 'D01')).rejects.toMatchObject({ status: 400 })
    expect(fetcher).not.toHaveBeenCalled()
    await expect(assignShipment(shipmentFixture.id, driverId)).rejects.toMatchObject({ status: 409 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})

describe('Customer shipment contract', () => {
  it('sends only canonical payload and the caller intent key', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(shipmentFixture), { status: 201 }))
    vi.stubGlobal('fetch', fetcher)
    const payload = { pickupAddress: '144 Xuan Thuy', pickupLocation: { lat: 0, lng: 0 },
      dropoffAddress: '1 Dai Co Viet', dropoffLocation: { lat: 21, lng: 105 },
      recipientName: 'Nguoi nhan', recipientPhone: '0901234567' }
    await expect(createShipment(payload, '9cda2e85-391d-444b-bf03-83f9aa2f9321')).resolves.toEqual(shipmentFixture)
    const options = fetcher.mock.calls[0][1]
    expect(new Headers(options.headers).get('Idempotency-Key')).toBe('9cda2e85-391d-444b-bf03-83f9aa2f9321')
    expect(JSON.parse(options.body)).toEqual(payload)
  })
  it('reads a scoped envelope and encodes opaque cursors', async () => {
    const page = { data: [shipmentFixture], pagination: { limit: 20, hasMore: false, nextCursor: null } }
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(page)))
    vi.stubGlobal('fetch', fetcher)
    expect(await getShipments({ status: 'CREATED', cursor: 'opaque+/=' })).toEqual(page)
    const url = new URL(fetcher.mock.calls[0][0])
    expect(url.searchParams.get('cursor')).toBe('opaque+/=')
    expect(url.searchParams.get('status')).toBe('CREATED')
    expect(url.searchParams.get('limit')).toBe('20')
  })
  it('passes an exact tracking-number filter from the home search', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], pagination: { limit: 20, hasMore: false, nextCursor: null } })))
    vi.stubGlobal('fetch', fetcher)
    await getShipments({ trackingNumber: 'PF20261018ABC234' })
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('trackingNumber')).toBe('PF20261018ABC234')
  })
  it.each([
    { ...shipmentFixture, trackingNumber: undefined },
    { ...shipmentFixture, pickupLocation: { lat: 91, lng: 0 } },
    { ...shipmentFixture, status: 'DISPATCHER' },
    { ...shipmentFixture, isLate: undefined },
  ])('rejects a malformed Create response instead of confirming success', async response => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 201 })))
    await expect(createShipment({} as never, 'key')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('requires the Detail history and rejects a legacy bare array list', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(shipmentFixture)))
      .mockResolvedValueOnce(new Response(JSON.stringify([shipmentFixture])))
    vi.stubGlobal('fetch', fetcher)
    await expect(getShipmentById(shipmentFixture.id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    await expect(getShipments()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('does not accept a successful body with the wrong HTTP Create status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(shipmentFixture), { status: 200 })))
    await expect(createShipment({} as never, 'key')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('parses canonical Detail events without changing their actor or timestamps', async () => {
    const detail = { ...shipmentFixture, statusHistory: [{ id: '4cd63f70-00d0-4d6c-b622-c90a8af6b70e',
      shipmentId: shipmentFixture.id, action: 'CREATED', fromStatus: null, toStatus: 'CREATED',
      actorUserId: shipmentFixture.customerId, actorRole: 'CUSTOMER', previousDriverId: null,
      newDriverId: null, reason: null, occurredAt: shipmentFixture.createdAt }] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(detail))))
    expect(await getShipmentById(shipmentFixture.id)).toEqual(detail)
  })
  it.each([
    { limit: 20, hasMore: true, nextCursor: null },
    { limit: 0, hasMore: false, nextCursor: null },
    { limit: 20, hasMore: false, nextCursor: 'unexpected' },
  ])('rejects inconsistent pagination', async pagination => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [shipmentFixture], pagination }))))
    await expect(getShipments()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('rejects a malformed detail ID without issuing a request', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    await expect(getShipmentById('../admin')).rejects.toMatchObject({ code: 'INVALID_SHIPMENT_ID' })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
