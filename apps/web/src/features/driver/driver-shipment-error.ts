import { ApiError } from '../../api/client'

export function driverShipmentError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return 'Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.'
    if (cause.status === 403) return 'Bạn không còn quyền thao tác với đơn này. Đơn có thể đã được phân công lại.'
    if (cause.code === 'USER_NOT_PROVISIONED') return 'Tài khoản chưa được liên kết với tài xế. Liên hệ quản trị viên.'
    if (cause.code === 'INVALID_SHIPMENT_ID') return 'Đường dẫn đơn hàng không hợp lệ.'
    if (cause.status === 404) return 'Không tìm thấy đơn hoặc chức năng này chưa sẵn sàng. Hãy tải lại thông tin hoặc liên hệ hỗ trợ.'
    if (cause.status === 409) return 'Trạng thái đơn đã thay đổi. Hãy đọc lại thông tin trước khi thao tác.'
    if (cause.code === 'INVALID_RESPONSE') return 'Chưa xác nhận được kết quả từ máy chủ. Hãy đọc lại thông tin đơn.'
  }
  return 'Chưa kết nối được máy chủ. Hãy kiểm tra mạng và đọc lại thông tin.'
}
