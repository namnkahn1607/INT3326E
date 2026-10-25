import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { AdministrativeAreaSelect } from './AdministrativeAreaSelect'
import { administrativeAddress, resolveAdministrativeSelection, type AdministrativeSelection } from './administrative-areas'
import type { AddressMatch } from './address-search'
import { HANOI_PROVINCE } from './hanoi-map'
import { CustomerHomeIcon } from './CustomerHomeIcon'
import { ShipmentMapDialog } from './ShipmentMapDialog'

export interface ShipmentAddressValue {
  street: string
  area: string
  details: string
  point: { lat: number; lng: number } | null
  divisions: AdministrativeSelection | null
}

export function ShipmentAddressModal({ kind, value, onSave, onClose }: {
  kind: 'pickup' | 'dropoff'
  value: ShipmentAddressValue
  onSave: (value: ShipmentAddressValue) => void
  onClose: () => void
}) {
  const initial = { ...value, divisions: value.divisions ?? { province: HANOI_PROVINCE, district: null, ward: null } }
  const [draft, setDraft] = useState(initial)
  const [needsReview, setNeedsReview] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapRequested, setMapRequested] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const summary = useRef<HTMLParagraphElement>(null)
  const regionRequest = useRef<AbortController | null>(null)
  const selectedPoint = useRef(value.point)
  const title = kind === 'pickup' ? 'Địa chỉ gửi' : 'Địa chỉ người nhận'
  const changed = JSON.stringify(draft) !== JSON.stringify(initial)
  const resolvingChange = useCallback((_kind: 'pickup' | 'dropoff', loading: boolean) => setResolving(loading), [])
  useEffect(() => {
    const element = dialog.current!
    const active = document.activeElement as HTMLElement | null
    const previous = active && !element.contains(active) ? active : document.getElementById('shipment-' + kind + 'Location')
    const overflow = document.body.style.overflow
    element.showModal()
    element.querySelector<HTMLElement>('#address-modal-title')?.focus()
    document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [kind])
  useEffect(() => { if (error) summary.current?.focus() }, [error])
  useEffect(() => () => regionRequest.current?.abort(), [])
  useEffect(() => {
    if (!changed) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changed])
  function close() {
    if (changed && !window.confirm('Bạn chưa lưu thay đổi địa chỉ. Bỏ các thay đổi này?')) return
    onClose()
  }
  function containFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'))
      .filter(element => element.getClientRects().length > 0)
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  function edit(field: 'street' | 'details', text: string) {
    if (field === 'street') regionRequest.current?.abort()
    setDraft(previous => ({ ...previous, [field]: text }))
    if (field !== 'details' && draft.point) setNeedsReview(true)
  }
  function selectDivision(divisions: AdministrativeSelection) {
    regionRequest.current?.abort()
    setDraft(previous => ({ ...previous, divisions, area: administrativeAddress(divisions) }))
    if (draft.point) setNeedsReview(true)
  }
  async function selectMapPoint(point: { lat: number; lng: number }, address?: AddressMatch['address']) {
    if (!address) {
      regionRequest.current?.abort()
      const previous = selectedPoint.current
      selectedPoint.current = point
      setDraft(current => ({ ...current, point, ...(previous && (previous.lat !== point.lat || previous.lng !== point.lng)
        ? { divisions: { province: HANOI_PROVINCE, district: null, ward: null } } : {}) }))
      setNeedsReview(false)
      return
    }
    if (selectedPoint.current && (selectedPoint.current.lat !== point.lat || selectedPoint.current.lng !== point.lng)) return
    selectedPoint.current = point
    regionRequest.current?.abort()
    const controller = new AbortController()
    regionRequest.current = controller
    let divisions: AdministrativeSelection = { province: HANOI_PROVINCE, district: null, ward: null }
    try { divisions = await resolveAdministrativeSelection(address.regions ?? address.area.split(','), controller.signal) }
    catch { if (controller.signal.aborted) return }
    if (controller.signal.aborted || selectedPoint.current.lat !== point.lat || selectedPoint.current.lng !== point.lng) return
    setDraft(current => ({ ...current, point, street: address.street, area: administrativeAddress(divisions), divisions }))
    setNeedsReview(false)
  }
  function save(event: FormEvent) {
    event.preventDefault(); event.stopPropagation()
    if (resolving) return
    if (!draft.street.trim()) {
      setError('Nhập tên đường/tòa nhà và khu vực tại Hà Nội trước khi lưu.'); return
    }
    const address = [draft.details.trim(), draft.street.trim(), draft.area.trim()].filter(Boolean).join(', ')
    if (address.length > 255 || draft.details.trim().length > 150 || draft.area.trim().length > 150) {
      setError('Địa chỉ đầy đủ tối đa 255 ký tự; số nhà/chỉ dẫn và khu vực mỗi ô tối đa 150 ký tự.'); return
    }
    if (!draft.divisions?.province || !draft.divisions.district || !draft.divisions.ward) {
      setError('Chọn đủ tỉnh/thành phố, quận/huyện và phường/xã.'); return
    }
    if (!draft.point || needsReview) { setError('Chọn hoặc xác nhận điểm trên bản đồ để tài xế nhận đúng vị trí.'); return }
    onSave({ ...draft, street: draft.street.trim(), area: administrativeAddress(draft.divisions), details: draft.details.trim() })
  }
  const divisions = draft.divisions ?? { province: null, district: null, ward: null }
  return createPortal(<dialog ref={dialog} className="shipment-address-dialog customer-api-page" aria-labelledby="address-modal-title"
    onCancel={event => { event.preventDefault(); close() }} onKeyDown={containFocus}>
    <form onSubmit={save} noValidate>
      <header className="shipment-address-dialog-header"><div><p className="customer-section-kicker">{kind === 'pickup' ? 'Bên gửi' : 'Bên nhận'}</p>
        <h2 id="address-modal-title" tabIndex={-1}>{title}</h2></div>
        <button type="button" className="btn btn-outline shipment-dialog-close" aria-label="Đóng cửa sổ địa chỉ" onClick={close}>×</button>
      </header>
      <div className="shipment-address-dialog-body">
        {error && <p id="address-modal-error" className="customer-error" role="alert" tabIndex={-1} ref={summary}>{error}</p>}
        <section className="shipment-address-editor" aria-label="Thông tin địa chỉ">
          <div className="shipment-address-directory-note"><span>Hà Nội · Danh mục cũ trước 07/2025</span></div>
          <div className="shipment-area-grid">
              <div className="form-group"><label htmlFor="address-province">Tỉnh / Thành phố</label>
                <select id="address-province" value="1" disabled><option value="1">Thành phố Hà Nội</option></select></div>
              <AdministrativeAreaSelect level="district" parent={divisions.province?.code ?? null} value={divisions.district} onChange={district => selectDivision({ ...divisions, district, ward: null })} />
              <AdministrativeAreaSelect level="ward" parent={divisions.district?.code ?? null} value={divisions.ward} onChange={ward => selectDivision({ ...divisions, ward })} />
            </div>
          <div className="shipment-address-street-row">
            <div className="form-group"><label htmlFor="address-street">Tên đường / Tòa nhà<span className="shipment-required"> *</span></label>
              <input id="address-street" name="addressStreet" required value={draft.street} onChange={event => edit('street', event.target.value)} autoComplete="off" /></div>
            <button type="button" className="shipment-map-tile" id={'address-modal-' + kind + 'Location-launch'}
              aria-label="Mở bản đồ chọn vị trí" title="Mở bản đồ chọn vị trí" aria-haspopup="dialog"
              onClick={() => { setMapRequested(true); setMapOpen(true) }}>
              <CustomerHomeIcon name="pin" />
            </button>
          </div>
          <div className="form-group"><label htmlFor="address-details">Số nhà, căn hộ / Chỉ dẫn cho tài xế</label>
            <input id="address-details" name="addressDetails" value={draft.details} onChange={event => edit('details', event.target.value)} autoComplete="off" /></div>
        </section>
      </div>
        {mapRequested && <ShipmentMapDialog open={mapOpen} onClose={() => setMapOpen(false)} kind={kind} point={draft.point}
          district={divisions.district} query={[draft.street, draft.area || HANOI_PROVINCE.name].filter(Boolean).join(', ')}
          needsReview={needsReview} onResolvingChange={resolvingChange} onSelect={selectMapPoint} />}
      <footer className="shipment-address-dialog-footer">
        <div><button type="button" className="btn btn-outline" onClick={close}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={resolving}>{resolving ? 'Đang lấy địa chỉ…' : 'Xong'}</button></div></footer>
    </form>
  </dialog>, document.body)
}
