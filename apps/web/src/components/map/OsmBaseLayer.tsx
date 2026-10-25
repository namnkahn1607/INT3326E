import { useEffect, useRef, useState } from 'react'
import { DomEvent, type TileLayer as LeafletTileLayer } from 'leaflet'
import { TileLayer } from 'react-leaflet'
import { mapTiles } from './map-tiles'
import './osm.css'

export function OsmBaseLayer() {
  const tiles = mapTiles()
  const layer = useRef<LeafletTileLayer | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const failed = useRef(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'slow' | 'error'>('loading')

  function start() {
    clearTimeout(timer.current)
    failed.current = false
    setStatus('loading')
    timer.current = setTimeout(() => setStatus('slow'), 12_000)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  return <>
    <TileLayer ref={layer} url={tiles.url} attribution={tiles.attribution}
      maxZoom={20} maxNativeZoom={tiles.maxNativeZoom} keepBuffer={1} updateWhenIdle
      eventHandlers={{
        loading: start,
        tileerror: () => { failed.current = true; clearTimeout(timer.current); setStatus('error') },
        load: () => { clearTimeout(timer.current); setStatus(failed.current ? 'error' : 'ready') },
      }} />
    {status !== 'ready' && <div ref={element => { if (element) DomEvent.disableClickPropagation(element) }}
      className="osm-map-status" role="status" data-map-provider={tiles.provider} data-map-state={status}
      onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
      <span>{status === 'loading' ? 'Đang tải bản đồ…' : status === 'slow' ? 'Bản đồ tải chậm.' : 'Chưa tải được đầy đủ bản đồ.'}</span>
      {(status === 'error' || status === 'slow') && <button type="button" onClick={() => { start(); layer.current?.redraw() }}>Thử tải lại</button>}
    </div>}
  </>
}
