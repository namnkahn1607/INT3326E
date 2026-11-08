# Feature Specification: Admin phân công tài xế — TV3 tuần 3

**Feature Branch**: `feature/frontend`

**Created**: 2026-10-24

**Status**: Specified; chưa nghiệm thu tích hợp cloud

**Input**: TV3 triển khai giao diện đơn chưa gán, phân công và khung Admin theo ảnh phân công người dùng; Dispatcher đã gộp Admin. Chia task nhỏ, kiểm tra phần nhóm đã làm, dùng Spec Kit. Không thay đổi AGENTS.md.

## Sources and scope

Nguồn chính: ảnh phân công TV3 người dùng gửi và [PF SPEC 01 v1.3](https://docs.google.com/document/d/1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8/edit?tab=t.po4rmhqkefw), FR02/AC02, API02/03/04/11, UI03, VII.4. Ảnh ghi tuần lịch 6; bộ này dùng tên tuần 3 dự án, không đổi lịch nhóm. Báo cáo AI và spec này không thay thế nguồn chính.

Phạm vi: danh sách/chi tiết đơn Admin, danh sách tài xế để chọn, phân công/gán lại trước lấy hàng, xử lý kết quả chưa xác định. Tái sử dụng khung Admin và phiên đăng nhập. Không sửa backend/Driver/GPS/DB/IAM, không quản lý tài khoản, thêm role, KPI toàn hệ thống hay live tracking. Không tự commit/push/deploy.

## User Scenarios & Testing

### User Story 1 — Tìm đơn và tài xế (Priority: P1)

Admin cần xem dữ liệu thật, lọc đơn theo trạng thái/mã chính xác và chuyển trang độc lập giữa danh sách đơn và tài xế.

**Why this priority**: Không thể phân công đúng bằng dữ liệu mẫu.

**Independent Test**: Các danh sách trả dữ liệu, rỗng hoặc lỗi đều có trạng thái rõ; không biến lỗi thành dữ liệu mẫu/rỗng giả.

**Acceptance Scenarios**:

1. **Given** Admin hợp lệ, **When** mở phân công, **Then** thấy đơn chờ gán và một trang tài xế, số lượng chỉ thuộc tập đang hiển thị.
2. **Given** danh sách còn trang sau, **When** chuyển trang, **Then** dùng cursor gốc, không giữ lựa chọn vô hình của trang cũ.
3. **Given** server chưa cung cấp danh sách, **When** tải thất bại, **Then** hiện lỗi và nút tải lại, không cho xác nhận dựa dữ liệu cũ.

### User Story 2 — Phân công có xác nhận (Priority: P1)

Admin chọn đơn/tài xế, xem chi tiết hiện hành rồi xác nhận thao tác bằng hành động riêng.

**Why this priority**: Đây là đầu ra chính TV3.

**Independent Test**: Một lần xác nhận gửi đúng một thao tác; chỉ hiển thị thành công sau phản hồi server hợp lệ.

**Acceptance Scenarios**:

1. **Given** đơn CREATED, **When** chọn tài xế và xác nhận, **Then** hiển thị trạng thái/tài xế server xác nhận.
2. **Given** đơn ASSIGNED chưa pickup, **When** chọn tài xế khác và xác nhận lại, **Then** thực hiện gán lại có chủ đích; không chặn tài xế chỉ vì đang có đơn khác.
3. **Given** đã gán cho cùng tài xế, **When** xem chi tiết, **Then** thông báo tài xế hiện hành, không cần gửi lại thao tác không đổi.
4. **Given** đơn đã pickup hoặc terminal, **When** xem, **Then** không cho phân công/gán lại.

### User Story 3 — Phục hồi khi xung đột/mất phản hồi (Priority: P1)

Admin phải biết khi chưa thể kết luận kết quả và xác minh lại trước khi ra quyết định mới.

**Independent Test**: Với timeout/network/response không hợp lệ hoặc lỗi server chưa chắc kết quả, chỉ đọc lại chi tiết; không tự gửi lại Assign.

**Acceptance Scenarios**:

1. **Given** xung đột, **When** server từ chối, **Then** báo dễ hiểu và tải lại trạng thái hiện tại trước xác nhận mới.
2. **Given** mất phản hồi, **When** đọc lại thành công, **Then** hiển thị tài xế/trạng thái mới, xóa lựa chọn cũ và yêu cầu xác nhận mới nếu còn muốn gán lại.
3. **Given** đọc lại thất bại, **Then** giữ khóa thao tác và cung cấp nút chỉ đọc lại; không hiển thị thành công hoặc cho gửi lại mù.

### Edge Cases

Thiếu/hết phiên, sai quyền, thiếu liên kết tài khoản, tài nguyên mất, dữ liệu trả sai schema, chuyển route khi đang tải, phản hồi cũ đến sau lựa chọn mới, bấm lặp, cursor không còn hợp lệ, tên/địa chỉ dài, tài xế không có GPS, tài xế đang có nhiều đơn.

## Requirements

### Functional Requirements

- **FR-001**: Chỉ Admin được vào các màn hình này; tái sử dụng kiểm tra phiên/role hiện có, không giả lập quyền.
- **FR-002**: Hiển thị danh sách đơn thật, bộ lọc trạng thái/mã chính xác, chi tiết đơn và phân trang; không nhận dữ liệu response sai hợp đồng.
- **FR-003**: Hiển thị danh sách tài xế phân trang với định danh/tên/số đơn active; không tự tạo onlineFlag, điện thoại, phương tiện hoặc total chưa có.
- **FR-004**: Chọn đơn rồi đọc chi tiết hiện hành; chỉ CREATED/ASSIGNED cho gán; xác nhận riêng ghi rõ đơn, tài xế hiện hành nếu có và tài xế đích.
- **FR-005**: Mỗi lần xác nhận gửi tối đa một thao tác; khóa lựa chọn khi đang gửi, chỉ nhận thành công sau phản hồi hợp lệ và hiển thị dữ liệu server trả.
- **FR-006**: Xung đột hoặc kết quả chưa xác định phải đọc lại chi tiết; khóa ghi cho đến khi đọc thành công và người dùng chọn/xác nhận lại. Không tự retry ghi.
- **FR-007**: Loading/empty/error/retry rõ ràng; có thông báo hỗ trợ screen reader, label/focus/bàn phím và không tràn ngang trang ở 375px/1440px.
- **FR-008**: Abort/cleanup đọc khi đổi route/query/selection; phản hồi cũ không thay dữ liệu mới; không lưu token/PII vào storage/log.
- **FR-009**: Giữ shell Admin, chỉ gắn nhãn demo ở trang còn demo; không gọi trang vừa nối API là dữ liệu mẫu hoặc tuyên bố trang demo là thật.
- **FR-010**: Giữ nguyên AGENTS.md, công việc Customer/Driver/backend; ghi riêng bằng chứng mock, local, cloud và phụ thuộc còn mở.

### Key Entities

- Shipment: định danh, tracking number, trạng thái, địa chỉ, tài xế hiện hành; chi tiết có lịch sử.
- Driver: định danh nội bộ, tên, số đơn active, vị trí/timestamp có thể không có.
- Page: tập dữ liệu cùng cursor tiếp theo; không có total ngầm định.
- Assignment intent: cặp đơn/tài xế người dùng đã chọn và trạng thái chờ xác nhận/gửi/đọc lại; không bền sau reload.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Admin hoàn thành chọn đơn → chọn tài xế → xác nhận; thấy đúng trạng thái và tài xế từ kết quả trả về.
- **SC-002**: Mỗi lần xác nhận có tối đa một lần gửi, kể cả bấm lặp; mọi ca mất phản hồi/xung đột không tự phát sinh lần gửi thứ hai.
- **SC-003**: Các ca rỗng/lỗi/thiếu quyền/đang tải/dữ liệu sai có kết quả nhìn thấy và đường phục hồi, không có thành công giả.
- **SC-004**: Chuyển trang hai danh sách giữ đúng cursor và không làm lẫn lựa chọn; phản hồi cũ không ghi đè mới.
- **SC-005**: Thao tác được bằng bàn phím, ở 375px và 1440px không tràn ngang toàn trang; AGENTS.md không thay đổi.
- **SC-006**: Chỉ đóng nghiệm thu tích hợp khi có bằng chứng Admin phân công thật và Driver thấy đúng đơn trên bản backend tương ứng; mock không thay bằng chứng này.

## Assumptions and dependencies

- TV6 đã có danh sách tài xế và Auth. TV1 sở hữu danh sách/chi tiết/Assign và transaction; bản local đang kiểm tra mới có controller Shipment rỗng. Đây là dependency, không phải quyền làm thay TV1.
- Dùng thiết kế Admin hiện có, tiếng Việt và tông tím, không đổi framework/dependency.
- Tải từng trang theo yêu cầu, không tự polling/scan toàn bộ fleet. Live-map và quản lý tài khoản giữ ngoài phạm vi.

## Clarifications

### Session 2026-10-24

Không có mơ hồ quan trọng cần hỏi: phạm vi từ ảnh + FR02/UI03/VII.4; reassign/no-op và mất response do đặc tả giải quyết. Không thêm quyết định người dùng chưa chấp thuận. Toàn bộ nhóm kiểm tra scope/data/UX/security/dependency/error/terminology/completion rõ; chi tiết triển khai để plan. SC-006 là nghiệm thu ngoài môi trường local, không tự đánh dấu đạt.
