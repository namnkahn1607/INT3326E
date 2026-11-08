import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { resolveAddressSuggestion, searchAddress, type AddressMatch } from './address-search'
import type { AdministrativeArea } from './administrative-areas'
import { HANOI_PROVINCE, HANOI_VIEW_BOUNDS } from './hanoi-map'

const ShipmentLocationPicker = lazy(() => import('./ShipmentLocationPicker').then(module => ({ default: module.ShipmentLocationPicker })))
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/^(quan|huyen|thi xa)\s+/, '').trim()

export function ShipmentMapDialog({ open, kind, point, query, district, needsReview, onClose, onSelect, onResolvingChange }: {
  open: boolean
  kind: 'pickup' | 'dropoff'
  point: { lat: number; lng: number } | null
  query: string
  district: AdministrativeArea | null
  needsReview: boolean
  onClose: () => void
  onSelect: (point: { lat: number; lng: number }, address?: AddressMatch['address']) => void | Promise<void>
  onResolvingChange: (kind: 'pickup' | 'dropoff', loading: boolean) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [viewport, setViewport] = useState<{ query: string; area: AddressMatch | null } | null>(null)
  const districtName = district?.name ?? ''
  const districtQuery = districtName ? districtName + ', ' + HANOI_PROVINCE.name : ''
  const locate = !point || needsReview
  useEffect(() => {
    if (!open) return
    const element = dialog.current!
    const previous = document.getElementById('address-modal-' + kind + 'Location-launch') ?? document.activeElement as HTMLElement | null
    element.showModal()
    element.querySelector<HTMLElement>('#shipment-map-title')?.focus()
    return () => { element.close(); if (previous?.isConnected) previous.focus() }
  }, [open, kind])
  useEffect(() => {
    if (!open || !districtQuery || !locate) return
    const controller = new AbortController()
    // Let an immediately cancelled effect exit before consuming a geocoder request.
    void Promise.resolve().then(() => controller.signal.aborted ? [] : searchAddress(districtQuery, controller.signal)).then(async results => {
      if (controller.signal.aborted) return
      const result = results.find(result => normalize(result.label.split(',')[0]) === normalize(districtName)
        && /ha\s*noi/.test(normalize(result.label)))
      const match = result ? await resolveAddressSuggestion(result, controller.signal) : null
      const area = match && match.point.lat >= HANOI_VIEW_BOUNDS[0][0] && match.point.lat <= HANOI_VIEW_BOUNDS[1][0]
        && match.point.lng >= HANOI_VIEW_BOUNDS[0][1] && match.point.lng <= HANOI_VIEW_BOUNDS[1][1] ? match : null
      if (!controller.signal.aborted) setViewport({ query: districtQuery, area })
    }).catch(() => { if (!controller.signal.aborted) setViewport({ query: districtQuery, area: null }) })
    return () => controller.abort()
  }, [open, districtName, districtQuery, locate])
  const area = viewport?.query === districtQuery ? viewport.area : null
  return createPortal(<dialog ref={dialog} className="shipment-address-dialog shipment-map-dialog customer-api-page" aria-labelledby="shipment-map-title"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }} onKeyDown={event => {
      event.stopPropagation()
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
    }}>
    <header className="shipment-address-dialog-header">
      <h2 id="shipment-map-title" tabIndex={-1}>Chọn vị trí {kind === 'pickup' ? 'lấy' : 'giao'} hàng</h2>
      <button type="button" className="btn btn-outline shipment-dialog-close" aria-label="Đóng bản đồ" onClick={onClose}>×</button>
    </header>
    <div className="shipment-map-dialog-body">
      <p className="customer-field-hint shipment-map-region-status" role="status">{!districtQuery ? '' : !locate ? districtName : viewport?.query !== districtQuery ? 'Đang tìm khu vực ' + districtName + '…'
        : area ? districtName : 'Không tìm thấy khu vực.'}</p>
      <Suspense fallback={<div className="shipment-map-skeleton" role="status">Đang mở bản đồ Hà Nội…</div>}>
        <ShipmentLocationPicker initialOpen expanded={open} onExpandedChange={expanded => { if (!expanded) onClose() }} hideToggle
          districtArea={locate ? area : null} idPrefix="address-modal-" kind={kind} point={point} query={query} disabled={false}
          needsReview={needsReview} onSelect={onSelect} onResolvingChange={onResolvingChange} />
      </Suspense>
    </div>
  </dialog>, document.body)
}
