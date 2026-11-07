import { ApiError } from '../../api/client'

export function adminErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Không kết nối được máy chủ. Kiểm tra mạng và tải lại.'
  if (error.code === 'USER_NOT_PROVISIONED') return 'Tài khoản chưa được liên kết hoặc chưa đúng quyền nghiệp vụ. Liên hệ quản trị viên.'
  if (error.status === 401) return 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.'
  if (error.status === 403) return 'Tài khoản không có quyền thực hiện thao tác Admin này.'
  if (error.status === 404) return 'Không tìm thấy tài nguyên hoặc API chưa được triển khai. Kiểm tra với nhóm backend.'
  if (error.status === 409) return 'Đơn đã thay đổi hoặc không còn cho phép phân công. Cần đọc lại chi tiết hiện tại.'
  if (error.code === 'INVALID_RESPONSE') return 'Máy chủ trả dữ liệu chưa đúng hợp đồng. Chưa thể xác nhận kết quả.'
  if (error.code === 'REQUEST_TIMEOUT') return 'Máy chủ phản hồi quá chậm. Chưa xác định được kết quả.'
  if (error.status >= 500) return 'Dịch vụ tạm thời chưa sẵn sàng. Kiểm tra lại với nhóm backend.'
  if (error.status === 400) return 'Thông tin không hợp lệ. Kiểm tra lại đơn và tài xế đã chọn.'
  return 'Không hoàn thành được yêu cầu. Kiểm tra mạng và tải lại thông tin.'
}
