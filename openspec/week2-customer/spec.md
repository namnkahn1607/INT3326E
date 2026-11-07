# Feature Specification: TV3 — Customer tuần 2

**Feature Branch**: `feature/tuan/week2-customer`
**Created**: 2026-10-18
**Status**: Frontend local/mock đã kiểm chứng; đang chờ nghiệm thu cloud
**Input**: Cài ba skill UI đã chọn và bắt đầu triển khai tuần 2.

## Nguồn và phạm vi

[PF SPEC 01 nội dung v1.3](../../docs/spec-baseline.md), VII.3,
VI.AUTH01/API00/API01–03/SC01–03/UI01, TC01.1/01.4/01.6 và AC10.
Đã đọc trực tiếp Google Docs ngày 2026-10-18, revision không đổi so với hồ sơ tuần 1.
[Roadmap](../frontend-tasks.md) giữ tổng quan; bộ này là lát cắt triển khai tuần 2,
không tạo lại đặc tả sản phẩm hoặc Auth riêng.

Chỉ Customer login → tạo đơn → xem danh sách/chi tiết; kiểm tra Admin đúng role
bằng Auth chung. Không đăng ký/cấp quyền, điều phối, GPS tracking, inbox, ETA,
dashboard toàn cục, migration, tài nguyên cloud hoặc deploy.

## User Scenarios & Testing

### User Story 1 — Đăng nhập đúng khu vực (Priority: P1)

Khách hàng dùng tài khoản được cấp để vào khu vực của mình, không chọn quyền.
**Why this priority**: Mọi thao tác đơn hàng phải có danh tính được xác nhận.
**Independent Test**: Customer vào Customer; khách và tài khoản sai quyền không vào được.
**Acceptance Scenarios**:
1. **Given** tài khoản hợp lệ, **When** đăng nhập, **Then** vào đúng khu vực role.
2. **Given** thiếu cấu hình/phiên lỗi/sai quyền, **When** truy cập, **Then** phản hồi
   an toàn, không dùng user demo hoặc tự nâng quyền.

### User Story 2 — Tạo đơn an toàn khi gửi lại (Priority: P1)

Customer nhập hai điểm, người nhận và thông tin bưu kiện để nhận mã vận đơn.
**Why this priority**: Đầu ra chính của TV3 tuần 2.
**Independent Test**: Một lần tạo hợp lệ có mã vận đơn server; lỗi không báo thành công.
**Acceptance Scenarios**:
1. **Given** dữ liệu hợp lệ, **When** xác nhận, **Then** chờ kết quả, chống gửi lặp,
   hiển thị mã server và liên kết chi tiết.
2. **Given** mất response/lỗi tạm thời, **When** gửi lại cùng ý định, **Then** giữ
   nguyên payload/key, không tự tạo ý định mới.
3. **Given** dữ liệu sai, **When** gửi, **Then** lỗi gắn field và giữ dữ liệu để sửa.
4. **Given** replay trả snapshot CREATED, **When** xem lại, **Then** đọc chi tiết
   hiện hành, không coi snapshot tạo là state mới nhất.

### User Story 3 — Xem đơn của mình (Priority: P2)

Customer xem danh sách có lọc/phân trang và mở chi tiết đơn vừa tạo.
**Why this priority**: Đối chiếu đơn thật thay cho dữ liệu mẫu.
**Independent Test**: Danh sách rỗng/lỗi/nhiều trang và tải thẳng chi tiết.
**Acceptance Scenarios**:
1. **Given** danh sách có dữ liệu, **When** lọc/chuyển trang, **Then** giữ scope,
   không trình bày kết quả query cũ như dữ liệu mới; không suy ra total toàn hệ thống.
2. **Given** đơn có quyền xem, **When** mở URL/refresh, **Then** hiển thị dữ liệu
   server; lỗi 403/404 không fallback mock.

### Edge Cases

Tọa độ trống/NaN/vượt range; địa chỉ trim quá ngắn/dài; điện thoại sai; hạn giao
đã qua; 400; 401/403; 409 key conflict/user chưa provision; 429/503; lỗi mạng,
timeout hoặc schema response sai; response cũ sau unmount/đổi user/query;
backend chưa có handler; replay sau khi deadline đã qua.

## Requirements

### Functional Requirements

- **FR-001**: Tái sử dụng Auth/role hiện có; không thêm role picker, user demo,
  lưu password/token riêng hoặc thay đổi nghiệp vụ Driver.
- **FR-002**: Form có địa chỉ/tọa độ lấy và giao nhập được bằng bàn phím, tên và
  điện thoại người nhận; notes/mô tả/cân nặng/hạn giao tùy chọn theo nguồn.
  Không nhận actor hoặc tự geocode; 0 hợp lệ, trống không đổi thành 0.
- **FR-003**: Tạo key ngẫu nhiên đúng contract cho mỗi ý định; khóa payload/key khi
  gửi và chặn double-submit. Mất response/timeout/5xx giữ key/payload; retry không
  validate lại deadline động. Sau thành công tạo đơn khác là ý định mới.
  Không tự retry mutation nền; quá window 24h phải đối chiếu, không gửi key cũ.
- **FR-004**: Chỉ báo thành công sau response hợp lệ và hiển thị trackingNumber
  server. Phân loại lỗi bằng HTTP status/code, không parse message. Validation
  gắn field; 401/403, 409 linkage và key conflict có hướng xử lý riêng.
- **FR-005**: Danh sách dùng server/envelope/cursor chuẩn, năm trạng thái,
  loading/empty/error/retry; không thống kê tổng toàn cục từ một trang.
- **FR-006**: Chi tiết lấy theo ID trên URL và server hiện hành; có hai điểm,
  người nhận, status/mã đơn; không GPS/ETA giả hoặc action nghiệp vụ mới.
- **FR-007**: Hủy request đọc/loại response cũ khi unmount, đổi query/user;
  không trộn các tài khoản. Hủy mutation không có nghĩa backend đã rollback.
- **FR-008**: Giữ tone tím/layout chung; body/input ≥16px, label nhìn thấy,
  lỗi có aria-describedby/alert và focus sau submit, bàn phím, control ≥44px.
  Không overflow trang ở 390/768/1280px; không thêm thư viện animation;
  reduced motion được tôn trọng, không animation cho thao tác thường xuyên.
- **FR-009**: Có test contract/client, validation/retry và UI; phân biệt mock,
  local/cloud; chưa nghiệm thu tuần 2 khi chưa có bằng chứng Auth/Create thật.
- **FR-010**: Theo prompt UI mới của người dùng, riêng Home Customer có nền trắng,
  cam ấm, Satoshi heading/Inter body, container 1200px, nav ngang/quick actions và
  promo + active shipment hai cột desktop, xếp dọc trên mobile. Search chuyển mã
  thực sang filter exact API02 đã có; active shipment từ API trong trang đã tải,
  không mẫu TRK782910/Tega hardcode hoặc state mới. Schedule/Locations/Profile
  không có nghiệp vụ trong MVP nên không tạo route/action mới. Không đổi màu
  các trang Customer khác hoặc Admin/Driver theo yêu cầu chỉ thiết kế Home này.

### Key Entities

- Shipment: ID, mã vận đơn, owner server, hai điểm, người nhận, bưu kiện, state và
  field nullable theo nguồn; không coi UI type cũ là wire schema.
- Create intent: key, payload chuẩn hóa bất biến và thời điểm gửi đầu.
- Shipment page: tập trong scope hiện hành và cursor opaque, không có total.

## Success Criteria

- **SC-001**: Ca khách/sai role không lộ màn hình bảo vệ; tài khoản hợp lệ đi
  đúng khu vực trong ma trận ba role hiện có.
- **SC-002**: Tạo thành công có mã và xem lại đơn; retry giữ ý định cũ, không báo
  thành công giả. Cloud cần bằng chứng một bản ghi đã commit.
- **SC-003**: Có kết quả cho biên/lỗi/empty/phân trang/refresh chi tiết/response cũ;
  không dùng mock làm bằng chứng persistence.
- **SC-004**: Màn hình thay đổi dùng được ở 390/768/1280px và bàn phím; không mất
  dữ liệu nhập do lỗi tạm thời hoặc token refresh cùng tài khoản.

## Assumptions và phụ thuộc

- TV1 cung cấp API01–03/schema, TV6 Auth/linkage/errors, TV5 SQL/CORS/runtime.
  Source `d38c598` có shipment controller/service rỗng: không làm backend thay TV1.
- Không cấp tài khoản/claim, migration/deploy. Cloud acceptance mở tới khi có
  cấu hình, tài khoản đã provision và handler chuẩn.
- Intent/draft ở RAM màn hình, không lưu PII localStorage; rời trang/reload mất
  draft. Kết quả chưa xác định nhắc không tạo đơn khác trước khi đối chiếu;
  retry trong cùng màn hình giữ key/payload, tối đa window 24h.
- UI01 cho phép nhập tọa độ, chưa cần map picker/provider. Constitution IV giữ
  ranh giới địa chỉ client; nguồn mới thay geocoding tự động cũ, không chọn provider
  hay thay nguyên tắc công nghệ/quyền truy cập.

## Clarifications

### Session 2026-10-18

Không có câu hỏi yêu cầu mới: nguồn chốt role, field, lỗi, retry và phạm vi.
Backend/cloud thiếu là phụ thuộc triển khai, không phải lý do phát minh API.

Prompt JSON UI bổ sung cùng ngày là nguồn trực tiếp của FR-010. Cam ở Home là
thay đổi thị giác người dùng vừa yêu cầu, ưu tiên hơn tone tím trước đó tại đây;
không tự mở rộng thành đổi theme toàn bộ ứng dụng hoặc đổi state machine.
