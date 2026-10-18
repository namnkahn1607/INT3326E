# Feature Specification: Nghiệm thu lại frontend tuần 1

**Feature Branch**: `feature/frontend` (giữ nguyên nhánh hiện có)
**Created**: 2026-10-18
**Status**: Accepted cho TV3 tuần 1 — kết quả và giới hạn tại [acceptance.md](acceptance.md)
**Input**: Nghiệm thu lại công việc TV3 tuần 1 theo đặc tả chuẩn mới trước khi triển khai tuần 2.

## Nguồn và phạm vi

Nguồn yêu cầu chính thức là [PF SPEC 01, nội dung phiên bản 1.3 ngày 11/10/2026](https://docs.google.com/document/d/1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8/edit).
Tên file Google Docs vẫn là `ParcelFlow_v1.2`; phiên bản nội dung có ưu tiên.
Phần I–VI định nghĩa sản phẩm đích; VII.2 bảo toàn tuần 1; VII.3 là đầu vào tuần 2,
không phải điều kiện nghiệm thu tuần 1. Snapshot S4 của tài liệu là `da5e7cd`;
source đang kiểm tra được ghi riêng trong báo cáo, không mặc định trùng S4 hoặc cloud.

Đây là hồ sơ **tái nghiệm thu**, không phải frontend mới hoặc bản sao đặc tả sản phẩm.
Tái sử dụng [frontend-spec.md](../frontend-spec.md), [frontend-design.md](../frontend-design.md),
[frontend-tasks.md](../frontend-tasks.md) và [driver-gps-emitter-draft.md](../driver-gps-emitter-draft.md).
Các mã FR-/SC- có dấu gạch nối dưới đây chỉ thuộc hồ sơ nghiệm thu này, không thay FR01–FR10 của nguồn.

## Clarifications

### Session 2026-10-18

Không có câu hỏi cần quyết định thêm cho phạm vi tuần 1. Nguồn VII.2 xác định rõ
stub/Hosting và giữ Hello World; VII.3/VII.6 tách Auth/Create và tracking sang các tuần sau.
Tên file/version, SHA local/S4/cloud và kết quả lịch sử/hiện tại được ghi riêng.
Coverage clarify: scope, actor, domain baseline, UX, chất lượng, phụ thuộc, edge case,
thuật ngữ và tín hiệu hoàn thành đều rõ trong phạm vi audit. Không tuyên bố các quyết
định tuần 2 đã có implementation; xem research.md về các khác biệt tài liệu cũ.

## User Scenarios & Testing

### User Story 1 — Truy cập ba cổng dùng chung (Priority: P1)

Người nghiệm thu mở được các cổng Customer, Admin và Driver trên bản công khai,
để xác nhận nền tảng frontend của TV3 đã sẵn sàng bàn giao.

**Why this priority**: Đây là đầu ra tuần 1 của TV3 tại VII.2.
**Independent Test**: Truy cập trực tiếp, tải lại và điều hướng giữa ba cổng; kiểm tra cùng bản phát hành.

**Acceptance Scenarios**:

1. **Given** URL công khai, **When** mở trực tiếp từng cổng và tải lại,
   **Then** hiện đúng trang tạm, không có trang lỗi tài nguyên hay lỗi thực thi.
2. **Given** cổng Admin, **When** xem điều phối và danh sách tài xế,
   **Then** vẫn dùng cùng app và vai trò Admin, không tạo vai trò điều phối riêng.
3. **Given** giao diện mẫu, **When** xem dữ liệu hoặc thao tác mẫu,
   **Then** người nghiệm thu không coi đây là bằng chứng đăng nhập hoặc lưu đơn thật.

### User Story 2 — Bàn giao emitter mẫu cho TV4 (Priority: P2)

TV3/TV4 xác nhận emitter đã ghép vào cổng Driver, có thể bắt đầu/dừng và không bị
hiểu nhầm thành pipeline vị trí thật.

**Why this priority**: Giữ đầu ra phối hợp đã có; VII.2 chưa yêu cầu gửi GPS thật.
**Independent Test**: Bắt đầu, quan sát ít nhất hai mẫu, dừng, khởi động lại và rời trang.

**Acceptance Scenarios**:

1. **Given** chưa bắt đầu, **When** mở cổng Driver, **Then** số mẫu bằng 0 và đang dừng.
2. **Given** đang phát mẫu, **When** chờ các chu kỳ đã có hoặc bấm lại nút bắt đầu,
   **Then** chỉ có một lịch phát, timestamp tiến lên và có nhãn mô phỏng.
3. **Given** đang phát, **When** dừng hoặc rời trang, **Then** không còn phát thêm mẫu.
4. **Given** emitter tuần 1, **When** quan sát hoạt động,
   **Then** không xin quyền định vị hoặc gửi mẫu tới máy chủ.

### User Story 3 — Phân biệt nghiệm thu và việc tuần sau (Priority: P2)

Nhóm nhận được kết luận truy vết tới nguồn, mã nguồn và kiểm tra thực tế, không lấy
checklist cũ hoặc báo cáo AI làm bằng chứng tự động hoàn thành cả dự án.

**Why this priority**: Phần I.7/VII phân biệt yêu cầu, thiết kế, kế hoạch và bằng chứng.
**Independent Test**: Đọc báo cáo có ngày, source, expected/actual và giới hạn từng hạng mục.

**Acceptance Scenarios**:

1. **Given** kiểm tra local thành công, **When** lập kết luận,
   **Then** ghi riêng kết quả cloud và không suy ra cloud từ local.
2. **Given** checkpoint chung của nhóm, **When** có bằng chứng cũ hoặc thiếu quyền đọc cloud,
   **Then** ghi rõ nguồn/ngày và phần chưa xác minh, không tự triển khai thay TV5.
3. **Given** tài liệu cũ lệch đặc tả mới, **When** bàn giao,
   **Then** ghi nguồn thay thế, ranh giới tuần 2 và việc phối hợp còn mở.

### Edge Cases

- HTTP 200 của trang mẫu, asset cũ hoặc sai payload health không chứng minh đúng scaffold.
- URL có và không có dấu `/` cuối được đối chiếu riêng nếu Cloud Run xử lý khác nhau.
- Cloud đổi bản phát hành sau lần kiểm tra cũ: chỉ kết luận trên dữ liệu quan sát lần này.
- Mất kết nối hoặc không có quyền đọc cấu hình cloud: ghi chưa kiểm chứng, không ghi đạt giả.
- Tài khoản demo trong giao diện không phải Firebase login; wrapper API không phải handler thật.
- Chưa có GPS thật, DB mutation, ETA hoặc notification không là lỗi thiếu việc tuần 1.

## Requirements

### Functional Requirements

- **FR-001**: Hồ sơ PHẢI ghi nguồn chính thức, phiên bản nội dung và phạm vi TV3 tuần 1 theo VII.2.
- **FR-002**: Ba cổng Customer/Admin/Driver PHẢI thuộc cùng frontend; Admin bao gồm điều phối.
- **FR-003**: Bản công khai PHẢI hỗ trợ mở trực tiếp và tải lại ba cổng; tài nguyên khớp bản đã kiểm tra.
- **FR-004**: Emitter hiện có PHẢI giữ hành vi mẫu, bắt đầu/dừng/cleanup, không phát request GPS thật trong tuần 1.
- **FR-005**: PHẢI bảo toàn code và công việc tuần 1; không triển khai Auth/Create/tracking thật,
  tạo lại resource, đổi role hoặc xóa các trang scaffold để phục vụ lần nghiệm thu này.
- **FR-006**: Các cổng PHẢI được kiểm tra khả năng đọc/thao tác ở desktop và mobile cùng bàn phím
  theo Constitution V; đây là kiểm tra giao diện hiện có, không phải yêu cầu thiết kế lại UI.
- **FR-007**: Báo cáo PHẢI tách đạt/chưa đạt/chưa kiểm chứng, local/cloud và TV3/checkpoint chung;
  health không chứng minh nghiệp vụ, Hello World đã đạt được dùng lại thay vì publish lại.
- **FR-008**: Tài liệu bàn giao PHẢI ưu tiên nguồn mới, bỏ tham chiếu GPS `/location` cũ
  khỏi chỉ dẫn tích hợp và ghi rõ các phụ thuộc tuần 2; không coi báo cáo này là yêu cầu sản phẩm mới.

### Key Entities

- **Evidence record**: Hạng mục, nguồn yêu cầu, môi trường, source/version, ngày,
  expected/actual, kết luận và giới hạn; không chứa token hoặc dữ liệu cá nhân thật.
- **Milestone boundary**: Tuần, thành viên chịu trách nhiệm, đầu ra và phụ thuộc;
  không tạo entity mới trong runtime/database.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Cả ba cổng đạt kiểm tra mở trực tiếp và tải lại trên cùng bản công khai.
- **SC-002**: Emitter đạt bắt đầu, phát ít nhất hai mẫu, dừng, khởi động lại và rời trang;
  không phát sinh yêu cầu gửi GPS hoặc yêu cầu quyền vị trí.
- **SC-003**: Mỗi FR có ít nhất một kết quả kiểm tra hoặc mục chưa kiểm chứng kèm nguyên nhân/owner.
- **SC-004**: Không còn chỉ dẫn tài liệu đang áp dụng yêu cầu thực hiện nghiệp vụ tuần 2–5 để đạt tuần 1.
- **SC-005**: Có danh sách phụ thuộc tuần 2 theo nguồn mới, nhưng chưa thực thi nhiệm vụ tuần 2.

## Assumptions

- Nghiệm thu chính là TV3; kiểm tra API/Worker/cloud chung là đối chiếu chỉ đọc, không nhận thay việc TV1/2/5/6.
- Dùng resource/Hosting hiện có, không commit/push/deploy hay sửa Google Doc nếu chưa được yêu cầu riêng.
- Ba role và năm trạng thái giữ nguyên. Các màn hình đã có ngoài đầu ra tối thiểu là scaffold, không tự mở rộng nghiệp vụ.
- Không tái tạo constitution. Các khác biệt nguyên tắc có ảnh hưởng tuần 2 được ghi trong research trước khi triển khai tuần đó.
