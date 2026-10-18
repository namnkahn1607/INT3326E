# Research — 2026-10-18

- Reuse AuthProvider/ProtectedRoute/session từ d38c598; không Auth mới/demo bypass.
  Frontend user.id là Firebase UID, không customerId nghiệp vụ; không gửi actor.
- Wire type/parser Customer riêng vì legacy Shipment của Admin dùng trackingCode;
  không đổi shared/database draft hoặc cast che schema sai.
- Giữ apiClient generic và token optional: undefined lấy token mới, null không Bearer.
  Thêm ApiError, đọc error body một lần, hỗ trợ Headers/tuple và timeout/abort.
- Intent RAM khóa key/payload khi kết quả chưa xác định; không auto-retry/key mới.
  Retry không validate lại deadline đã gửi. Không PII localStorage.
- UI01 cho nhập tọa độ, không cần provider/map picker mới.
- Backend controller/service/DTO Shipment rỗng: dependency TV1, không triển khai thay.
  /auth/me không chứng minh linkage; 409 USER_NOT_PROVISIONED có thể khi Create.
  CORS đã cho Idempotency-Key, không cần sửa backend.
- UI search error-summary/inline-errors/React cleanup phù hợp. Hai query design-system
  trả landing/education ngoài context; không persist, fallback token tím hiện có.
- Source: PF SPEC 01 nội dung v1.3, VI.API01/SC01–03/UI01 và VII.3, đọc lại trực tiếp
  ngày 2026-10-18; revision không đổi. Research là quyết định kỹ thuật, không yêu cầu mới.
