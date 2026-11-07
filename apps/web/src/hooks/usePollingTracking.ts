import { useEffect, useState } from 'react'
import { getShipmentTracking, type TrackingData } from '../api/endpoints/tracking'

export function usePollingTracking(
  shipmentId?: string,
  token?: string | null,
  intervalMs = 5000
) {
  const [data, setData] = useState<TrackingData | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    if (!shipmentId) return

    let isMounted = true

    const fetchTracking = async () => {
      try {
        setLoading(true)
        const result = await getShipmentTracking(shipmentId, token)
        if (isMounted) {
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchTracking()
    const timer = setInterval(fetchTracking, intervalMs)

    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [shipmentId, token, intervalMs])

  return { data, error, loading }
}
