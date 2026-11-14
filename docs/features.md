# Danh sách tính năng và trạng thái

Mỗi dòng là một tiêu chí nghiệm thu (AC) của đặc tả v1.4. Chỉ đổi trạng thái khi lệnh kiểm tra đã chạy đạt trong đúng môi trường ghi ở cột đó. Cập nhật file này trong cùng PR với thay đổi code.

Trạng thái: `chưa có` · `đang làm` · `local` (đạt trên máy, PostgreSQL thật hoặc mock như ghi chú) · `cloud` (đạt trên môi trường Cloud, kèm revision).

Cập nhật: 15/11/2026, nhánh `feature/gps-emitter-reliability` từ `develop@f28365d`, chưa merge.
Kiểm tra toàn repo: `npm run check` đạt (web 584, API 454, Worker/shared 122,
health e2e 2); 116 ca PostgreSQL/Firebase emulator bỏ qua do thiếu cấu hình.

| AC | Hành vi | API / thành phần | Lệnh kiểm tra | Trạng thái |
| --- | --- | --- | --- | --- |
| AC01 | Customer tạo đơn, chống tạo trùng bằng `Idempotency-Key`, ghi đơn, lịch sử và thông báo trong một transaction | API01, DATA02 | `npm test --workspace=@parcelflow/api -- shipments.postgres` | local |
| AC02 | Admin gán và gán lại tài xế trước khi lấy hàng; khóa dòng chống gán cạnh tranh | API04, API11 | `npm test --workspace=@parcelflow/api -- assignments.postgres` | local |
| AC03 | Tài xế được gán lấy hàng rồi giao hàng; gọi lặp không ghi thêm; sai người hoặc sai bước bị chặn | API05, API06 | `npm test --workspace=@parcelflow/api -- assignments.postgres shipment-flow` | local |
| AC04 | Driver gửi GPS; Worker ghi lịch sử và vị trí hiện tại, mẫu đầu tiên thắng, không lùi vị trí, ACK sau commit | API08, EVT01, DATA04, DATA05 | `npm test -- gps-writer gps-duplicate-order` (cần `WORKER_TEST_DATABASE_URL`, thiếu thì bị bỏ qua) | local (Cloud chưa xác nhận) |
| AC05 | Customer chủ đơn xem vị trí tài xế gần real-time, ẩn hoặc hiện theo trạng thái, nhãn vị trí cũ | API09, UI01 | `npm test --workspace=@parcelflow/api -- assignments.postgres`, `npm run test:integration --workspace=@parcelflow/web`; web UI mock: `npm test --workspace=@parcelflow/web -- tracking` | local (API09 Nest/PGlite, bản đồ UI mock; Cloud chưa xác nhận) |
| AC06 | Lịch sử trạng thái đúng thứ tự, đúng người thực hiện, đúng phạm vi quyền | API02, API03 | `npm test --workspace=@parcelflow/api -- shipment-flow` (TC06.1) | local |
| AC07 | Báo giao thất bại sau khi lấy hàng; phát hiện giao trễ | API07 | Chưa có | chưa có (việc tuần 9) |
| AC08 | Thông báo tạo cùng lúc đổi trạng thái; người dùng chỉ đọc thông báo của mình | API10, DATA06 | `npm test --workspace=@parcelflow/api -- notifications` | local |
| AC09 | ETA Haversine 20 km/h khi đơn đang giao và vị trí còn mới; không sửa hạn giao | ETA01, API09 | `npm test --workspace=@parcelflow/api -- assignments.postgres` và `npm test -- eta` | local (Cloud chưa xác nhận) |
| AC10 | Phân quyền 3 role; sai quyền 403, chưa liên kết user 409, không token 401 | AUTH01 | `npm test --workspace=@parcelflow/api -- auth shipment-flow` (TC10.x) | local |

Phần client AC04/UI02: emitter lọc mẫu sai/cũ/accuracy, buffer RAM có giới hạn,
gửi bù có backoff, tách buffer/token theo tài khoản và dọn khi rời trang. Đạt
local: bộ emitter/dashboard/queue/adapter 113/113; Edge 47/47 với Auth/API mock,
layout 320/390/1440 px. Xem [bàn giao emitter tuần 8](features/gps-emitter-reliability-handoff.md)
và [báo cáo browser](evidence/gps-emitter-reliability/report.json). Không nâng
trạng thái Cloud của AC04 hoặc checkpoint tuần 8 từ các kiểm tra này.

Một số test chỉ chạy trên PostgreSQL thật, thiếu biến thì bị bỏ qua (vẫn báo đạt, nên đọc số "skipped"):

| Biến | Test |
| --- | --- |
| `SHIPMENT_TEST_DATABASE_URL` | `shipments.postgres`, `assignments.postgres` chế độ PostgreSQL thật (mặc định chạy PGlite) |
| `TV6_ADMIN_TEST_DATABASE_URL` | `shipment-flow`, `admin-directory.postgres` |
| `WORKER_TEST_DATABASE_URL` | `gps-writer.postgres`, `gps-duplicate-order` |

Mỗi biến phải trỏ tới DB loopback dùng tạm; test tự tạo và xóa schema riêng.

Kết quả từng tuần và bằng chứng Cloud ghi ở [điều phối theo tuần](coordination/README.md).
