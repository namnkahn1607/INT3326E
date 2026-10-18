import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { createShipment } from '../../api/endpoints/shipments'
import { ApiError } from '../../api/client'
import type { ShipmentResponse } from '../../types/shipment-api'
import { useAuth } from '../auth/useAuth'
import { ShipmentLocationPicker } from './ShipmentLocationPicker'
import { canRetryIntent, emptyShipmentDraft, shipmentErrorMessage, validateShipmentDraft,
  type CreateIntent, type FieldErrors, type ShipmentDraft } from './shipment-form'
import './customer-api.css'

const labels: Record<keyof ShipmentDraft, string> = {
  pickupAddress: 'Tên đường / tòa nhà lấy hàng', pickupLat: 'Vị trí lấy hàng', pickupLng: 'Vị trí lấy hàng',
  dropoffAddress: 'Tên đường / tòa nhà giao hàng', dropoffLat: 'Vị trí giao hàng', dropoffLng: 'Vị trí giao hàng',
  pickupArea: 'Khu vực lấy hàng', pickupDetails: 'Địa chỉ chi tiết lấy hàng',
  dropoffArea: 'Khu vực giao hàng', dropoffDetails: 'Địa chỉ chi tiết giao hàng',
  recipientName: 'Họ tên người nhận', recipientPhone: 'Số điện thoại người nhận',
  packageDescription: 'Mô tả bưu kiện', packageWeightKg: 'Khối lượng (kg)', notes: 'Ghi chú',
  expectedDeliveryAt: 'Hạn giao dự kiến',
}

const hints: Partial<Record<keyof ShipmentDraft, string>> = {
  pickupAddress: 'Tên đường hoặc tòa nhà công cộng để xác định khu vực trên bản đồ.',
  dropoffAddress: 'Tên đường hoặc tòa nhà công cộng để xác định khu vực trên bản đồ.',
  pickupArea: 'Phường/xã, tỉnh/thành phố để thu hẹp khu vực.',
  dropoffArea: 'Phường/xã, tỉnh/thành phố để thu hẹp khu vực.',
  pickupDetails: 'Số nhà, tầng, căn hộ… Chỉ gửi cùng đơn hàng, không gửi cho dịch vụ tìm địa chỉ.',
  dropoffDetails: 'Số nhà, tầng, căn hộ… Chỉ gửi cùng đơn hàng, không gửi cho dịch vụ tìm địa chỉ.',
  recipientName: 'Từ 2–100 ký tự.', recipientPhone: '9–15 chữ số, có thể bắt đầu bằng dấu +.',
  packageWeightKg: 'Số lớn hơn 0, đơn vị kg. Để trống nếu chưa có.',
  packageDescription: 'Tối đa 500 ký tự.', notes: 'Tối đa 500 ký tự.',
}

function startIntent(payload: CreateIntent['payload']): CreateIntent {
  return { key: crypto.randomUUID(), payload, startedAt: Date.now() }
}

const fieldId = (name: keyof ShipmentDraft) => 'shipment-' + name.replace(/Lat$|Lng$/, 'Location')

export function CustomerCreatePage() {
  const { user } = useAuth()
  return <ShipmentCreateForm key={user?.id ?? 'signed-out'} />
}

function ShipmentCreateForm() {
  const [draft, setDraft] = useState<ShipmentDraft>({ ...emptyShipmentDraft })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(false)
  const [intent, setIntent] = useState<CreateIntent | null>(null)
  const [created, setCreated] = useState<ShipmentResponse | null>(null)
  const [focusRequest, setFocusRequest] = useState<{ name: keyof ShipmentDraft } | null>(null)
  const [requestIssue, setRequestIssue] = useState<'auth' | 'uncertain' | 'rejected' | null>(null)
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
    if (sending.current || created) return
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
        ? 'Máy chủ chưa tìm thấy API tạo đơn (POST /v1/shipments, HTTP 404). Nhóm backend cần kiểm tra endpoint và bản triển khai.'
        : shipmentErrorMessage(cause))
      setRequestIssue(cause instanceof ApiError && cause.status === 401 ? 'auth'
        : !(cause instanceof ApiError) || cause.status === 0 || cause.status >= 500 || cause.code === 'INVALID_RESPONSE' ? 'uncertain' : 'rejected')
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
      <label htmlFor={id}>{labels[name]}{required ? ' *' : ' (không bắt buộc)'}</label>
      <input id={id} name={name} value={draft[name]} required={required} disabled={locked || busy}
        type={name === 'expectedDeliveryAt' ? 'datetime-local' : name === 'recipientPhone' ? 'tel' : numeric ? 'number' : 'text'}
        step={numeric ? 'any' : undefined} inputMode={numeric ? 'decimal' : undefined}
        autoComplete={name === 'recipientName' ? 'section-recipient name' : name === 'recipientPhone' ? 'section-recipient tel' : 'off'}
        placeholder={placeholder} aria-invalid={!!errors[name]}
        aria-describedby={[hints[name] ? id + '-hint' : '', errors[name] ? id + '-error' : ''].filter(Boolean).join(' ') || undefined}
        onBlur={event => { reviewed.current.add(name); reviewField(name, event.currentTarget.value) }}
        onChange={event => {
          const value = event.target.value
          setDraft(previous => ({ ...previous, [name]: value,
            ...(['pickupAddress', 'pickupArea', 'pickupDetails'].includes(name) ? { pickupLat: '', pickupLng: '' }
              : ['dropoffAddress', 'dropoffArea', 'dropoffDetails'].includes(name) ? { dropoffLat: '', dropoffLng: '' } : {}),
          }))
          if (reviewed.current.has(name)) reviewField(name, value)
        }} />
      {hints[name] && <span id={id + '-hint'} className="customer-field-hint">{hints[name]}</span>}
      {errors[name] && <span id={id + '-error'} className="customer-field-error" role="alert">{errors[name]}</span>}
    </div>
  }

  function location(kind: 'pickup' | 'dropoff') {
    const lat = kind === 'pickup' ? 'pickupLat' : 'dropoffLat'
    const lng = kind === 'pickup' ? 'pickupLng' : 'dropoffLng'
    const point = draft[lat] && draft[lng] ? { lat: Number(draft[lat]), lng: Number(draft[lng]) } : null
    return <ShipmentLocationPicker kind={kind} point={point} disabled={locked || busy} error={errors[lat] ?? errors[lng]}
      onSelect={value => {
        setDraft(previous => ({ ...previous, [lat]: String(value.lat), [lng]: String(value.lng) }))
        setErrors(previous => { const next = { ...previous }; delete next[lat]; delete next[lng]; return next })
      }} />
  }

  return <div className="page-container customer-api-page">
    <div className="page-header">
      <div><h1 className="page-title">Tạo đơn giao hàng</h1><p className="page-subtitle">Thông tin rõ ràng, gửi hàng thuận tiện.</p></div>
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
          setCreated(null); setIntent(null); setLocked(false); setDraft({ ...emptyShipmentDraft }); setError(null); setErrors({}); reviewed.current.clear(); setFocusRequest(null); setRequestIssue(null)
        }}>Tạo đơn khác</button>
      </div>
    </section> : <form onSubmit={submit} className="form-card" noValidate aria-busy={busy}>
      {(error || Object.keys(errors).length > 0) && <div className="customer-error" role="alert" tabIndex={-1} ref={summary}>
        <h2>{error ?? 'Kiểm tra lại thông tin'}</h2>
        {Object.keys(errors).length > 0 && <ul>{(Object.keys(errors) as (keyof ShipmentDraft)[])
          .filter(name => !name.endsWith('Lng') || !errors[name.replace('Lng', 'Lat') as keyof ShipmentDraft]).map(name =>
          <li key={name}><a href={'#' + fieldId(name)}>{labels[name]}: {errors[name]}</a></li>)}</ul>}
        {error && requestIssue === 'uncertain' && <p>Chưa xác định được kết quả. Nếu thử lại, hệ thống giữ nguyên mã yêu cầu và thông tin đã gửi; không tạo đơn khác trước khi đối chiếu.</p>}
        {error && requestIssue === 'rejected' && <p>Yêu cầu bị từ chối. Kiểm tra thông tin hoặc liên hệ quản trị viên theo thông báo trên.</p>}
        {requestIssue === 'auth' && <Link to="/login">Kiểm tra phiên đăng nhập</Link>}
      </div>}
      <p className="customer-form-intro">Nhập tên đường/tòa nhà, khu vực và địa chỉ chi tiết, sau đó chọn đúng điểm lấy/giao trên bản đồ. Các mục có dấu * là bắt buộc.</p>
      <fieldset className="form-section"><legend>Điểm lấy hàng</legend><div className="form-grid">
        {field('pickupAddress', true, 'Ví dụ: đường Xuân Thủy hoặc tên tòa nhà…')}
        {field('pickupArea', false, 'Ví dụ: Cầu Giấy, Hà Nội')}{field('pickupDetails', false, 'Ví dụ: số 144, tầng 2, cửa bên trái')}
        {location('pickup')}
      </div></fieldset>
      <fieldset className="form-section"><legend>Điểm giao và người nhận</legend><div className="form-grid">
        {field('dropoffAddress', true, 'Ví dụ: đường Đại Cồ Việt hoặc tên tòa nhà…')}
        {field('dropoffArea', false, 'Ví dụ: Bạch Mai, Hà Nội')}{field('dropoffDetails', false, 'Ví dụ: số 1, cổng chính')}
        {location('dropoff')}
        {field('recipientName', true)}{field('recipientPhone', true)}
      </div></fieldset>
      <fieldset className="form-section"><legend>Thông tin bổ sung</legend><div className="form-grid">
        {field('packageDescription')}{field('packageWeightKg')}{field('notes')}{field('expectedDeliveryAt')}
      </div><p className="customer-helper">Hạn giao dùng giờ trên thiết bị, được gửi dưới dạng UTC. Đây không phải ETA.</p></fieldset>
      {locked && <p className="customer-pending-note" role="status">Thông tin đã khóa cho lần gửi này. Giữ trang để thử lại cùng yêu cầu; không tạo đơn khác trước khi đối chiếu nếu kết quả chưa xác định.</p>}
      <div className="form-actions">
        <button type="submit" disabled={busy} aria-busy={busy} aria-describedby={busy ? 'shipment-sending' : undefined} className="btn btn-primary ui-submit">
          {busy && <span className="ui-button-spinner" aria-hidden="true" />}{busy ? 'Đang tạo đơn…' : locked ? 'Thử lại cùng yêu cầu' : 'Xác nhận tạo đơn'}</button>
        {!locked && <Link to="/customer/shipments" className="btn btn-outline">Để sau</Link>}
      </div>
      {busy && <p className="ui-disabled-reason" id="shipment-sending" role="status">Đang gửi thông tin đến máy chủ. Vui lòng chờ kết quả trước khi gửi lại.</p>}
      <p className="customer-helper">Thông tin nhập chỉ giữ trên trang này. Rời trang hoặc tải lại sẽ mất bản nháp.</p>
    </form>}
  </div>
}
