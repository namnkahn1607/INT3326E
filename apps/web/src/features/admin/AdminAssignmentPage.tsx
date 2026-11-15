import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { createPortal } from 'react-dom'
import { ApiError } from '../../api/client'
import { getDrivers } from '../../api/endpoints/drivers'
import { assignShipment, getShipmentById, getShipments, isShipmentId } from '../../api/endpoints/shipments'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Icon } from '../../components/ui/Icon'
import type { DriverResponse } from '../../types/driver-api'
import type { ShipmentDetail, ShipmentResponse } from '../../types/shipment-api'
import { useAuth } from '../auth/useAuth'
import { AdminPageFeedback, AdminPager } from './AdminPageFeedback'
import { adminErrorMessage } from './admin-errors'
import { AdminShipmentDetail } from './AdminShipmentDetail'
import { useAdminPage } from './useAdminPage'
import './admin-api.css'

export function AdminAssignmentPage() {
  const { user } = useAuth()
  return <Assignment key={user?.id ?? 'signed-out'} />
}

function Assignment() {
  const [params, setParams] = useSearchParams()
  const id = params.get('shipmentId') ?? ''
  const [status, setStatus] = useState<'CREATED' | 'ASSIGNED'>('CREATED')
  const [busy, setBusy] = useState(false)
  const [detailHost, setDetailHost] = useState<HTMLDivElement | null>(null)
  const load = useCallback((cursor: string | undefined, signal: AbortSignal) => getShipments({ status, cursor }, signal), [status])
  const state = useAdminPage(load, status)
  const loadDrivers = useCallback((cursor: string | undefined, signal: AbortSignal) => getDrivers({ cursor }, signal), [])
  const directory = useAdminPage(loadDrivers, 'drivers')
  function clear() { setParams({}) }
  function collapse() {
    const item = detailHost?.closest('.assignment-order-item')
    const focusTarget = item?.querySelector<HTMLButtonElement>(':scope > .assignment-select-card') ?? detailHost?.closest<HTMLElement>('.assignment-cards-list')
    focusTarget?.focus()
    clear()
  }
  return <div className="admin-page admin-api-page admin-assignment-page">
    <div className="page-header"><div>
      <h1 className="page-title">Phân công tài xế</h1>
      <p className="page-subtitle">Chọn đơn và tài xế, sau đó xác nhận phân công.</p>
    </div><div className="assignment-status-filter">
      <label htmlFor="assignment-status">Trạng thái đơn</label>
      <select id="assignment-status" disabled={busy} value={status} onChange={event => { setStatus(event.target.value as 'CREATED' | 'ASSIGNED'); clear() }}>
        <option value="CREATED">Chờ phân công</option><option value="ASSIGNED">Đã phân công — có thể gán lại</option>
      </select>
    </div></div>
    <div className="assignment-split-layout">
      <section className="assignment-col assignment-orders" aria-labelledby="assignment-orders-title">
        <div className="col-header"><h2 id="assignment-orders-title"><Icon name="box" />Đơn hàng</h2>
          <button type="button" className="btn btn-outline" disabled={busy || state.loading} onClick={() => { clear(); state.refresh() }}>Làm mới đơn</button>
        </div>
        <AdminPageFeedback loading={state.loading} error={state.error} empty={state.page?.data.length === 0} label="đơn hàng" onRetry={state.refresh} />
        <div className="assignment-cards-list" role="region" aria-label="Danh sách đơn để phân công" tabIndex={0}>
          {isShipmentId(id) && !state.page?.data.some(item => item.id === id) && <div className="assignment-order-item selected">
            <div ref={setDetailHost} data-shipment-id={id} />
          </div>}
          {state.page?.data.map(item => <div className={'assignment-order-item' + (id === item.id ? ' selected' : '')} key={item.id}><button type="button"
            className={'assignment-select-card ui-selection-card' + (id === item.id ? ' selected' : '')} key={item.id}
            disabled={busy} aria-expanded={id === item.id} aria-controls={id === item.id ? 'assignment-detail-' + id : undefined}
            onClick={() => id === item.id ? clear() : setParams({ shipmentId: item.id })}>
            <div className="card-top"><strong>{item.trackingNumber}</strong><StatusBadge status={item.status} /></div>
            <span className="assignment-recipient">{item.recipientName}</span>
            <span className="assignment-route"><span title={item.pickupAddress}>{item.pickupAddress}</span><Icon name="arrow" /><span title={item.dropoffAddress}>{item.dropoffAddress}</span></span>
          </button>{id === item.id && <div ref={setDetailHost} data-shipment-id={id} />}</div>)}</div>
        {id && !isShipmentId(id) && <p className="admin-api-error" role="alert">Mã đơn không hợp lệ. Chọn lại đơn từ danh sách.</p>}
        {state.page && <>
          <AdminPager label="đơn hàng" number={state.number} hasMore={state.page.pagination.hasMore} disabled={busy}
            onPrevious={() => { clear(); state.previous() }} onNext={() => { clear(); state.next() }} />
        </>}
      </section>
      {!isShipmentId(id) ? <>
        <DriverChoices directory={directory} disabled locked={false} selected={null} onSelect={() => {}} />
      </> : <AssignmentEditor key={id} id={id} host={detailHost?.dataset.shipmentId === id ? detailHost : null} onClose={collapse}
        directory={directory} onLock={setBusy} onDirectoryRefresh={directory.refresh}
        onAssigned={() => { state.refresh(); directory.refresh() }} />}
    </div>
  </div>
}

type DriverDirectory = ReturnType<typeof useAdminPage<DriverResponse>>

function DriverChoices({ directory: state, disabled, locked, selected, onSelect }: {
  directory: DriverDirectory; disabled: boolean; locked: boolean; selected: string | null
  onSelect: (driver: DriverResponse | null) => void
}) {
  function change(action: () => void) { onSelect(null); action() }
  return <section className="assignment-col assignment-drivers" aria-labelledby="assignment-drivers-title">
    <div className="col-header"><h2 id="assignment-drivers-title"><Icon name="truck" />Tài xế</h2>
      <button className="btn btn-outline" type="button" disabled={locked || state.loading} onClick={() => change(state.refresh)}>Làm mới tài xế</button></div>
    <AdminPageFeedback loading={state.loading} error={state.error} empty={state.page?.data.length === 0} label="tài xế" onRetry={() => change(state.refresh)} />
    {state.page && <>
      <div className="assignment-cards-list" role="region" aria-label="Danh sách tài xế để phân công" tabIndex={0}>{state.page.data.map(driver => <button type="button" key={driver.id}
        className={'assignment-select-card ui-selection-card' + (selected === driver.id ? ' selected' : '')}
        disabled={disabled} aria-pressed={selected === driver.id} title={driver.id} onClick={() => onSelect(driver)}>
        <span className="assignment-driver-heading"><strong>{driver.name}</strong><span className="assignment-count">{driver.activeShipmentCount} đơn</span></span>
        <span className="admin-api-id">{driver.id}</span>
      </button>)}</div>
      <AdminPager label="tài xế" number={state.number} hasMore={state.page.pagination.hasMore} disabled={locked}
        onPrevious={() => change(state.previous)} onNext={() => change(state.next)} />
    </>}
  </section>
}

type Phase = 'loading' | 'idle' | 'review' | 'submitting' | 'reconciling' | 'blocked'

function AssignmentEditor({ id, host, onClose, directory, onLock, onAssigned, onDirectoryRefresh }: {
  id: string; directory: DriverDirectory; onLock: (locked: boolean) => void
  host: HTMLDivElement | null; onClose: () => void
  onAssigned: () => void; onDirectoryRefresh: () => void
}) {
  const [detail, setDetail] = useState<ShipmentResponse | ShipmentDetail | null>(null)
  const [target, setTarget] = useState<DriverResponse | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<unknown>()
  const [notice, setNotice] = useState('')
  const reading = useRef<AbortController | null>(null)
  const writing = useRef<AbortController | null>(null)
  const posting = useRef(false)
  const mounted = useRef(false)
  const review = useRef<HTMLElement | null>(null)
  const reviewButton = useRef<HTMLButtonElement | null>(null)
  const previousPhase = useRef<Phase>('loading')
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    reading.current = controller
    getShipmentById(id, controller.signal).then(value => {
      if (!controller.signal.aborted) { setDetail(value); setPhase('idle') }
    }).catch(cause => { if (!controller.signal.aborted) { setError(cause); setPhase('blocked') } })
    return () => { mounted.current = false; reading.current?.abort(); writing.current?.abort(); onLock(false) }
  }, [id, onLock])
  useEffect(() => {
    if (phase === 'review') review.current?.focus()
    else if (previousPhase.current === 'review' && phase === 'idle') reviewButton.current?.focus()
    previousPhase.current = phase
  }, [phase])
  const assignable = detail?.status === 'CREATED' || detail?.status === 'ASSIGNED'
  const sameDriver = !!target && target.id === detail?.driverId
  const canReview = phase === 'idle' && assignable && !!target && !sameDriver

  async function readLatest(reason = 'Thông tin chi tiết cần được xác minh lại.') {
    reading.current?.abort()
    const controller = new AbortController()
    reading.current = controller
    setPhase('reconciling'); onLock(true); setTarget(null); setError(undefined); setNotice(reason)
    try {
      const value = await getShipmentById(id, controller.signal)
      if (!controller.signal.aborted) {
        setDetail(value); setPhase('idle'); onDirectoryRefresh()
        setNotice(reason + ' Đã đọc lại trạng thái hiện tại. Chọn tài xế và xác nhận mới nếu vẫn muốn phân công; không tự gửi lại yêu cầu cũ.')
      }
    } catch (cause) {
      if (!controller.signal.aborted) { setError(cause); setPhase('blocked'); setNotice(reason + ' Chưa đọc được kết quả hiện tại; thao tác ghi đang bị khóa.') }
    } finally { if (mounted.current) onLock(false) }
  }

  async function submit() {
    if (posting.current || phase !== 'review' || !detail || !target || !assignable || sameDriver) return
    posting.current = true
    const controller = new AbortController()
    writing.current = controller
    const driver = target
    setPhase('submitting'); setError(undefined); setNotice(''); onLock(true)
    try {
      const result = await assignShipment(id, driver.id, controller.signal)
      if (!mounted.current) return
      setDetail(result); setTarget(null); setPhase('idle')
      setNotice('Máy chủ đã xác nhận phân công đơn ' + result.trackingNumber + ' cho ' + driver.name + ' (' + result.driverId + ').')
      onAssigned()
    } catch (cause) {
      if (!mounted.current) return
      const uncertain = !(cause instanceof ApiError) || cause.status >= 500 ||
        (cause.status === 409 && cause.code !== 'USER_NOT_PROVISIONED') ||
        ['REQUEST_TIMEOUT', 'NETWORK_ERROR', 'INVALID_RESPONSE'].includes(cause.code)
      if (uncertain) await readLatest(adminErrorMessage(cause))
      else { setError(cause); setTarget(null); setPhase('idle') }
    } finally {
      posting.current = false
      if (mounted.current) onLock(false)
    }
  }

  return <>
    <DriverChoices directory={directory} disabled={phase !== 'idle' || !assignable} locked={phase !== 'idle'} selected={target?.id ?? null}
      onSelect={driver => { if (phase === 'idle') { setTarget(driver); setError(undefined) } }} />
    {host && createPortal(<section id={'assignment-detail-' + id} className="admin-assignment-editor assignment-inline-detail" aria-label="Chi tiết và xác nhận phân công">
    {phase === 'loading' && <AdminPageFeedback loading label="chi tiết đơn" onRetry={() => void readLatest()} />}
    <div className="assignment-detail-workspace">
    {detail && <AdminShipmentDetail shipment={detail} compact />}
    <div className="assignment-intent">
    {notice && <p className="admin-api-message" role="status">{notice}</p>}
    {!!error && <div className="admin-api-message admin-api-error" role="alert"><p>{adminErrorMessage(error)}</p></div>}
    {phase === 'reconciling' && <p role="status">Đang đọc lại chi tiết, không gửi lại Assign…</p>}
    {phase === 'blocked' && <button className="btn btn-outline" type="button" onClick={() => void readLatest()}>Đọc lại chi tiết</button>}
    <div className="assignment-action-bar">
      <p id="assignment-disabled">{!detail ? 'Đang chờ chi tiết đơn.'
        : !assignable ? 'Đơn không còn cho phép phân công vì đã lấy hàng hoặc kết thúc.'
        : phase === 'blocked' ? 'Cần đọc lại chi tiết thành công trước khi phân công.'
        : sameDriver ? 'Người được chọn đã là tài xế hiện hành; không cần gửi lại.'
        : !target ? 'Chọn một tài xế để tiếp tục.' : 'Đang chọn: ' + target.name + '. Cần xem lại và xác nhận riêng.'}</p>
      <button ref={reviewButton} className="btn btn-primary" type="button" aria-describedby="assignment-disabled"
        disabled={!canReview} onClick={() => { if (canReview) setPhase('review') }}>Xem lại phân công</button>
    </div>
    {(phase === 'review' || phase === 'submitting') && detail && target && <section ref={review} tabIndex={-1}
      className="admin-assignment-review" aria-labelledby="assignment-review-title">
      <h2 id="assignment-review-title">{detail.driverId ? 'Gán lại tài xế' : 'Xác nhận phân công'}</h2>
      <p>Đơn: <strong>{detail.trackingNumber}</strong></p>
      {detail.driverId && <p className="admin-api-id">Tài xế hiện hành: {detail.driverId}</p>}
      <p>Tài xế đích: <strong>{target.name}</strong></p>
      <p className="admin-api-id">{target.id}</p>
      <p>Hệ thống kiểm tra lại trạng thái khi xử lý. Không tự gửi lại nếu mất phản hồi.</p>
      <div className="admin-api-actions">
        <button className="btn btn-primary" type="button" disabled={phase === 'submitting'} aria-busy={phase === 'submitting'} onClick={() => void submit()}>
          {phase === 'submitting' ? 'Đang phân công…' : 'Xác nhận phân công'}
        </button>
        <button className="btn btn-outline" type="button" disabled={phase === 'submitting'} onClick={() => setPhase('idle')}>Hủy xác nhận</button>
      </div>
    </section>}
    </div></div>
    <button className="btn btn-outline assignment-collapse" type="button" disabled={phase === 'submitting' || phase === 'reconciling'} onClick={onClose}>Thu gọn chi tiết</button>
  </section>, host)}</>
}
