import { useEffect, useState } from 'react'

export interface Coordinates {
  lat: number
  lng: number
  latitude: number
  longitude: number
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

    const geolocation = navigator.geolocation
    let active = true
    const onPosition = (pos: GeolocationPosition) => {
      if (!active) return
      setCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      })
      setError(null)
    }
    const onError = (err: GeolocationPositionError) => {
      if (active) setError(err.message)
    }

    if (!watch) {
      geolocation.getCurrentPosition(onPosition, onError)
      return () => { active = false }
    }

    const watchId = geolocation.watchPosition(
      onPosition,
      onError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )

    return () => { active = false; geolocation.clearWatch(watchId) }
  }, [watch])

  return { coords, error }
}
