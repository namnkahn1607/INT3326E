# Tài liệu ParcelFlow

Đọc [nguồn yêu cầu hiện hành](contracts/spec-baseline.md) trước. Đặc tả PF SPEC 01 định nghĩa sản phẩm đích; code xác định phần đã triển khai. Báo cáo cũ ghi kết quả tại một thời điểm: khi gặp "chưa triển khai" hay số test trong đó, đối chiếu ngày và SHA, đừng suy ra trạng thái hiện tại. Trạng thái hiện tại nằm ở [danh sách tính năng](features.md).

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| [`contracts/`](contracts/) | Hợp đồng dùng chung, đổi phải báo cả nhóm |
| [`features/`](features/) | Tài liệu từng tính năng: `X.md` là phạm vi và thiết kế, `X-handoff.md` là bàn giao và kết quả kiểm tra |
| [`coordination/`](coordination/README.md) | Điều phối nhóm theo tuần |
| [`qa/`](qa/) | Kế hoạch kiểm thử |
| [`history/`](history/) | Báo cáo đã qua (merge, nghiệm thu cũ), chỉ để tra lại |
| [`evidence/`](evidence/) | Ảnh và log làm bằng chứng |
| [`agents/`](agents/) | Quy trình cho agent (Spec Kit) |
| [`tv6/`](tv6/tv6-weekly.md) | Ghi chép riêng của TV6 |

## Hợp đồng

| Tài liệu | Nội dung |
| --- | --- |
| [Nguồn yêu cầu](contracts/spec-baseline.md) | Phiên bản, thứ tự ưu tiên, kế hoạch theo tuần |
| [API contract](contracts/api-contract.md), [OpenAPI](openapi.json) | Method, path, request, response; handler đã có và draft |
| [Auth/RBAC](contracts/auth-rbac.md) | Firebase, role, liên kết user nghiệp vụ, quyền |
| [GPS event](contracts/gps-event-contract.md) | Payload, timestamp, định danh, quy tắc xử lý |

`openapi.json` nằm ở gốc `docs/` vì test đọc file theo đường dẫn này.

## Tính năng

| Tính năng | Thiết kế | Bàn giao |
| --- | --- | --- |
| Khung API | [api-scaffold](features/api-scaffold.md) | |
| Frontend chung | [frontend-guide](features/frontend-guide.md) | [frontend-config-handoff](features/frontend-config-handoff.md) |
| Tạo đơn | [create-shipment](features/create-shipment.md) | [create-shipment-handoff](features/create-shipment-handoff.md) |
| Customer | [customer-frontend](features/customer-frontend.md) | [customer-frontend-handoff](features/customer-frontend-handoff.md) |
| Admin phân công | [admin-assignment](features/admin-assignment.md) | [admin-assignment-handoff](features/admin-assignment-handoff.md) |
| Admin directory | [admin-directory](features/admin-directory.md) | [tv6/admin-directory-handoff](tv6/admin-directory-handoff.md) |
| Vòng đời đơn | [shipment-lifecycle](features/shipment-lifecycle.md) | [shipment-lifecycle-handoff](features/shipment-lifecycle-handoff.md) |
| Lấy hàng, giao hàng | [shipment-pickup-deliver/](features/shipment-pickup-deliver/spec.md) | [shipment-pickup-deliver-handoff](features/shipment-pickup-deliver-handoff.md) |
| Driver và GPS | [driver-dashboard-gps](features/driver-dashboard-gps.md), [driver-gps/](features/driver-gps/spec.md) | [driver-shipments-handoff](features/driver-shipments-handoff.md) |
| Tracking | [live-tracking](features/live-tracking.md) | [live-tracking-handoff](features/live-tracking-handoff.md) |
| Auth | [contracts/auth-rbac](contracts/auth-rbac.md) | [tv6/auth-rbac-handoff](tv6/auth-rbac-handoff.md) |

## Kiểm thử

- [QA test plan](qa/test-plan.md): ca kiểm thử và kết quả mong đợi, không phải kết quả đã chạy.
- [Danh sách tính năng](features.md): trạng thái từng AC và test tương ứng.

## Lịch sử

| Tài liệu | Thời điểm |
| --- | --- |
| [Frontend tuần 1](history/frontend-week1.md) | Tái nghiệm thu 18/10/2026 |
| [GPS pipeline validation](history/gps-pipeline-validation.md) | Pub/Sub, 16/10/2026 |
| [Sửa lỗi merge GPS](history/gps-merge-fix.md) | Snapshot 20/10/2026 |
| [Merge nhánh GPS](history/gps-branch-merge.md) | 02/11/2026 |
| [API gán tài xế tuần 6](history/assignment-api-week6.md) | Tuần 6 |
