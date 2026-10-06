import { useEffect, useState } from 'react'

export interface Coordinates {
  lat: number
  lng: number
}

export function useDriverLocation(watch = false) {
  const [coords, setCoords] = useState<Coordinates | null>(null)
  const [error, setError] = useState<string | null>(() => {
    if (typeof navigator !== 'undefined' && !navigator.geolocation) {
      return 'Geolocation không được hỗ trợ bởi trình duyệt này.'
    }
    return null
  })

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return
    }

    if (!watch) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => setError(err.message)
      )
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [watch])

  return { coords, error }
}
