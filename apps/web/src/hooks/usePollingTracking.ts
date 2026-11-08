import { useCallback } from 'react'
import { getShipmentTracking, type TrackingData } from '../api/endpoints/tracking'
import { usePolledResource } from './usePolledResource'

const terminal = (data: TrackingData) => data.status === 'DELIVERED' || data.status === 'DELIVERY_FAILED'

export function usePollingTracking(
  shipmentId?: string,
  token?: string | null,
  intervalMs = 5000,
  accountScope = ''
) {
  const load = useCallback((signal: AbortSignal) => getShipmentTracking(shipmentId!, token, signal), [shipmentId, token])
  return usePolledResource(load, shipmentId ? JSON.stringify([accountScope, shipmentId, token]) : undefined, intervalMs, terminal)
}
