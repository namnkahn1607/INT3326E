import { useEffect, useState } from 'react'
import { getShipmentTracking, type TrackingData } from '../api/endpoints/tracking'

export function usePollingTracking(
  shipmentId?: string,
  token?: string | null,
  intervalMs = 5000
) {
  const [result, setResult] = useState<{
    shipmentId: string
    token?: string | null
    data: TrackingData | null
    error: Error | null
    loading: boolean
  } | null>(null)

  useEffect(() => {
    if (!shipmentId) return

    let active = true
    let pending = false
    const controller = new AbortController()

    const fetchTracking = async () => {
      if (!active || pending) return
      pending = true
      setResult(previous => ({
        shipmentId, token,
        data: previous?.shipmentId === shipmentId && previous.token === token ? previous.data : null,
        error: null, loading: true,
      }))
      try {
        const data = await getShipmentTracking(shipmentId, token, controller.signal)
        if (active) setResult({ shipmentId, token, data, error: null, loading: false })
      } catch (err) {
        if (active) setResult(previous => ({
          shipmentId, token,
          data: previous?.shipmentId === shipmentId && previous.token === token ? previous.data : null,
          error: err instanceof Error ? err : new Error(String(err)), loading: false,
        }))
      } finally {
        pending = false
      }
    }

    fetchTracking()
    const timer = setInterval(fetchTracking, intervalMs)

    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
    }
  }, [shipmentId, token, intervalMs])

  return result && result.shipmentId === shipmentId && result.token === token
    ? { data: result.data, error: result.error, loading: result.loading }
    : { data: null, error: null, loading: false }
}
