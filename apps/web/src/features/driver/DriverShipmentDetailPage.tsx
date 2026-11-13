import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { deliverShipment, getShipmentById, normalizeDeliveryNotes, pickupShipment } from '../../api/endpoints/shipments'
import { ShipmentLifecycleDetails } from '../../components/shipment/ShipmentLifecycleDetails'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { ShipmentDetail, ShipmentResponse } from '../../types/shipment-api'
import { useAuth } from '../auth/useAuth'
import { driverShipmentError } from './driver-shipment-error'
import './driver.css'

type Phase = 'loading' | 'ready' | 'review' | 'submitting' | 'reconciling' | 'blocked'

export function DriverShipmentDetailPage() {
  const { id = '' } = useParams()
  const { user, loading } = useAuth()
  if (loading) return <p role="status">Đang kiểm tra phiên tài xế…</p>
  if (!user || user.role !== 'DRIVER') return <p role="alert">Cần đăng nhập bằng tài khoản Driver.</p>
  return <DriverShipmentDetail key={user.id + ':' + id} id={id} />
}

function DriverShipmentDetail({ id }: { id: string }) {
  const [shipment, setShipment] = useState<ShipmentResponse | ShipmentDetail | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [notes, setNotes] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const reading = useRef<AbortController | null>(null)
  const writing = useRef<AbortController | null>(null)
  const posting = useRef(false)
  const confirmed = useRef<ShipmentResponse | null>(null)
  const reviewPanel = useRef<HTMLElement | null>(null)
  const reviewButton = useRef<HTMLButtonElement | null>(null)
  const refreshButton = useRef<HTMLButtonElement | null>(null)
  const notesInput = useRef<HTMLTextAreaElement | null>(null)
  const previousPhase = useRef<Phase>('loading')

  useEffect(() => {
    const controller = new AbortController()
    reading.current = controller
    getShipmentById(id, controller.signal).then(value => {
      if (!controller.signal.aborted) { setShipment(value); setPhase('ready') }
    }).catch(cause => {
      if (!controller.signal.aborted) { setError(driverShipmentError(cause)); setPhase('blocked') }
    })
    return () => { reading.current?.abort(); writing.current?.abort() }
  }, [id])
  useEffect(() => {
    if (phase === 'review') reviewPanel.current?.focus()
    else if (phase === 'blocked') refreshButton.current?.focus()
    else if (previousPhase.current === 'review' && phase === 'ready') reviewButton.current?.focus()
    previousPhase.current = phase
  }, [phase])

  async function readLatest(message = '') {
    reading.current?.abort()
    const controller = new AbortController()
    reading.current = controller
    const snapshot = confirmed.current
    const confirmedMessage = snapshot ? snapshot.status === 'PICKED_UP'
      ? 'Máy chủ đã xác nhận lấy hàng.' : 'Máy chủ đã xác nhận giao thành công.' : ''
    setPhase('reconciling'); setError(message); setNotes(''); setFieldError('')
    setNotice(confirmedMessage || 'Đang đọc lại trạng thái hiện tại.')
    try {
      const value = await getShipmentById(id, controller.signal)
      if (!controller.signal.aborted) {
        setShipment(value); setPhase('ready')
        setNotice(confirmedMessage || 'Đã đọc lại trạng thái hiện tại. Hãy kiểm tra trước khi xác nhận thao tác mới.')
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        const accessLost = cause instanceof ApiError && [401, 403, 404].includes(cause.status)
        if (accessLost) confirmed.current = null
        setShipment(accessLost ? null : snapshot); setPhase('blocked'); setError(driverShipmentError(cause))
        setNotice(confirmedMessage ? confirmedMessage + ' Chưa tải được thông tin bổ sung.'
          : 'Chưa đọc được trạng thái hiện tại. Thao tác đang bị khóa.')
      }
    }
  }

  async function submit() {
    if (posting.current || phase !== 'review' || !shipment || !['ASSIGNED', 'PICKED_UP'].includes(shipment.status)) return
    posting.current = true
    const controller = new AbortController()
    writing.current = controller
    confirmed.current = null
    setPhase('submitting'); setError(''); setNotice('')
    try {
      const result = shipment.status === 'ASSIGNED'
        ? await pickupShipment(id, controller.signal) : await deliverShipment(id, notes, controller.signal)
      if (controller.signal.aborted) return
      confirmed.current = result
      setShipment(result)
      await readLatest()
    } catch (cause) {
      if (!controller.signal.aborted) await readLatest(driverShipmentError(cause))
    } finally { posting.current = false }
  }

  const busy = phase === 'loading' || phase === 'submitting' || phase === 'reconciling'
  const pickup = shipment?.status === 'ASSIGNED'
  const actionable = pickup || shipment?.status === 'PICKED_UP'
  const label = pickup ? 'Xác nhận đã lấy hàng' : 'Xác nhận giao thành công'
  return <div className="driver-dashboard">
    <Link to="/driver">← Về đơn được phân công</Link>
    <section className="driver-panel driver-shipment-detail" aria-busy={busy} aria-labelledby="driver-detail-title">
      <h1 id="driver-detail-title">Chi tiết đơn tài xế</h1>
      {phase === 'loading' && <p role="status">Đang tải chi tiết đơn…</p>}
      {shipment && <>
        <h2 translate="no">{shipment.trackingNumber}</h2><StatusBadge status={shipment.status} />
        <dl><dt>Địa chỉ lấy hàng</dt><dd>{shipment.pickupAddress}</dd>
          <dt>Địa chỉ giao hàng</dt><dd>{shipment.dropoffAddress}</dd>
          <dt>Người nhận</dt><dd>{shipment.recipientName}</dd>
          <dt>Điện thoại</dt><dd>{shipment.recipientPhone}</dd>
          {shipment.notes && <><dt>Ghi chú đơn hàng</dt><dd>{shipment.notes}</dd></>}
          {shipment.packageDescription && <><dt>Kiện hàng</dt><dd>{shipment.packageDescription}</dd></>}
        </dl>
        <ShipmentLifecycleDetails shipment={shipment} />
      </>}
      {notice && <p role="status">{notice}</p>}
      {error && <p className="driver-send-error" role="alert">{error}</p>}
      {phase === 'submitting' && <p role="status">Đang gửi xác nhận…</p>}
      {phase === 'reconciling' && <p role="status">Đang tải lại thông tin đơn…</p>}
      <button ref={refreshButton} type="button" className="btn btn-outline" disabled={busy || phase === 'review'}
        onClick={() => void readLatest()}>Đọc lại thông tin đơn</button>
      {actionable && phase === 'ready' && <form className="driver-shipment-form" noValidate onSubmit={event => {
        event.preventDefault()
        try {
          setNotes(pickup ? '' : normalizeDeliveryNotes(notes)); setFieldError(''); setError(''); setPhase('review')
        } catch { setFieldError('Ghi chú giao hàng tối đa 255 ký tự.'); notesInput.current?.focus() }
      }}>
        {!pickup && <>
          <label htmlFor="driver-delivery-notes">Ghi chú giao hàng (không bắt buộc)</label>
          <textarea ref={notesInput} id="driver-delivery-notes" rows={3} value={notes} aria-invalid={!!fieldError}
            aria-describedby={fieldError ? 'driver-delivery-notes-error' : 'driver-delivery-notes-help'}
            onChange={event => { setNotes(event.target.value); setFieldError('') }} />
          <p id="driver-delivery-notes-help">Tối đa 255 ký tự.</p>
          {fieldError && <p id="driver-delivery-notes-error" role="alert">{fieldError}</p>}
        </>}
        <button ref={reviewButton} type="submit" className="btn btn-primary">{pickup ? 'Đã lấy hàng' : 'Giao thành công'}</button>
      </form>}
      {(phase === 'review' || phase === 'submitting') && <section ref={reviewPanel} className="driver-shipment-review"
        tabIndex={-1} aria-labelledby="driver-confirm-title">
        <h2 id="driver-confirm-title">{label}</h2>
        <p>Đơn: <strong>{shipment?.trackingNumber}</strong></p>
        <p>{pickup ? 'Chỉ xác nhận khi bạn đã nhận kiện hàng.' : 'Chỉ xác nhận sau khi hàng đã được giao cho người nhận.'}</p>
        {notes && <p>Ghi chú: {notes}</p>}
        <div className="driver-shipment-actions">
          <button type="button" className="btn btn-primary" disabled={phase === 'submitting'} onClick={() => void submit()}>{label}</button>
          <button type="button" className="btn btn-outline" disabled={phase === 'submitting'} onClick={() => setPhase('ready')}>Hủy xác nhận</button>
        </div>
      </section>}
    </section>
  </div>
}
