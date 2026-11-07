import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePollingTracking } from './usePollingTracking'
import type { TrackingData } from '../api/endpoints/tracking'
import { shipmentFixture } from '../features/customer/shipment-fixture'
import { ApiError } from '../api/client'

const load = vi.hoisted(() => vi.fn())
vi.mock('../api/endpoints/tracking', () => ({ getShipmentTracking: load }))
let node: HTMLDivElement, root: Root, result: ReturnType<typeof usePollingTracking>
function Probe({ id, token }: { id?: string; token?: string }) {
  const tracking = usePollingTracking(id, token)
  useEffect(() => { result = tracking }, [tracking])
  return null
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers(); load.mockReset()
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })
const render = (id?: string, token?: string) => act(async () => root.render(<Probe id={id} token={token} />))
const first: TrackingData = { shipmentId: shipmentFixture.id, status: 'ASSIGNED', driverId: shipmentFixture.customerId,
  pickupLocation: { lat: 21, lng: 105 }, dropoffLocation: { lat: 21.1, lng: 105.1 },
  currentDriverLocation: { lat: 21, lng: 105 }, lastLocationUpdatedAt: '2026-10-30T03:00:00.000Z',
  locationClientTimestamp: '2026-10-30T03:00:00.000Z', isLocationStale: false,
  eta: null, etaUnavailableReason: 'NOT_PICKED_UP', expectedDeliveryAt: null, isLate: null }

describe('Tracking polling lifecycle (mock API)', () => {
  it('does not overlap requests when the API takes longer than the polling interval', async () => {
    let finish!: (value: TrackingData) => void
    load.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await render('shipment-a')
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
    const callsWhilePending = load.mock.calls.length
    await act(async () => finish(first))
    expect(callsWhilePending).toBe(1)
    expect(result.data).toEqual(first)
    expect(result.loading).toBe(false)
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(load).toHaveBeenCalledTimes(2)
  })
  it('aborts the previous request and ignores its response after the shipment changes', async () => {
    let finish!: (value: TrackingData) => void
    load.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
      .mockResolvedValueOnce({ shipmentId: 'shipment-b', status: 'PICKED_UP' })
    await render('shipment-a', 'token')
    const signal = load.mock.calls[0][2] as AbortSignal | undefined
    await render('shipment-b', 'token')
    await act(async () => finish(first))
    expect(signal?.aborted).toBe(true)
    expect(result.data?.shipmentId).toBe('shipment-b')
  })
  it('does not expose a previous shipment when the current identifier is cleared', async () => {
    load.mockResolvedValue(first)
    await render('shipment-a')
    await render()
    expect(result).toMatchObject({ data: null, error: null, loading: false })
    expect(vi.getTimerCount()).toBe(0)
  })
  it('hides old account data while a replacement token is loading', async () => {
    let finish!: (value: TrackingData) => void
    load.mockResolvedValueOnce(first).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    await render('shipment-a', 'first-token'); await render('shipment-a', 'second-token')
    const dataWhilePending = result.data
    await act(async () => finish(first))
    expect(dataWhilePending).toBeNull()
  })
  it('reports failures and clears them after a successful poll', async () => {
    load.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(first)
    await render('shipment-a')
    expect((result.error as Error)?.message).toBe('Unavailable')
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(result.error).toBeNull(); expect(result.data).toEqual(first)
  })
  it.each(['DELIVERED', 'DELIVERY_FAILED'] as const)('stops scheduling on %s and only rereads manually', async status => {
    load.mockResolvedValue({ ...first, status, currentDriverLocation: null, lastLocationUpdatedAt: null,
      locationClientTimestamp: null, isLocationStale: null })
    await render('shipment-a')
    await act(async () => vi.advanceTimersByTimeAsync(20_000))
    expect(load).toHaveBeenCalledTimes(1)
    await act(async () => result.refresh())
    expect(load).toHaveBeenCalledTimes(2)
  })
  it.each([401, 403, 404])('clears previous GPS and stops for HTTP%s', async status => {
    load.mockResolvedValueOnce(first).mockRejectedValue(new ApiError(status, 'HTTP_ERROR'))
    await render('shipment-a')
    await act(async () => vi.advanceTimersByTimeAsync(20_000))
    expect(result.data).toBeNull(); expect(result.error).toBeInstanceOf(ApiError)
    expect(load).toHaveBeenCalledTimes(2)
  })
  it('drops GPS on transient failure and restores it on a later successful read', async () => {
    load.mockResolvedValueOnce(first).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(first)
    await render('shipment-a')
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(result.data).toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(result.data).toEqual(first)
  })
})
