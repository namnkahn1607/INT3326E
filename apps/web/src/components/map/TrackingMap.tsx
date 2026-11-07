import { useEffect, useRef } from 'react'
import { divIcon, latLngBounds } from 'leaflet'
import { MapContainer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet'
import type { Coordinates } from '../../types/shipment-api'
import { useReducedMotion } from '../../features/auth/motion'
import { OsmBaseLayer } from './OsmBaseLayer'
import 'leaflet/dist/leaflet.css'
import './tracking-map.css'

export interface TrackingPin {
  id: string; label: string; position: Coordinates; kind: 'pickup' | 'dropoff' | 'fresh' | 'stale'
}
const icons = Object.fromEntries(['pickup', 'dropoff', 'fresh', 'stale'].map(kind => [kind, divIcon({
  className: 'tracking-pin-shell', html: `<span class="tracking-pin tracking-pin--${kind}"></span>`,
  iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14],
})]))

function Frame({ pins, scope, selectedId }: { pins: TrackingPin[]; scope: string; selectedId?: string }) {
  const map = useMap(), reduced = useReducedMotion(), previous = useRef('')
  const key = JSON.stringify([scope, selectedId, pins.map(pin => pin.id)])
  useEffect(() => {
    if (key === previous.current || pins.length === 0) return
    previous.current = key
    const selected = pins.find(pin => pin.id === selectedId)
    if (selected) map.setView([selected.position.lat, selected.position.lng], 14, { animate: !reduced })
    else map.fitBounds(latLngBounds(pins.map(pin => [pin.position.lat, pin.position.lng])), { padding: [36, 36], maxZoom: 15, animate: false })
  }, [key, pins, selectedId, map, reduced])
  return null
}

export function TrackingMap({ pins, scope, selectedId, onSelect }: {
  pins: TrackingPin[]; scope: string; selectedId?: string; onSelect?: (id: string) => void
}) {
  const first = pins[0]?.position
  return <MapContainer center={first ? [first.lat, first.lng] : [21.0285, 105.8342]} zoom={12}
    minZoom={1} maxZoom={20} zoomControl={false} scrollWheelZoom={false} className="tracking-leaflet-map">
    <OsmBaseLayer /><ZoomControl position="bottomright" />
    <Frame pins={pins} scope={scope} selectedId={selectedId} />
    {pins.map(pin => <Marker key={pin.id} position={[pin.position.lat, pin.position.lng]} icon={icons[pin.kind]}
      alt={pin.label} title={pin.label} eventHandlers={{ click: () => onSelect?.(pin.id) }}>
      <Popup>{pin.label}</Popup>
    </Marker>)}
  </MapContainer>
}

export default TrackingMap
