# Feature Specification: Create Shipment

**Development context**: Nhánh thử nghiệm tạo đơn.
**Created**: 2026-10-24
**Status**: Implemented locally; shared database and deployed end-to-end acceptance pending
**Input**: Triển khai backend tạo đơn theo đặc tả trên nhánh test, bằng Spec Kit.

## Source and scope

Nguồn chính thức: [PF SPEC 01 nội dung v1.3](https://docs.google.com/document/d/1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8/edit), đọc 2026-10-24: FR01/AC01, API00/01, SC02, DATA01/02/03/06/07, TC01.1–6. `docs/spec-baseline.md` chỉ dẫn nguồn; báo cáo AI không phải yêu cầu mới.
Chỉ hoàn thiện nghiệp vụ tạo đơn; giữ Auth và Customer hiện có. Không triển khai List/Detail, Assign, GPS, inbox đọc, CRUD tài khoản, deploy hoặc migration/seed DB chung. TC01.6 kiểm tra snapshot sau thay đổi trạng thái bằng fixture, không tuyên bố API Detail đã hoạt động.

## User Scenarios & Testing

### User Story 1 - Customer tạo đơn hợp lệ (Priority: P1)

Customer đã xác thực và liên kết tài khoản gửi yêu cầu giao hàng, nhận mã theo dõi.
**Why this priority**: Thiếu nghiệp vụ này thì form Customer chưa thể lưu đơn.
**Independent Test**: Một lần tạo với dữ liệu hợp lệ tạo đúng một đơn, một sự kiện, một thông báo và một kết quả chống trùng.
**Acceptance Scenarios**:

1. **Given** Customer hợp lệ, **When** gửi địa chỉ/tọa độ/người nhận hợp lệ và key mới, **Then** nhận kết quả CREATED, chưa có driver, đủ field SC02.
2. **Given** token thiếu, sai role hoặc chưa liên kết, **When** tạo, **Then** bị từ chối đúng lỗi và không ghi đơn.

### User Story 2 - Thử lại an toàn (Priority: P1)

Customer mất kết quả có thể thử lại cùng ý định mà không bị tạo thêm đơn.
**Why this priority**: Mạng gián đoạn không được tạo nhiều yêu cầu giao hàng.
**Independent Test**: Gửi đồng thời cùng key/payload và đếm dữ liệu đã commit.
**Acceptance Scenarios**:

1. Cùng Customer, key và payload chuẩn hóa trong window mặc định 24 giờ trả nguyên kết quả tạo ban đầu, kể cả sau assign và deadline đã qua.
2. Cùng scope/key nhưng payload khác trả conflict, không đổi dữ liệu.
3. Khác Customer/key hoạt động độc lập; key hết hạn có thể tạo ý định mới, không hứa chống trùng vĩnh viễn.

### User Story 3 - Từ chối sai và khôi phục lỗi (Priority: P1)

**Why this priority**: Không lưu đơn thiếu history/thông báo hoặc báo thành công giả.
**Independent Test**: Gây lỗi ở từng bước ghi và kiểm tra toàn bộ transaction rollback.
**Acceptance Scenarios**:

1. Dữ liệu sai/key thiếu hoặc sai: lỗi validation có cấu trúc, không ghi dữ liệu.
2. Lỗi ghi thông báo/kết quả chống trùng: không còn bản ghi dở dang; retry sau phục hồi tạo được.
3. Lỗi DB: lỗi dependency an toàn, không lộ SQL/credentials và không trả thành công.

### Edge Cases

- Field ngoài contract (kể cả customerId/role/status/driverId), query không được hỗ trợ, tọa độ lồng field lạ, null/sai kiểu, NaN/Infinity, string số.
- Trim trước kiểm tra chiều dài/hash; trường tùy chọn thiếu chuẩn hóa null; timestamp có timezone chuẩn UTC ms, cắt phần nhỏ hơn ms; ngày không tồn tại bị từ chối.
- Deadline đúng hiện tại hoặc quá khứ bị từ chối với lần tạo mới; replay hợp lệ phải được xét trước điều kiện động này.
- Tracking collision phải sinh lại có giới hạn và không nhân đôi event/thông báo; lỗi commit/mất response không được retry tự động tạo mới.

## Requirements

### Functional Requirements

- **FR-001**: Chỉ CUSTOMER với token và business identity hợp lệ được tạo; actor lấy từ backend, không body (D09).
- **FR-002**: Validate địa chỉ trim 5–255, tên trim 2–100, phone dấu cộng tùy chọn + 9–15 chữ số, finite lat[-90,90]/lng[-180,180]; notes/packageDescription tối đa 500, weight hữu hạn >0, deadline tùy chọn có timezone và tương lai khi tạo mới (API01).
- **FR-003**: Từ chối field ngoài hợp đồng và key không hợp lệ; key UUID v4; lỗi 400/401/403/409/503/500 theo D07, không lộ nội bộ.
- **FR-004**: Sinh sh_ULID và tracking PFYYYYMMDD + 6 Base32 unique; trả đủ field SC02 và UTC ms, driver/failure/proof null; isLate null khi không deadline, false khi mới tạo với deadline tương lai.
- **FR-005**: Một commit chứa shipment CREATED, event CREATED actor CUSTOMER/fromStatus null, notification owner, idempotency snapshot 201; bất kỳ lỗi nào phải rollback tất cả (DATA02/03/06/07).
- **FR-006**: Scope chống trùng actor/operation/key, hash chuẩn hóa ổn định; serialize request cạnh tranh; replay nguyên 201 snapshot trước dynamic validation; khác payload 409; TTL cấu hình mặc định 24h, xử lý expiry an toàn trong repository.
- **FR-007**: Schema/mapping rõ trackingNumber→trackingCode, customerId→senderId, dropoff→delivery; định danh usr_/sh_ ULID thống nhất; không migration tự động khi startup.
- **FR-008**: Giữ nguyên Auth, frontend, AGENTS.md và phần thành viên khác; tách kiểm chứng mock/local SQL/cloud, không tuyên bố cloud hoàn tất nếu chưa kiểm tra.

### Key Entities

- Business user: identity Firebase đã provision, usr_ULID và role CUSTOMER.
- Shipment: sh_ULID, tracking unique, nội dung giao nhận, owner và timestamps hệ thống.
- Status event: UUID bất biến, CREATED, actor và thời điểm server.
- Notification: UUID, customer/shipment/event liên kết; unique customer/event, nội dung tối thiểu không chép phone/địa chỉ.
- Idempotency record: actor/operation/UUID key, hash, snapshot status/body, createdAt/expiresAt.

## Success Criteria

### Measurable Outcomes

- **SC-001**: TC01.1–6 có bằng chứng tương ứng; một ý định tạo trong window luôn chỉ có một bộ đơn/event/thông báo đã commit.
- **SC-002**: Toàn bộ case dữ liệu sai/quyền sai và lỗi ghi không để lại dữ liệu dở dang hoặc báo thành công giả.
- **SC-003**: Form Customer hiện hữu đọc được kết quả tạo mà không đổi tên field, endpoint hay hardcode role.
- **SC-004**: Regression Auth/API/FE liên quan đạt; p95 Create <500ms là mục tiêu NF03 cần đo riêng, không suy ra từ unit test.

## Assumptions

- Triển khai backend tạo đơn trên nhánh test; nhánh giữ bản FE đang có (HEAD gốc 915e5ed, đã tích hợp develop tại a2c245f), không rewrite/merge develop mới tự động.
- Business users được owner provision; không tạo tài khoản thật, không thay IAM hoặc cloud.
- Dùng UTC cho ngày tracking để thống nhất thời gian backend; alphabet Crockford Base32 như ULID. Chi tiết kỹ thuật, không đổi wire format.
- Schema hiện có là draft; baseline mới chỉ cho schema trống trong DB test, tích hợp DB chung cần TV1/TV6 review hiện trạng trước khi áp.
