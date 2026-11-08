# Nguồn yêu cầu hiện hành — ParcelFlow

Người dùng chỉ định ngày 2026-10-18 rằng đặc tả dưới đây thay thế đặc tả cũ.
Tài liệu này là bản chỉ dẫn/truy vết, không phải nguồn yêu cầu mới do AI tạo.

## Nguồn chính thức

- [PF SPEC 01 — Google Docs](https://docs.google.com/document/d/1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8/edit).
- Phiên bản **nội dung 1.3**, ngày 11/10/2026; tên file vẫn là `ParcelFlow_v1.2`.
- I: quản lý nguồn/quyết định; II: BRD; III: FRD/AC; IV: NFR;
  V: System Design; VI: App Design/API/event/data/UI; VII: kế hoạch 10 tuần.
- Tab kế hoạch: [VII](https://docs.google.com/document/d/1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8/edit?tab=t.po4rmhqkefw).
  **VII.2 bảo toàn tuần 1; VII.3 mới triển khai tuần 2**. Kế hoạch không tạo nghiệp vụ ngoài I–VI.
- Source S4 trong tài liệu là `da5e7cdae3618dcfc4d200a9470f728d09338df5`;
  không mặc định workspace hoặc revision cloud đang ở SHA này.

## Cách sử dụng trong repo

1. Dùng nguồn trên để xác định yêu cầu; đối chiếu repo để biết đã triển khai gì.
2. frontend-*.md mô tả trách nhiệm/thiết kế/bàn giao frontend, không được mở rộng nguồn.
   docs/api-contract.md, docs/openapi.json và docs/auth-rbac.md trên nhánh cũ vẫn có
   phần draft/lịch sử; không dùng chúng để phủ định quyết định D01–D10 mới.
3. Yêu cầu, implementation, kết quả chạy local, cloud và bằng chứng lịch sử là các trạng thái riêng.
   Báo cáo nghiệm thu không tự trở thành yêu cầu hoặc bằng chứng mọi tính năng đã chạy thật.
4. Tuần 1 TV3: một React/Vite/TypeScript app, route stub Customer/Admin/Driver, Hosting.
   Admin gồm điều phối; không role DISPATCHER, không app Admin riêng.
5. Firebase login/Create/DB thật thuộc tuần 2; Assign tuần 3; vòng đời/persist GPS tuần 4;
   GPS tracking đầu-cuối tuần 5. Không đưa các phần đó vào gate scaffold tuần 1.

## Các điểm tích hợp đã được đặc tả mới xác định

| Chủ đề | Định nghĩa ở nguồn | Đầu mối phối hợp |
| --- | --- | --- |
| Wire mapping | D01, API00, SC01–08: trackingNumber/customerId/dropoff*, prefixed ULID, data/pagination | TV1 + TV3/4 |
| Create | API01: Idempotency-Key UUID v4, replay snapshot 201 trong window 24h; cùng key/payload không nhân đôi | TV1 + TV3 + TV6 |
| Auth | D09/AUTH01: custom claim role + business user linkage; không tự cấp role, USER_NOT_PROVISIONED 409 | TV6 + client + TV5 |
| Errors | D07/VI.3: ProblemDetails theo HTTP status/code, không parse message làm logic | TV1/6 + client |
| GPS | POST /v1/locations, broker-confirmed 202; timestamp UTC ms, first-write-wins; ACK sau commit | TV1/2/4/5 |
| Địa chỉ/tọa độ | UI01: nhập địa chỉ và chọn/nhập tọa độ; không tự thêm geocoding provider | TV3 + TV1 |
| Admin | UI03: điều phối/tra cứu theo trang; Accounts giữ scaffold, không CRUD/cấp quyền/KPI toàn cục mới | TV3 + TV6 |
| Cloud | Resource hiện có; runtime pull, CORS và cấu hình đo phân biệt thiết kế/quan sát | TV5 + TV2/6 |

Không nâng các bảng trên thành tuyên bố đã triển khai. Các nguyên tắc cũ cần thay đổi
thực sự phải xử lý bằng amendment riêng trước implementation, không tự tạo lại constitution.

## Hồ sơ tuần 1

- [Frontend chung](frontend-guide.md).
- [Kết quả tái nghiệm thu và phụ thuộc tuần 2](frontend-week1-handoff.md).
- Bằng chứng nhóm đã chốt: [#8](https://github.com/namnkahn1607/INT3326E/issues/8),
  [#9](https://github.com/namnkahn1607/INT3326E/issues/9),
  [#10](https://github.com/namnkahn1607/INT3326E/issues/10).
  Dùng lại Hello World; không yêu cầu tạo thêm checkpoint cloud hoặc chạy lại publish/pull.
