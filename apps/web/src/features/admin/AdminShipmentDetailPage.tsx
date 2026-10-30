import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { failShipment, getShipmentById, normalizeFailureReason } from '../../api/endpoints/shipments'
import { DataSkeleton } from '../../components/ui/DataSkeleton'
import type { ShipmentDetail, ShipmentResponse } from '../../types/shipment-api'
import { useAuth } from '../auth/useAuth'
import { adminErrorMessage } from './admin-errors'
import { AdminShipmentDetail } from './AdminShipmentDetail'
import { ShipmentTracking } from '../../components/shipment/ShipmentTracking'
import './admin-api.css'

type Phase = 'loading' | 'ready' | 'review' | 'submitting' | 'reconciling' | 'blocked'

export function AdminShipmentDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  return <div className="admin-page admin-api-page admin-shipment-detail-page">
    <div className="page-header"><div>
      <h1 className="page-title">Chi tiết đơn hàng</h1></div>
      <Link className="btn btn-outline" to="/admin/shipments">Về danh sách đơn</Link></div>
    <Detail key={user?.id + ':' + id} id={id} />
  </div>
}

function Detail({ id }: { id: string }) {
  const [shipment, setShipment] = useState<ShipmentDetail | ShipmentResponse | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState<unknown>()
  const [notice, setNotice] = useState('')
  const reading = useRef<AbortController | null>(null)
  const writing = useRef<AbortController | null>(null)
  const posting = useRef(false)
  const confirmedFailure = useRef<ShipmentResponse | null>(null)
  const mounted = useRef(false)
  const reasonInput = useRef<HTMLTextAreaElement | null>(null)
  const reviewButton = useRef<HTMLButtonElement | null>(null)
  const reviewPanel = useRef<HTMLElement | null>(null)
  const refreshButton = useRef<HTMLButtonElement | null>(null)
  const previousPhase = useRef<Phase>('loading')

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    reading.current = controller
    getShipmentById(id, controller.signal).then(value => {
      if (!controller.signal.aborted) { setShipment(value); setPhase('ready') }
    }).catch(cause => { if (!controller.signal.aborted) { setError(cause); setPhase('blocked') } })
    return () => { mounted.current = false; reading.current?.abort(); writing.current?.abort() }
  }, [id])
  useEffect(() => {
    if (phase === 'review') reviewPanel.current?.focus()
    else if (phase === 'blocked') refreshButton.current?.focus()
    else if (previousPhase.current === 'review' && phase === 'ready') reviewButton.current?.focus()
    else if (previousPhase.current === 'reconciling' && phase === 'ready') refreshButton.current?.focus()
    previousPhase.current = phase
  }, [phase])

  async function readLatest(confirmed?: ShipmentResponse, message = 'Đã đọc lại trạng thái hiện tại.') {
    reading.current?.abort()
    const controller = new AbortController()
    reading.current = controller
    const confirmedSnapshot = confirmed ?? confirmedFailure.current
    const resultMessage = confirmedSnapshot
      ? 'Máy chủ đã xác nhận giao thất bại cho đơn ' + confirmedSnapshot.trackingNumber + '.' : message
    setPhase('reconciling'); setError(undefined); setReason(''); setFieldError('')
    setNotice(confirmedSnapshot ? resultMessage : 'Đang đọc lại trạng thái hiện tại.')
    try {
      const value = await getShipmentById(id, controller.signal)
      if (!controller.signal.aborted) { setShipment(value); setPhase('ready'); setNotice(resultMessage) }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setShipment(confirmedSnapshot ?? null); setError(cause); setPhase('blocked')
        setNotice(confirmedSnapshot ? resultMessage : 'Chưa xác định được kết quả. Thao tác ghi đang bị khóa.')
      }
    }
  }

  async function submit() {
    if (posting.current || phase !== 'review' || shipment?.status !== 'PICKED_UP') return
    posting.current = true
    const controller = new AbortController()
    writing.current = controller
    setPhase('submitting'); setError(undefined); setNotice('')
    try {
      const result = await failShipment(id, reason, controller.signal)
      if (!mounted.current || controller.signal.aborted) return
      confirmedFailure.current = result
      setShipment(result)
      await readLatest(result)
    } catch (cause) {
      if (!mounted.current || controller.signal.aborted) return
      const uncertain = !(cause instanceof ApiError) || cause.status >= 500 ||
        (cause.status === 409 && cause.code !== 'USER_NOT_PROVISIONED') ||
        ['REQUEST_TIMEOUT', 'NETWORK_ERROR', 'INVALID_RESPONSE'].includes(cause.code)
      if (uncertain) await readLatest(undefined, cause instanceof ApiError && cause.status === 409
        ? 'Trạng thái đơn đã thay đổi. Đã đọc lại trạng thái hiện tại.'
        : 'Chưa xác định kết quả gửi. Đã đọc lại trạng thái hiện tại.')
      else { setError(cause); setPhase('ready') }
    } finally { posting.current = false }
  }

  const busy = phase === 'loading' || phase === 'submitting' || phase === 'reconciling'
  const canFail = shipment?.status === 'PICKED_UP' && phase !== 'blocked'
  return <section className="admin-detail-panel" aria-busy={busy}>
    {phase === 'loading' && <DataSkeleton label="Đang tải chi tiết đơn…" detail />}
    {shipment && <AdminShipmentDetail shipment={shipment} />}
    {shipment && <ShipmentTracking key={shipment.driverId + ':' + shipment.status} id={shipment.id} status={shipment.status} />}
    {notice && <p className="shipment-action-notice" role="status">{notice}</p>}
    {!!error && <p className="shipment-action-error" role="alert">{error instanceof ApiError && error.status === 400
      ? 'Thông tin không hợp lệ. Kiểm tra mã đơn và lý do.' : adminErrorMessage(error)}</p>}
    {phase === 'submitting' && <p className="shipment-action-notice" role="status">Đang gửi báo cáo thất bại…</p>}
    {phase === 'reconciling' && <p className="shipment-action-notice" role="status">Đang tải thông tin đơn…</p>}
    <div className="admin-api-actions">
      <button ref={refreshButton} type="button" className="btn btn-outline" disabled={busy || phase === 'review'} onClick={() => void readLatest()}>
        {phase === 'blocked' ? 'Đọc lại thông tin' : 'Tải lại thông tin'}
      </button>
      {phase === 'ready' && (shipment?.status === 'CREATED' || shipment?.status === 'ASSIGNED') &&
        <Link className="btn btn-primary" to={'/admin/assignment?shipmentId=' + encodeURIComponent(id)}>Phân công tài xế</Link>}
    </div>
    {canFail && <form className="shipment-failure-form" noValidate onSubmit={event => {
      event.preventDefault()
      if (phase !== 'ready') return
      try { setReason(normalizeFailureReason(reason)); setFieldError(''); setError(undefined); setPhase('review') }
      catch { setFieldError('Nhập lý do từ 5 đến 500 ký tự.'); reasonInput.current?.focus() }
    }}>
      <h2>Báo giao thất bại</h2>
      <label htmlFor="shipment-failure-reason">Lý do <span className="shipment-required" aria-hidden="true">*</span></label>
      <textarea ref={reasonInput} id="shipment-failure-reason" rows={3} value={reason} required disabled={phase !== 'ready'}
        aria-invalid={!!fieldError} aria-describedby={fieldError ? 'shipment-failure-error' : undefined}
        onChange={event => { setReason(event.target.value); setFieldError('') }} />
      {fieldError && <p id="shipment-failure-error" className="shipment-action-error" role="alert">{fieldError}</p>}
      <div className="admin-api-actions"><button ref={reviewButton} type="submit" className="btn btn-outline" disabled={phase !== 'ready'}>Xem lại báo cáo</button></div>
    </form>}
    {(phase === 'review' || phase === 'submitting') && <section ref={reviewPanel} className="shipment-failure-review" tabIndex={-1} aria-labelledby="shipment-failure-title">
      <h2 id="shipment-failure-title">Xác nhận giao thất bại</h2>
      <p>Đơn: <strong>{shipment?.trackingNumber}</strong></p><p>{reason}</p>
      <div className="admin-api-actions">
        <button type="button" className="btn btn-primary" disabled={phase === 'submitting'} aria-busy={phase === 'submitting'} onClick={() => void submit()}>Xác nhận giao thất bại</button>
        <button type="button" className="btn btn-outline" disabled={phase === 'submitting'} onClick={() => setPhase('ready')}>Hủy xác nhận</button>
      </div>
    </section>}
  </section>
}
