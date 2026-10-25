import { useEffect, useRef, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Rectangle, Tooltip, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { CustomerHomeIcon } from './CustomerHomeIcon'
import { AddressSearchError, resolveAddressSuggestion, reverseAddress, searchAddress, type AddressMatch, type AddressSuggestion } from './address-search'
import { OsmBaseLayer } from '../../components/map/OsmBaseLayer'
import { HANOI_CENTER, HANOI_VIEW_BOUNDS } from './hanoi-map'

type Point = { lat: number; lng: number }
type Kind = 'pickup' | 'dropoff'

function MapSelection({ kind, area, districtArea, active, onSelect }: { kind: Kind; area: AddressMatch | null; districtArea?: AddressMatch | null; active: boolean; onSelect: (point: Point) => void }) {
  const interacted = useRef(false)
  const map = useMapEvents({ click: event => { if (active) { interacted.current = true; onSelect(event.latlng.wrap()) } },
    dragstart: () => { interacted.current = true }, zoomstart: () => { interacted.current = true } })
  useEffect(() => {
    if (!active) return
    interacted.current = false
    const resize = () => {
      if (map.getContainer().getClientRects().length) map.invalidateSize({ pan: false, debounceMoveend: true })
    }
    resize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(map.getContainer())
    return () => observer?.disconnect()
  }, [map, active])
  useEffect(() => {
    if (!active || !districtArea || area || interacted.current) return
    if (districtArea.bounds) map.fitBounds(districtArea.bounds, { padding: [24, 24], maxZoom: 14, animate: false })
    else map.setView(districtArea.point, 13, { animate: false })
  }, [map, active, districtArea, area])
  useEffect(() => {
    if (!area) return
    if (area.bounds) map.fitBounds(area.bounds, { padding: [24, 24], maxZoom: 17, animate: false })
    else map.setView(area.point, 16, { animate: false })
    map.getContainer().focus()
  }, [map, area])
  useEffect(() => {
    if (!active) return
    const element = map.getContainer()
    element.setAttribute('role', 'region')
    element.setAttribute('aria-label', 'Bản đồ chọn điểm ' + (kind === 'pickup' ? 'lấy' : 'giao') + ' hàng')
    const pan = (event: KeyboardEvent) => {
      const offset: Record<string, [number, number]> = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] }
      if (event.target !== element || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === 'Enter') {
        event.preventDefault(); event.stopPropagation(); interacted.current = true
        onSelect(map.getCenter().wrap()); return
      }
      if (!offset[event.key]) return
      event.preventDefault(); event.stopPropagation()
      interacted.current = true
      map.panBy(offset[event.key], { animate: false })
    }
    element.addEventListener('keydown', pan, true)
    return () => element.removeEventListener('keydown', pan, true)
  }, [map, kind, active, onSelect])
  return null
}

interface PickerProps {
  hideToggle?: boolean
  districtArea?: AddressMatch | null
  idPrefix?: string
  initialOpen?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  kind: Kind; point: Point | null; query?: string; disabled: boolean; error?: string; needsReview?: boolean
  onSelect: (point: Point, address?: AddressMatch['address']) => void | Promise<void>
  onResolvingChange?: (kind: Kind, resolving: boolean) => void
}

export function ShipmentLocationPicker(props: PickerProps) {
  return <LocationPicker key={props.kind} {...props} />
}

function LocationPicker({ kind, point, query = '', disabled, error, needsReview, onSelect, onResolvingChange, idPrefix = 'shipment-', initialOpen = false, expanded, onExpandedChange, hideToggle = false, districtArea }: PickerProps) {
  const [localOpen, setLocalOpen] = useState(initialOpen)
  const open = expanded ?? localOpen
  function setOpen(value: boolean | ((previous: boolean) => boolean)) {
    const next = typeof value === 'function' ? value(open) : value
    setLocalOpen(next); onExpandedChange?.(next)
  }
  const [mounted, setMounted] = useState(initialOpen)
  const [searchDraft, setSearchDraft] = useState<{ source: string; text: string } | null>(null)
  const searchQuery = searchDraft?.source === query ? searchDraft.text : query
  const [lookup, setLookup] = useState<{ query: string; searching: boolean; results: AddressSuggestion[] | null; error: string | null } | null>(null)
  const [chosenArea, setChosenArea] = useState<{ query: string; match: AddressMatch } | null>(null)
  const area = chosenArea?.query === searchQuery ? chosenArea.match : null
  const request = useRef<AbortController | null>(null)
  const reverseRequest = useRef<AbortController | null>(null)
  const [addressLookup, setAddressLookup] = useState<{ query: string; loading: boolean; message: string } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const searching = lookup?.query === searchQuery && lookup.searching && !disabled
  const results = lookup?.query === searchQuery ? lookup.results : null
  const searchError = lookup?.query === searchQuery ? lookup.error : null
  const resolving = addressLookup?.query === query && addressLookup.loading && !disabled
  const selectionStatus = resolving ? 'Đang lấy địa chỉ…' : addressLookup?.query === query && addressLookup.message
    ? addressLookup.message : point ? needsReview ? 'Địa chỉ đã thay đổi.' : 'Đã chọn điểm.' : 'Chưa chọn điểm.'
  const label = kind === 'pickup' ? 'lấy' : 'giao'
  const id = idPrefix + kind + 'Location'
  useEffect(() => () => { request.current?.abort(); request.current = null }, [searchQuery, disabled])
  useEffect(() => () => {
    reverseRequest.current?.abort(); reverseRequest.current = null
    onResolvingChange?.(kind, false)
  }, [query, disabled, kind, onResolvingChange])
  async function search() {
    if (disabled || request.current || searchQuery.trim().length < 3) return
    const controller = new AbortController()
    request.current = controller
    setLookup({ query: searchQuery, searching: true, results: null, error: null }); setOpen(true); setMounted(true)
    try {
      const matches = await searchAddress(searchQuery, controller.signal)
      if (!controller.signal.aborted) setLookup({ query: searchQuery, searching: false, results: matches, error: null })
    } catch (cause) {
      if (!controller.signal.aborted) setLookup({ query: searchQuery, searching: false, results: null, error: cause instanceof AddressSearchError ? cause.message : 'Chưa tìm được địa chỉ.' })
    } finally {
      if (request.current === controller) request.current = null
    }
  }
  async function chooseArea(result: AddressSuggestion) {
    request.current?.abort()
    reverseRequest.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLookup(previous => previous ? { ...previous, searching: true, error: null } : null)
    try {
      const match = await resolveAddressSuggestion(result, controller.signal)
      if (!controller.signal.aborted) setChosenArea({ query: searchQuery, match })
    } catch (cause) {
      if (!controller.signal.aborted) setLookup(previous => previous ? { ...previous, error: cause instanceof AddressSearchError ? cause.message : 'Chưa lấy được vị trí địa chỉ.' } : null)
    } finally {
      if (request.current === controller) {
        request.current = null
        setLookup(previous => previous ? { ...previous, searching: false } : null)
      }
    }
  }
  function select(value: Point) {
    if (!disabled && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180) {
      request.current?.abort(); request.current = null
      setLookup(previous => previous ? { ...previous, searching: false } : null)
      const selected = { lat: Number(value.lat.toFixed(6)), lng: Number(value.lng.toFixed(6)) }
      onSelect(selected)
      void resolveAddress(selected)
    }
  }
  async function resolveAddress(selected: Point) {
    reverseRequest.current?.abort()
    const controller = new AbortController()
    reverseRequest.current = controller
    setAddressLookup({ query, loading: true, message: '' })
    onResolvingChange?.(kind, true)
    try {
      const match = await reverseAddress(selected, controller.signal)
      if (controller.signal.aborted) return
      if (match?.address) {
        await onSelect(selected, match.address)
        setAddressLookup({ query, loading: false, message: '' })
      } else setAddressLookup({ query, loading: false, message: 'Không tìm thấy tên đường tại điểm này.' })
    } catch (cause) {
      if (!controller.signal.aborted) setAddressLookup({ query, loading: false, message: cause instanceof AddressSearchError ? cause.message : 'Chưa lấy được tên đường.' })
    } finally {
      if (reverseRequest.current === controller) { reverseRequest.current = null; onResolvingChange?.(kind, false) }
    }
  }
  function close() { setOpen(false); trigger.current?.focus() }

  return <div className="shipment-location-picker full-width">
    <div className="shipment-location-heading">
      <div><p className="shipment-location-label">Vị trí {label} hàng<span className="shipment-required"> *</span></p>
        <p id={id + '-status'} className="customer-field-hint shipment-location-status" role="status" title={selectionStatus}>{selectionStatus}</p>
      </div>
      {!hideToggle && <div className="shipment-location-actions"><button ref={trigger} id={id} type="button" className="btn btn-outline" disabled={disabled}
        aria-expanded={open && !disabled} aria-controls={open && !disabled ? id + '-panel' : undefined}
        aria-invalid={!!error} aria-describedby={id + (error ? '-error' : '-status')}
        onClick={() => { setMounted(true); setOpen(value => !value) }}>
        <CustomerHomeIcon name="pin" />{point ? 'Đổi vị trí ' : 'Chọn vị trí '}{label} hàng
      </button></div>}
    <div className="shipment-map-search" role="search" aria-label="Tìm địa chỉ trên bản đồ">
      <label className="ui-visually-hidden" htmlFor={id + '-search'}>Tìm địa chỉ trên bản đồ</label>
      <input id={id + '-search'} type="search" value={searchQuery} disabled={disabled} autoComplete="off"
        onChange={event => setSearchDraft({ source: query, text: event.target.value })}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); void search() } }} />
      <button type="button" disabled={disabled || searching || searchQuery.trim().length < 3} aria-label="Tìm địa chỉ trên bản đồ"
        aria-busy={searching} onClick={search} data-testid={kind + '-address-search'}>
        {searching ? <span className="ui-button-spinner" aria-hidden="true" /> : <CustomerHomeIcon name="search" />}
      </button>
    </div>
    </div>
    {error && <p id={id + '-error'} className="customer-field-error" role="alert">{error}</p>}
    {mounted && <div id={id + '-panel'} className="shipment-location-panel" hidden={!open || disabled}>
      {searching && <p role="status">Đang tìm khu vực phù hợp…</p>}
      {searchError && <p className="customer-field-error" role="alert">{searchError}</p>}
      {results && <div className="shipment-address-results">
        <p role="status">{results.length ? results.length + ' kết quả.' : 'Không tìm thấy địa chỉ.'}</p>
        {results.length > 0 && <ul aria-label="Kết quả tìm địa chỉ">{results.map(result => <li key={result.id}>
          <button type="button" className="shipment-address-result" aria-pressed={area?.id === result.id}
            disabled={!!searching} onClick={() => void chooseArea(result)}>{result.label}<CustomerHomeIcon name="arrow" /></button>
        </li>)}</ul>}
      </div>}
      <div className="shipment-location-map-wrap">
        <MapContainer className="shipment-location-map" center={point ?? HANOI_CENTER} zoom={15} minZoom={10} maxZoom={20}
          maxBounds={HANOI_VIEW_BOUNDS} maxBoundsViscosity={1}
          scrollWheelZoom={false} zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false}>
          <OsmBaseLayer />
          <MapSelection kind={kind} area={area} districtArea={districtArea} active={open && !disabled} onSelect={select} />
          {area && (area.bounds
            ? <Rectangle bounds={area.bounds} pathOptions={{ color: '#7c3aed', weight: 2, fillOpacity: .06, dashArray: '6 6' }} />
            : <Circle center={area.point} radius={250} pathOptions={{ color: '#7c3aed', weight: 2, fillOpacity: .06, dashArray: '6 6' }} />)}
          {point && <CircleMarker center={point} radius={9} pathOptions={{ color: '#5b21b6', fillColor: '#7c3aed', fillOpacity: 1, weight: 3 }}>
            <Tooltip permanent direction="top">Điểm {label} hàng</Tooltip>
          </CircleMarker>}
        </MapContainer>
      </div>
      <div className="shipment-map-actions">
        {point && needsReview && <button type="button" className="btn btn-secondary" disabled={disabled || resolving} onClick={() => onSelect(point)}>Xác nhận điểm đã chọn</button>}
        <button type="button" className="btn btn-outline" onClick={close}>Xong</button>
      </div>
    </div>}
  </div>
}
