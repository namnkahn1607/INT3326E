# Danh sách tính năng và trạng thái

Mỗi dòng là một tiêu chí nghiệm thu (AC) của đặc tả v1.4. Chỉ đổi trạng thái khi lệnh kiểm tra đã chạy đạt trong đúng môi trường ghi ở cột đó. Cập nhật file này trong cùng PR với thay đổi code.

Trạng thái: `chưa có` · `đang làm` · `local` (đạt trên máy, PostgreSQL thật hoặc mock như ghi chú) · `cloud` (đạt trên môi trường Cloud, kèm revision).

Cập nhật: 14/11/2026, `develop` tại `c2bddbc`.

| AC | Hành vi | API / thành phần | Kiểm tra bằng | Trạng thái |
| --- | --- | --- | --- | --- |
| AC01 | Customer tạo đơn, chống tạo trùng bằng `Idempotency-Key`, ghi đơn, lịch sử và thông báo trong một transaction | API01, DATA02 | `apps/api/src/modules/shipments/shipments.postgres.spec.ts` | local |
| AC02 | Admin gán và gán lại tài xế trước khi lấy hàng; khóa dòng chống gán cạnh tranh | API04, API11 | `apps/api/src/modules/assignments/assignments.postgres.spec.ts` | local |
| AC03 | Tài xế được gán lấy hàng rồi giao hàng; gọi lặp không ghi thêm; sai người hoặc sai bước bị chặn | API05, API06 | `assignments.postgres.spec.ts`, `apps/api/src/qa/week7-flow.postgres.spec.ts` | local |
| AC04 | Driver gửi GPS; Worker ghi lịch sử và vị trí hiện tại, mẫu đầu tiên thắng, không lùi vị trí, ACK sau commit | API08, EVT01, DATA04, DATA05 | `apps/worker/src/storage/gps-writer.postgres.spec.ts`, `apps/worker/src/qa/week8-gps-duplicate-order.postgres.spec.ts` | local (Cloud chưa xác nhận) |
| AC05 | Customer chủ đơn xem vị trí tài xế gần real-time, ẩn hoặc hiện theo trạng thái, nhãn vị trí cũ | API09, UI01 | Chưa có test API; web: `apps/web/src/api/endpoints/tracking.spec.ts` (mock) | chưa có (API09 thiếu) |
| AC06 | Lịch sử trạng thái đúng thứ tự, đúng người thực hiện, đúng phạm vi quyền | API02, API03 | `apps/api/src/qa/week7-flow.postgres.spec.ts` (TC06.1) | local |
| AC07 | Báo giao thất bại sau khi lấy hàng; phát hiện giao trễ | API07 | Chưa có | chưa có (việc tuần 9) |
| AC08 | Thông báo tạo cùng lúc đổi trạng thái; người dùng chỉ đọc thông báo của mình | API10, DATA06 | `apps/api/src/modules/notifications/notifications.postgres.spec.ts` | local |
| AC09 | ETA Haversine 20 km/h khi đơn đang giao và vị trí còn mới; không sửa hạn giao | ETA01, API09 | Hàm ETA trong `packages/types`; chưa trả qua API | chưa có (cần API09) |
| AC10 | Phân quyền 3 role; sai quyền 403, chưa liên kết user 409, không token 401 | AUTH01 | `apps/api/src/modules/auth/**`, `apps/api/src/qa/week7-flow.postgres.spec.ts` (TC10.x) | local |

Kết quả từng tuần và bằng chứng Cloud ghi ở [điều phối theo tuần](coordination/README.md).
