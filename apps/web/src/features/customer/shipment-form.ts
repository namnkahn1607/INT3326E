import type { CreateShipmentPayload } from '../../types/shipment-api'
import { ApiError } from '../../api/client'
import { characterCount } from '../../utils'

export const emptyShipmentDraft = {
  pickupAddress: '', pickupLat: '', pickupLng: '', dropoffAddress: '', dropoffLat: '', dropoffLng: '',
  pickupArea: '', pickupDetails: '', dropoffArea: '', dropoffDetails: '',
  senderName: '', senderPhone: '',
  recipientName: '', recipientPhone: '', notes: '', packageDescription: '', packageWeightKg: '', expectedDeliveryAt: '',
}
export type ShipmentDraft = typeof emptyShipmentDraft
export type FieldErrors = Partial<Record<keyof ShipmentDraft, string>>
export interface CreateIntent { key: string; payload: CreateShipmentPayload; startedAt: number }
export type CreateRequestIssue = 'auth' | 'uncertain' | 'rejected' | 'unavailable'
export const canRetryIntent = (startedAt: number, now = Date.now()) => now - startedAt < 86_400_000 && now >= startedAt

export function classifyCreateFailure(error: unknown): CreateRequestIssue {
  if (!(error instanceof ApiError)) return 'uncertain'
  if (error.status === 404) return 'unavailable'
  if (error.status === 401) return 'auth'
  if (error.status === 0 || error.status >= 500 || error.code === 'INVALID_RESPONSE') return 'uncertain'
  return 'rejected'
}

export function validateShipmentDraft(draft: ShipmentDraft, now = Date.now()): { payload: CreateShipmentPayload; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const text = (field: keyof ShipmentDraft, min: number, max: number) => {
    const value = draft[field].trim()
    const length = characterCount(value)
    if (length < min || length > max) errors[field] = `Nhập từ ${min} đến ${max} ký tự.`
    return value
  }
  const coordinate = (field: keyof ShipmentDraft, range: number) => {
    const value = Number(draft[field])
    if (!draft[field].trim() || !Number.isFinite(value) || Math.abs(value) > range) errors[field] = `Chọn vị trí ${field.startsWith('pickup') ? 'lấy' : 'giao'} hàng hợp lệ trên bản đồ.`
    return value
  }
  const address = (kind: 'pickup' | 'dropoff') => {
    const street = text(kind === 'pickup' ? 'pickupAddress' : 'dropoffAddress', 0, 255)
    const area = text(kind === 'pickup' ? 'pickupArea' : 'dropoffArea', 0, 150)
    const details = text(kind === 'pickup' ? 'pickupDetails' : 'dropoffDetails', 0, 150)
    const value = [details, street, area].filter(Boolean).join(', ')
    const length = characterCount(value)
    if (length < 5) errors[kind === 'pickup' ? 'pickupAddress' : 'dropoffAddress'] = 'Bổ sung khu vực để địa chỉ đầy đủ và khớp với vị trí đã chọn.'
    else if (length > 255) errors[kind === 'pickup' ? 'pickupAddress' : 'dropoffAddress'] = 'Địa chỉ đầy đủ tối đa 255 ký tự.'
    return value
  }
  const payload: CreateShipmentPayload = {
    pickupAddress: address('pickup'),
    pickupLocation: { lat: coordinate('pickupLat', 90), lng: coordinate('pickupLng', 180) },
    dropoffAddress: address('dropoff'),
    dropoffLocation: { lat: coordinate('dropoffLat', 90), lng: coordinate('dropoffLng', 180) },
    recipientName: text('recipientName', 2, 100), recipientPhone: draft.recipientPhone.trim(),
  }
  if (!/^\+?\d{9,15}$/.test(payload.recipientPhone)) errors.recipientPhone = 'Nhập 9–15 chữ số, có thể bắt đầu bằng dấu +.'
  text('senderName', 1, 100)
  if (!/^\+?\d{9,15}$/.test(draft.senderPhone.trim())) errors.senderPhone = 'Nhập 9–15 chữ số, có thể bắt đầu bằng dấu +.'
  for (const field of ['notes', 'packageDescription'] as const) {
    if (draft[field].trim()) payload[field] = text(field, 0, 500)
  }
  if (draft.packageWeightKg.trim()) {
    payload.packageWeightKg = Number(draft.packageWeightKg)
    if (!Number.isFinite(payload.packageWeightKg) || payload.packageWeightKg <= 0) errors.packageWeightKg = 'Khối lượng phải là số lớn hơn 0 kg.'
  }
  if (draft.expectedDeliveryAt) {
    const time = Date.parse(draft.expectedDeliveryAt)
    if (!Number.isFinite(time) || time <= now) errors.expectedDeliveryAt = 'Chọn hạn giao sau thời điểm hiện tại.'
    else payload.expectedDeliveryAt = new Date(time).toISOString()
  }
  return { payload, errors }
}

export function shipmentErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.'
  if (error.code === 'NETWORK_ERROR') return 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại cùng yêu cầu.'
  if (error.code === 'REQUEST_TIMEOUT') return 'Máy chủ phản hồi quá chậm. Kết quả chưa xác định; thử lại cùng yêu cầu để tránh tạo trùng.'
  if (error.code === 'USER_NOT_PROVISIONED') return 'Tài khoản chưa được liên kết dữ liệu nghiệp vụ. Liên hệ quản trị viên để kiểm tra.'
  if (error.code === 'IDEMPOTENCY_KEY_CONFLICT') return 'Mã yêu cầu đã dùng với dữ liệu khác. Hãy đối chiếu đơn trước khi tạo lại.'
  if (error.status === 401) return 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'
  if (error.status === 403) return 'Tài khoản không có quyền thực hiện thao tác này.'
  if (error.code === 'INVALID_SHIPMENT_ID') return 'Đường dẫn đơn hàng không hợp lệ.'
  if (error.status === 404) return 'Không tìm thấy đơn hoặc API chưa sẵn sàng. Hãy kiểm tra lại với nhóm backend.'
  if (error.status === 400) return 'Thông tin chưa hợp lệ. Kiểm tra các trường được đánh dấu và thử lại.'
  if (error.status === 429) return 'Có quá nhiều yêu cầu. Vui lòng chờ rồi thử lại.'
  if (error.code === 'INVALID_RESPONSE') return 'Phản hồi máy chủ chưa đúng hợp đồng. Chưa thể xác nhận kết quả; hãy đối chiếu trước khi tạo đơn khác.'
  return 'Máy chủ chưa phản hồi đầy đủ. Kiểm tra kết nối và thử lại.'
}
