import { useCallback, useRef } from 'react'
import type { ShipmentResponse } from '../types/shipment-api'
import type { ShipmentStatus } from '../types/shipment'

export function useTrackingDetailSync(shipment: ShipmentResponse | null, refresh: () => void) {
  const requested = useRef<string | null>(null)
  const id = shipment?.id, status = shipment?.status, driverId = shipment?.driverId, isLate = shipment?.isLate
  return useCallback((nextStatus: ShipmentStatus, nextDriverId: string | null, nextIsLate: boolean | null) => {
    if (!id || (status === nextStatus && driverId === nextDriverId && isLate === nextIsLate)) return
    const key = JSON.stringify([id, nextStatus, nextDriverId, nextIsLate])
    // A failed detail read is retried explicitly, rather than on every GPS sample.
    if (requested.current === key) return
    requested.current = key
    refresh()
  }, [id, status, driverId, isLate, refresh])
}
