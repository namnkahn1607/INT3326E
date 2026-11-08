# Research and member handoff review

Ngày 2026-10-24, base `a2c245f`, working tree sạch sau merge; đọc code chứ không
mặc định báo cáo của thành viên chứng minh runtime cloud.

| Phần | Hiện trạng quan sát | Quyết định |
| --- | --- | --- |
| TV6 Auth/Admin | DriversController GET drivers ADMIN + BusinessUserGuard, service/repository/DTO/tests có sẵn; docs/tv6-admin-directory.md ghi mock/SQL local, chưa deploy acceptance | Reuse API11 chính xác, không /admin/drivers, không làm backend mới |
| TV1 Shipment/Assignment | ShipmentsController rỗng; assignment controller/service/DTO rỗng trong base; remote refs hiện có chưa thấy nhánh Shipment khác | Implement client từ PF SPEC, ghi dependency ngoài scope; không fallback mock |
| TV3 Customer | apiClient có Bearer, abort/timeout, ApiError; getShipments/getShipmentById có parser SC01–03 | Reuse/additive helper, không đổi Create |
| TV4 Driver | Route/emitter đã có; tuần 3 frontend Driver ở remote branch riêng | Không merge/sửa Driver, cloud acceptance phối hợp TV4 |
| Admin UI | Shipment/assignment/driver pages mock, submit disabled; layout blanket DemoNotice | Chuyển đúng các trang in-scope sang API, giữ trang khác demo |

Decision: specs/001-admin-assignment là bộ mới vì không có spec phân công riêng;
không mở rộng bộ Customer tuần 2 hoặc tạo lại constitution. Alternative: ghi đè
week2/customer hoặc code backend bị loại do khác scope/ownership.

Decision: review inline thay modal để bàn phím/mobile đơn giản, cần bước xác nhận
riêng. State trước pickup cho phép reassign, driver có đơn vẫn chọn được.
Alternative: disable busy driver hoặc tự retry Assign bị loại theo FR02.

Decision: query trang rõ, cursor opaque và abort khi chuyển. Tách GET recovery khỏi
POST; lỗi 5xx/malformed response cũng xử lý thận trọng là chưa chắc kết quả.
Alternative: retry POST hoặc optimistic update thành công bị loại do có thể gán lại
đè quyết định của Admin khác.

UX local search: ui-ux-pro-max query “confirmation form error recovery” trả Error
Recovery, accessible error announcements và Confirmation Messages; áp dụng alert,
status, loading và nút recovery đọc lại. Không thay design system/motion.

Không còn NEEDS CLARIFICATION về phạm vi/contract; readiness cloud là dependency,
không được tự thay yêu cầu để đóng gate.
