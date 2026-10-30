# Tài liệu ParcelFlow

Đọc [nguồn yêu cầu hiện hành](spec-baseline.md) trước. PF SPEC 01 nội dung v1.3
định nghĩa sản phẩm đích; code xác định phần đã triển khai. Báo cáo ghi kết quả
tại một thời điểm, không thay thế đặc tả hoặc nghiệm thu môi trường đang chạy.

## Đặc tả và hợp đồng dùng chung

| Tài liệu | Nội dung |
| --- | --- |
| [Nguồn yêu cầu](spec-baseline.md) | Phiên bản, thứ tự ưu tiên và kế hoạch theo tuần |
| [API contract](api-contract.md), [OpenAPI](openapi.json) | Method/path, request/response; phân biệt handler đã có và draft |
| [Auth/RBAC](auth-rbac.md) | Firebase, role, business linkage và quyền |
| [GPS event](gps-event-contract.md) | Payload, timestamp, định danh và quy tắc xử lý |
| [Frontend chung](frontend-guide.md) | Một app, routing và ranh giới Customer/Admin/Driver |
| [Customer frontend](customer-frontend.md) | Đăng nhập, tạo đơn, danh sách/chi tiết và chọn địa chỉ |
| [Admin phân công](admin-assignment.md) | Chọn đơn/tài xế, xác nhận và xử lý kết quả chưa rõ |
| [Vòng đời Customer/Admin](shipment-lifecycle.md) | Trạng thái, lịch sử cơ bản và báo thất bại sau pickup |
| [Tracking Customer/Admin](live-tracking.md) | Polling, GPS mới/cũ/thiếu và bản đồ tài xế theo trang |
| [Tạo đơn](create-shipment.md) | Phạm vi API01, chống trùng và transaction |
| [Admin directory](tv6-admin-directory.md) | Danh sách tài xế/khách hàng và điều kiện SQL |

## Chạy, kiểm tra và bàn giao

| Tài liệu | Phạm vi / thời điểm |
| --- | --- |
| [API scaffold](api-scaffold.md) | Hướng dẫn khởi động/container; phần runtime tuần 1 là lịch sử |
| [Hosting/Auth handoff](tv6-deploy-handoff.md) | Cấu hình build frontend và điều kiện backend |
| [Driver dashboard/GPS](driver-dashboard-gps.md) | Client Driver; checkpoint tích hợp 26/10/2026 |
| [GPS validation](gps-pipeline-validation.md) | Cách kiểm thử và bằng chứng Pub/Sub ngày 16/10/2026 |
| [GPS merge handoff](gps-merge-fix-handoff.md) | Báo cáo lỗi tại snapshot 20/10/2026; không phải danh sách lỗi hiện tại |
| [QA test plan](qa-test-plan.md) | Expected results; không phải kết quả đã chạy |
| [Frontend tuần 1](frontend-week1-handoff.md) | Bằng chứng tái nghiệm thu 18/10/2026 |
| [Customer tuần 2](customer-frontend-handoff.md) | Bằng chứng frontend tại các checkpoint ghi trong báo cáo |
| [Admin tuần 3](admin-assignment-handoff.md) | Kiểm chứng frontend; cập nhật sau merge 30/10/2026 |
| [Vòng đời tuần 4](shipment-lifecycle-handoff.md) | Frontend Customer/Admin; giới hạn tích hợp backend |
| [Tracking tuần 5](live-tracking-handoff.md) | Frontend, readiness Driver/API/Worker và phần Cloud chưa nghiệm thu |
| [Create handoff](create-shipment-handoff.md) | Kiểm chứng API/SQL local 24–25/10/2026 |

Các file hiện có được giữ nguyên phạm vi sở hữu. Khi đọc nhận định như
“chưa triển khai” hoặc số test/bundle trong báo cáo cũ, đối chiếu ngày, SHA và
giới hạn phép kiểm tra; không suy ra trạng thái deploy hiện tại. Đặc tả tính năng
không lặp lại toàn bộ Auth, GPS contract hoặc cấu hình triển khai đã có ở trên.
