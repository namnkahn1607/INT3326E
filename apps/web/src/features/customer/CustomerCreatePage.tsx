import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { createShipment } from '../../api/endpoints/shipments'
import { ApiError } from '../../api/client'
import type { ShipmentResponse } from '../../types/shipment-api'
import { useAuth } from '../auth/useAuth'
import { ShipmentAddressModal, type ShipmentAddressValue } from './ShipmentAddressModal'
import { CustomerHomeIcon } from './CustomerHomeIcon'
import type { AdministrativeSelection } from './administrative-areas'
import { canRetryIntent, classifyCreateFailure, emptyShipmentDraft, shipmentErrorMessage, validateShipmentDraft,
  type CreateIntent, type CreateRequestIssue, type FieldErrors, type ShipmentDraft } from './shipment-form'
import './customer-api.css'

const labels: Record<keyof ShipmentDraft, string> = {
  pickupAddress: 'Tên đường / tòa nhà lấy hàng', pickupLat: 'Vị trí lấy hàng', pickupLng: 'Vị trí lấy hàng',
  dropoffAddress: 'Tên đường / tòa nhà giao hàng', dropoffLat: 'Vị trí giao hàng', dropoffLng: 'Vị trí giao hàng',
  pickupArea: 'Khu vực lấy hàng', pickupDetails: 'Số nhà / chỉ dẫn lấy hàng cho tài xế',
  dropoffArea: 'Khu vực giao hàng', dropoffDetails: 'Số nhà / chỉ dẫn giao hàng cho tài xế',
  recipientName: 'Họ tên người nhận', recipientPhone: 'Số điện thoại người nhận',
  senderName: 'Họ tên người gửi / Cửa hàng', senderPhone: 'Số điện thoại người gửi / Cửa hàng',
  packageDescription: 'Mô tả bưu kiện', packageWeightKg: 'Khối lượng (kg)', notes: 'Ghi chú',
  expectedDeliveryAt: 'Hạn giao dự kiến',
}

const hints: Partial<Record<keyof ShipmentDraft, string>> = {
  packageWeightKg: 'Số lớn hơn 0, đơn vị kg. Để trống nếu chưa có.',
  packageDescription: 'Tối đa 500 ký tự.', notes: 'Tối đa 500 ký tự.',
}

function startIntent(payload: CreateIntent['payload']): CreateIntent {
  return { key: crypto.randomUUID(), payload, startedAt: Date.now() }
}

const fieldId = (name: keyof ShipmentDraft) => 'shipment-' + (/^(pickup|dropoff)/.test(name) ? name.startsWith('pickup') ? 'pickupLocation' : 'dropoffLocation' : name)

export function CustomerCreatePage() {
  const { user } = useAuth()
  return <ShipmentCreateForm key={user?.id ?? 'signed-out'} senderName={user?.displayName ?? ''} />
}

function ShipmentCreateForm({ senderName }: { senderName: string }) {
  const [draft, setDraft] = useState<ShipmentDraft>({ ...emptyShipmentDraft, senderName })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(false)
  const [editing, setEditing] = useState<'pickup' | 'dropoff' | null>(null)
  const [divisions, setDivisions] = useState<Record<'pickup' | 'dropoff', AdministrativeSelection | null>>({ pickup: null, dropoff: null })
  const [intent, setIntent] = useState<CreateIntent | null>(null)
  const [created, setCreated] = useState<ShipmentResponse | null>(null)
  const [focusRequest, setFocusRequest] = useState<{ name: keyof ShipmentDraft } | null>(null)
  const [requestIssue, setRequestIssue] = useState<CreateRequestIssue | null>(null)
  const reviewed = useRef(new Set<keyof ShipmentDraft>())
  const sending = useRef(false)
  const currentRequest = useRef<AbortController | null>(null)
  const alive = useRef(true)
  const summary = useRef<HTMLDivElement>(null)
  const success = useRef<HTMLHeadingElement>(null)
  const hasDraft = !created && Object.values(draft).some(value => value.trim())

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; currentRequest.current?.abort() }
  }, [])
  useEffect(() => { if (error) summary.current?.focus() }, [error])
  useEffect(() => { if (focusRequest) document.getElementById(fieldId(focusRequest.name))?.focus() }, [focusRequest])
  useEffect(() => { if (created) success.current?.focus() }, [created])
  useEffect(() => {
    if (!hasDraft) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasDraft])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending.current || created || editing) return
    let nextIntent = intent
    if (locked && intent) {
      if (!canRetryIntent(intent.startedAt)) {
        setError('Yêu cầu đã quá 24 giờ hoặc đồng hồ đã thay đổi. Đối chiếu danh sách đơn với nhóm hỗ trợ trước khi tạo lại.')
        return
      }
    } else {
      const result = validateShipmentDraft(draft)
      for (const name of Object.keys(draft) as (keyof ShipmentDraft)[]) reviewed.current.add(name)
      setErrors(result.errors)
      const first = (Object.keys(result.errors) as (keyof ShipmentDraft)[])[0]
      if (first) { setError(null); setFocusRequest({ name: first }); return }
      if (intent && JSON.stringify(intent.payload) === JSON.stringify(result.payload) && !canRetryIntent(intent.startedAt)) {
        setError('Yêu cầu đã quá 24 giờ hoặc đồng hồ đã thay đổi. Đối chiếu danh sách đơn với nhóm hỗ trợ trước khi tạo lại.')
        return
      }
      if (!intent || JSON.stringify(intent.payload) !== JSON.stringify(result.payload)) {
        nextIntent = startIntent(result.payload)
      }
    }
    if (!nextIntent) return
    sending.current = true
    setBusy(true); setLocked(true); setError(null); setIntent(nextIntent); setRequestIssue(null)
    const controller = new AbortController()
    currentRequest.current = controller
    try {
      const shipment = await createShipment(nextIntent.payload, nextIntent.key, controller.signal)
      if (alive.current) { setCreated(shipment); setErrors({}) }
    } catch (cause) {
      if (!alive.current) return
      setError(cause instanceof ApiError && cause.status === 404
        ? 'Máy chủ chưa tìm thấy API tạo đơn (POST /v1/shipments, HTTP 404).'
        : shipmentErrorMessage(cause))
      setRequestIssue(classifyCreateFailure(cause))
      if (cause instanceof ApiError && cause.status === 404) setLocked(false)
      if (cause instanceof ApiError && cause.status === 400) {
        setLocked(false)
        const fields: Record<string, keyof ShipmentDraft> = {
          pickupAddress: 'pickupAddress', 'pickupLocation.lat': 'pickupLat', 'pickupLocation.lng': 'pickupLng',
          dropoffAddress: 'dropoffAddress', 'dropoffLocation.lat': 'dropoffLat', 'dropoffLocation.lng': 'dropoffLng',
          recipientName: 'recipientName', recipientPhone: 'recipientPhone', notes: 'notes',
          packageDescription: 'packageDescription', packageWeightKg: 'packageWeightKg', expectedDeliveryAt: 'expectedDeliveryAt',
        }
        const validation: FieldErrors = {}
        for (const issue of cause.errors) {
          const field = fields[issue.field]
          if (field) validation[field] = 'Máy chủ từ chối giá trị này. Kiểm tra và nhập lại.'
        }
        setErrors(validation)
        const first = (Object.keys(validation) as (keyof ShipmentDraft)[])[0]
        if (first) setFocusRequest({ name: first })
      }
    } finally {
      sending.current = false
      if (alive.current) setBusy(false)
    }
  }

  function reviewField(name: keyof ShipmentDraft, value: string) {
    const message = validateShipmentDraft({ ...draft, [name]: value }).errors[name]
    setErrors(previous => {
      const next = { ...previous }
      if (message) next[name] = message
      else delete next[name]
      return next
    })
  }

  function field(name: keyof ShipmentDraft, required = false, placeholder?: string) {
    const numeric = /Lat$|Lng$/.test(name) || name === 'packageWeightKg'
    const id = 'shipment-' + name
    return <div className={'form-group' + (name.endsWith('Address') ? ' full-width' : '')} key={name}>
      <label htmlFor={id}>{labels[name]}{required ? <span className="shipment-required"> *</span> : ' (không bắt buộc)'}</label>
      <input id={id} name={name} value={draft[name]} required={required} disabled={locked || busy}
        type={name === 'expectedDeliveryAt' ? 'datetime-local' : name.endsWith('Phone') ? 'tel' : numeric ? 'number' : 'text'}
        step={numeric ? 'any' : undefined} inputMode={numeric ? 'decimal' : undefined}
        autoComplete={name === 'recipientName' ? 'section-recipient name' : name === 'recipientPhone' ? 'section-recipient tel' : name === 'senderName' ? 'section-sender name' : name === 'senderPhone' ? 'section-sender tel' : 'off'}
        placeholder={placeholder} aria-invalid={!!errors[name]}
        aria-describedby={[hints[name] ? id + '-hint' : '', errors[name] ? id + '-error' : ''].filter(Boolean).join(' ') || undefined}
        onBlur={event => { reviewed.current.add(name); reviewField(name, event.currentTarget.value) }}
        onChange={event => {
          const value = event.target.value
          setDraft(previous => ({ ...previous, [name]: value }))
          if (reviewed.current.has(name)) reviewField(name, value)
        }} />
      {hints[name] && <span id={id + '-hint'} className="customer-field-hint">{hints[name]}</span>}
      {errors[name] && <span id={id + '-error'} className="customer-field-error" role="alert">{errors[name]}</span>}
    </div>
  }

  function addressValue(kind: 'pickup' | 'dropoff'): ShipmentAddressValue {
    return { street: draft[`${kind}Address`], area: draft[`${kind}Area`], details: draft[`${kind}Details`], divisions: divisions[kind],
      point: draft[`${kind}Lat`] && draft[`${kind}Lng`] ? { lat: Number(draft[`${kind}Lat`]), lng: Number(draft[`${kind}Lng`]) } : null }
  }

  function addressField(kind: 'pickup' | 'dropoff') {
    const value = addressValue(kind)
    const id = 'shipment-' + kind + 'Location'
    const message = (Object.keys(errors) as (keyof ShipmentDraft)[]).filter(name => name.startsWith(kind)).map(name => errors[name])[0]
    const text = [value.details, value.street, value.area].filter(Boolean).join(', ')
    return <div className="form-group shipment-address-field">
      <label id={id + '-label'} htmlFor={id}>{kind === 'pickup' ? 'Địa chỉ gửi / cửa hàng' : 'Địa chỉ người nhận'}<span className="shipment-required"> *</span></label>
      <button type="button" id={id} className={'shipment-address-trigger' + (text ? ' has-address' : '')}
        disabled={locked || busy} aria-haspopup="dialog" aria-invalid={!!message} title={text || undefined}
        aria-labelledby={id + '-label ' + id + '-value'} aria-describedby={message ? id + '-error' : id + '-hint'} onClick={() => setEditing(kind)}>
        <CustomerHomeIcon name="pin" /><span id={id + '-value'}>{text || 'Nhập địa chỉ ' + (kind === 'pickup' ? 'gửi hàng' : 'người nhận')}</span><CustomerHomeIcon name="chevron" />
      </button>
      <span className="customer-field-hint" id={id + '-hint'}>{value.point ? 'Đã lưu địa chỉ và điểm trên bản đồ. Bấm để chỉnh sửa.' : 'Chọn quận/huyện, phường/xã tại Hà Nội và xác nhận vị trí.'}</span>
      {message && <span id={id + '-error'} className="customer-field-error" role="alert">{message}</span>}
    </div>
  }

  function saveAddress(value: ShipmentAddressValue) {
    if (!editing || !value.point) return
    const kind = editing
    const updated = { ...draft, [`${kind}Address`]: value.street, [`${kind}Area`]: value.area, [`${kind}Details`]: value.details,
      [`${kind}Lat`]: String(value.point.lat), [`${kind}Lng`]: String(value.point.lng) }
    setDraft(updated)
    setDivisions(previous => ({ ...previous, [kind]: value.divisions }))
    const validation = validateShipmentDraft(updated).errors
    setErrors(previous => {
      const next = { ...previous }
      for (const name of Object.keys(updated) as (keyof ShipmentDraft)[]) {
        if (!name.startsWith(kind)) continue
        delete next[name]
        if (validation[name]) next[name] = validation[name]
      }
      return next
    })
    setEditing(null)
  }

  return <div className="page-container customer-api-page shipment-create-page">
    <div className="page-header">
      <h1 className="page-title">Tạo đơn giao hàng</h1>
      <Link to="/customer/shipments" className="btn btn-secondary">Danh sách đơn</Link>
    </div>
    {created ? <section className="customer-result">
      <span className="customer-section-kicker">Yêu cầu đã được xác nhận</span>
      <h2 ref={success} tabIndex={-1}>Đã tạo đơn thành công</h2>
      <p>Mã vận đơn</p><strong className="customer-tracking-number">{created.trackingNumber}</strong>
      <p>Xem chi tiết để lấy trạng thái mới nhất từ hệ thống.</p>
      <div className="form-actions">
        <Link className="btn btn-primary" to={'/customer/shipments/' + created.id}>Xem đơn vừa tạo</Link>
        <button type="button" className="btn btn-outline" onClick={() => {
          setCreated(null); setIntent(null); setLocked(false); setDraft({ ...emptyShipmentDraft, senderName }); setError(null); setErrors({}); reviewed.current.clear(); setFocusRequest(null); setRequestIssue(null); setDivisions({ pickup: null, dropoff: null })
        }}>Tạo đơn khác</button>
      </div>
    </section> : <form onSubmit={submit} className="shipment-create-card shipment-create-workspace" noValidate aria-busy={busy}>
      <div className="form-card shipment-party-card">
      {(error || Object.keys(errors).length > 0) && <div className="customer-error" role="alert" tabIndex={-1} ref={summary}>
        <h2>{error ?? 'Kiểm tra lại thông tin'}</h2>
        {Object.keys(errors).length > 0 && <ul>{(Object.keys(errors) as (keyof ShipmentDraft)[])
          .filter(name => !name.endsWith('Lng') || !errors[name.replace('Lng', 'Lat') as keyof ShipmentDraft]).map(name =>
          <li key={name}><a href={'#' + fieldId(name)}>{labels[name]}: {errors[name]}</a></li>)}</ul>}
        {error && requestIssue === 'uncertain' && <p>Chưa xác định được kết quả. Nếu thử lại, hệ thống giữ nguyên mã yêu cầu và thông tin đã gửi; không tạo đơn khác trước khi đối chiếu.</p>}
        {error && requestIssue === 'rejected' && <p>Yêu cầu bị từ chối. Kiểm tra thông tin hoặc liên hệ quản trị viên theo thông báo trên.</p>}
        {error && requestIssue === 'unavailable' && <p>Đơn chưa được tạo. Thông tin đã nhập vẫn được giữ lại. API trên máy chủ cần được cập nhật; sửa địa chỉ không giải quyết lỗi này.</p>}
        {requestIssue === 'auth' && <Link to="/login">Kiểm tra phiên đăng nhập</Link>}
      </div>}
      <p className="customer-form-intro">Các mục có dấu <span className="shipment-required">*</span> là bắt buộc. Bấm vào địa chỉ để chọn vị trí giao nhận.</p>
      <fieldset className="form-section shipment-party-section"><legend>Bên gửi</legend><div className="shipment-party-grid">
        <div className="shipment-recipient-fields">{field('senderPhone', true)}{field('senderName', true)}</div>
        {addressField('pickup')}
      </div><p className="customer-helper" id="shipment-sender-notice">Tên/SĐT bên gửi chỉ giữ trong bản nháp, chưa được gửi lên máy chủ; đang chờ API hỗ trợ.</p></fieldset>
      <fieldset className="form-section shipment-party-section"><legend>Bên nhận</legend><div className="shipment-party-grid">
        <div className="shipment-recipient-fields">{field('recipientPhone', true)}{field('recipientName', true)}</div>
        {addressField('dropoff')}
      </div></fieldset>
      </div>
      <div className="form-card shipment-extra-card">
      <fieldset className="form-section"><legend>Thông tin bổ sung</legend><div className="form-grid">
        {field('packageDescription')}{field('packageWeightKg')}{field('notes')}{field('expectedDeliveryAt')}
      </div><p className="customer-helper">Hạn giao dùng giờ trên thiết bị, được gửi dưới dạng UTC. Đây không phải ETA.</p></fieldset>
      </div>
      <aside className="shipment-submit-panel" aria-label="Thao tác tạo đơn">
      <div className="shipment-submit-footer">
      {locked && <p className="customer-pending-note" role="status">Thông tin đã khóa cho lần gửi này. Giữ trang để thử lại cùng yêu cầu; không tạo đơn khác trước khi đối chiếu nếu kết quả chưa xác định.</p>}
      <div className="form-actions">
        <button type="submit" disabled={busy} aria-busy={busy} aria-describedby={busy ? 'shipment-sending' : undefined} className="btn btn-primary ui-submit">
          {busy && <span className="ui-button-spinner" aria-hidden="true" />}{busy ? 'Đang tạo đơn…' : locked ? 'Thử lại cùng yêu cầu' : 'Xác nhận tạo đơn'}</button>
        {!locked && <Link to="/customer/shipments" className="btn btn-outline">Để sau</Link>}
      </div>
      {busy && <p className="ui-disabled-reason" id="shipment-sending" role="status">Đang gửi thông tin đến máy chủ. Vui lòng chờ kết quả trước khi gửi lại.</p>}
      <p className="customer-helper">Thông tin nhập chỉ giữ trên trang này. Rời trang hoặc tải lại sẽ mất bản nháp.</p>
      </div>
      </aside>
    </form>}
    {editing && <ShipmentAddressModal kind={editing} value={addressValue(editing)} onSave={saveAddress} onClose={() => setEditing(null)} />}
  </div>
}
