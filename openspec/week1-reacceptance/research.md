# Research: Nguồn và ranh giới nghiệm thu

## Quyết định nguồn

- **Decision**: Dùng PF SPEC 01 nội dung v1.3 ngày 11/10/2026, doc ID
  `1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8`; tab I–VI là yêu cầu/thiết kế,
  VII.2 là baseline tuần 1. Đọc ngày 2026-10-18, revision
  `AHj4eMRnevvFXb7B5yHAFnTLJbj9Nyez7I8TW88SQooQKBJLSubuV_3-ZcwdHRbWAI68wA696juwXdd0MzZla4kdSoqa256_mS57hV6X8w`.
- **Rationale**: Người dùng chỉ định tài liệu thay thế nguồn cũ. Tên file v1.2 không thay phiên bản nội dung.
- **Alternatives**: Không dùng bảng tiến độ cũ hoặc checkbox/báo cáo AI như nguồn yêu cầu chính thức.

## Tái sử dụng và source

- **Decision**: Giữ `apps/web` và bộ frontend-*.md; thêm folder audit canonical để công cụ
  Spec Kit đọc spec/plan/tasks đúng định dạng, không nhân đôi spec nghiệp vụ.
- **Rationale**: Bộ cũ có yêu cầu rộng hơn tuần 1 và path `frontend/pages` đã lỗi thời;
  tái nghiệm thu là scope riêng, không chạy lại scaffold hoặc ghi đè toàn bộ tài liệu cũ.
- **Alternatives**: Không tạo frontend thứ hai, đổi tên app hoặc sửa script Spec Kit.
- **Source**: Local `360a24bdfbaa7286cd49f6f7736b7c90daef29ef`; S4 `da5e7cd` và remote-tracking
  develop `d38c598` không được đồng nhất. Không tự merge/refactor để nghiệm thu lịch sử tuần 1.

## Các điểm đã chốt cho tuần sau, không triển khai trong audit

- D01/API00/SC01–08: JSON `trackingNumber`, `customerId`, `dropoff*`, prefixed ULID,
  list `data/pagination`; dùng mapper rõ từ UI/storage draft, không ép kiểu che lệch contract.
- D09/AUTH01: custom claim `role`; liên kết Firebase UID với user nghiệp vụ;
  không role picker production hoặc tự cấp claim; thiếu linkage là 409 USER_NOT_PROVISIONED.
- D07: ProblemDetails là contract tích hợp, không ghi đè hành vi scaffold tuần 1 trong audit.
- D02/D08: GPS timestamp UTC mili giây, canonical first-write-wins; seq/session chỉ diagnostic;
  history/current transaction và ACK sau commit là việc các tuần sau, không phải stub hiện tại.
- UI01/VII.3: Customer nhập địa chỉ và chọn/nhập tọa độ; không tự thêm geocoding provider.
  Issue #3/Constitution IV cũ mô tả geocoding client. Không dùng lời hứa geocoding tự động của
  mock UI làm requirement mới; đánh giá tương thích nguyên tắc/provider trước triển khai tuần 2,
  không tự đổi constitution trong lần audit này.
- UI03: Account page giữ scaffold; không CRUD/cấp quyền, KPI toàn hệ thống hoặc onlineFlag mới.

## Bằng chứng cloud

- **Decision**: GET public health đúng URL ở issue #9; dùng lại Hello World tại issue #8,
  không publish/pull lại. Ghi kết quả thực tế và nguồn lịch sử riêng trong acceptance.md.
- **Rationale**: Issue #9 đã thay bảng 404/trang mẫu cũ bằng health JSON ngày 11/10;
  đường `/healthz/` có slash cuối cần kiểm tra riêng. Thiết kế không phải trạng thái runtime.
- **Alternatives**: Không deploy, sửa IAM, bật SQL hoặc tạo topic để làm đẹp kết quả audit.
- Resource/budget được đối chiếu từ nguồn S5/issue và ghi owner; không giả là đã đọc lại cấu hình
  GCP có quyền xác thực. Research metadata cloud được kiểm tra chỉ đọc ở bước plan/implement.

Đối chiếu chỉ đọc hoàn tất: issue #8/#9/#10 closed/completed ngày 11/10/2026, giữ checkpoint
source `da5e7cd`. Public API/Worker `/healthz/` đều 200 đúng JSON ngày 18/10; không slash
đều 404 Google HTML. Không suy ra revision/cloud SHA từ response này. Tên resource/budget
và Hello World dùng lại evidence issue, không publish/pull, không đọc Console hoặc deploy.
