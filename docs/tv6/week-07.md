# Tuần 7 (02/11–08/11)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: FALSE. Checkpoint nhóm: luồng tạo đơn đến giao hàng hoạt động hoàn chỉnh; vị trí driver ghi được qua Worker.

## Việc của TV6 theo sheet

QA luồng end-to-end create → assign → pickup → deliver.

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W7-TV6-01 | Chuẩn bị tài khoản Customer, Admin, Driver đúng role và đơn test | Auth tuần 5, `set-role` | Fixture trong [qa-test-plan.md](../qa-test-plan.md); không đưa mật khẩu hay token vào Git | AC10 | Fixture mock đã có trong test; tài khoản thật trên Firebase chưa có |
| W7-TV6-02a | Create: tạo đơn, kiểm shipment, history, notification trong SQL | W7-TV6-01 | Bảng kết quả TC01.x | AC01 | Đã chạy local (PASS), chưa chạy Cloud |
| W7-TV6-02b | Assign và reassign trước pickup | W7-TV6-02a | Kết quả TC02.1–02.4 | AC02 | Đã chạy local (PASS), chưa chạy Cloud |
| W7-TV6-02c | Pickup và deliver | API pickup/deliver của TV1 | Kết quả TC03.1–03.4 | AC03 | BLOCKED: chưa có handler trên `develop` |
| W7-TV6-02d | Quyền sai (Customer khác, Driver không được gán, Admin) | W7-TV6-01 | Kết quả TC10.x | AC10, NF09 | Một phần: 401/403 của Create và Assign đã PASS local; chưa có ma trận TC10 đầy đủ |
| W7-TV6-02e | History theo scope và thứ tự | Endpoint history của TV1 | Kết quả TC06.1 | AC06 | BLOCKED: chưa có endpoint riêng |
| W7-TV6-02f | GPS lưu SQL: một mẫu đi từ queue đến hàng SQL | Worker + SQL thật (TV2, TV5) | `eventId` đối chiếu qua API, Pub/Sub, Worker, SQL | AC04, TC04.8 | Một phần: Worker ghi, Admin đọc cùng cột đã PASS trên PostgreSQL local; chưa qua queue và Cloud |
| W7-TV6-03 | Tổng hợp lỗi và bằng chứng, tách mock/local/Cloud | Các bước trên | Bảng PASS/FAIL/BLOCKED theo ca | Mẫu ghi kết quả ở [tv6-weekly.md](tv6-weekly.md) | Đã có bản local ở mục "Kết quả chạy 07/11/2026" |

## Đã làm được

- 07/11: sửa lệch cột GPS giữa Admin directory và Worker, để `/v1/drivers` đọc đúng bảng mà Worker ghi (chưa kiểm với dữ liệu Worker thật).
- 07/11: test Admin directory chạy thật trên PostgreSQL local (7 ca SQL); toàn bộ API 406 đạt.
- Có sẵn kịch bản, fixture và ma trận ca trong `qa-test-plan.md`.

## Kết quả chạy 07/11/2026

Môi trường: PostgreSQL thật trên máy (loopback, cụm tạm đã xóa sau khi chạy), Firebase giả lập, source `develop` tại `dd9a07f` cộng nhánh `docs/tv6-weekly`. Không phải Cloud. Bộ test chạy toàn bộ API: 470 đạt, 0 lỗi, 10 skip (7 ca Firebase Emulator chưa bật và 3 ca chỉ chạy ở chế độ khác).

| Ca | Nội dung | Môi trường | Kết quả |
| --- | --- | --- | --- |
| TC01.1 | Create hợp lệ: 201, một shipment, event, notification, idempotency cùng commit | PostgreSQL local, mock Firebase | PASS |
| TC01.2 | Gửi lặp cùng key, kể cả hai request cạnh tranh: một đơn, không thêm event/notification | PostgreSQL local, mock Firebase | PASS |
| TC01.3 | Cùng key, payload đổi: 409 `IDEMPOTENCY_KEY_CONFLICT`, DB không đổi | PostgreSQL local, mock Firebase | PASS |
| TC01.4 | Key hoặc field sai: 400, không tạo dữ liệu | PostgreSQL local, mock Firebase | PASS |
| TC01.5 | Lỗi ghi notification hoặc idempotency: rollback cả giao dịch, không trả 201 giả | PostgreSQL local, mock Firebase | PASS |
| TC01.6 | Replay Create sau khi đã assign: snapshot CREATED, Detail trả trạng thái mới | PostgreSQL local, mock Firebase | PASS |
| TC02.1 | Admin gán driver: 200 ASSIGNED, Customer/Driver bị 403 | PostgreSQL local, mock Firebase | PASS |
| TC02.2 | Gán lại cùng driver là no-op | PostgreSQL local, mock Firebase | PASS |
| TC02.3 | Reassign trước pickup | PostgreSQL local, mock Firebase | PASS |
| TC02.4 | Sau pickup trả 409, driver không tồn tại 404, sai role 400 | PostgreSQL local, mock Firebase | PASS (đơn PICKED_UP hoặc terminal dựng sẵn trong fixture) |
| TC02.6 | Mất response: GET Detail thấy trạng thái mới | PostgreSQL local, mock Firebase | PASS |
| TC04.1–TC04.2 | `POST /v1/locations`: chỉ DRIVER, chỉ trả 202 khi broker xác nhận | Mock broker | PASS |
| GPS cột | Worker ghi `current_locations`, `GET /v1/drivers` đọc đúng tọa độ, `clientTimestamp`, `receivedAt` | PostgreSQL local, bảng GPS dựng theo Prisma DATA04/05 | PASS |
| TC03.1–TC03.4 | Pickup và deliver | | BLOCKED: chưa có handler trên `develop` (TV1) |
| TC06.1 | History theo scope và thứ tự | | BLOCKED: chưa có endpoint riêng (TV1) |
| TC02.5 | Race Assign với Pickup | | BLOCKED: chưa có Pickup |
| Cloud | Mọi ca trên bản đã deploy | | NOT RUN: chưa có tài khoản demo và revision |

Ghi chú:
- Repo không có DDL cho `current_locations` và `location_history`; khi kiểm tra GPS tôi dựng hai bảng theo Prisma (snake_case, không khóa ngoại). `users` và `shipments` lấy từ `packages/database/sql/001-create-shipment.sql`. Kiểm tra này chưa chứng minh DB Cloud có đúng tên cột đó.
- Trong lúc kiểm tra GPS, mẫu trùng khóa khác tọa độ giữ bản đầu, mẫu cũ không kéo `current_locations` lùi. Đây là kết quả phụ trên PostgreSQL local, chưa tính là đạt AC04 (dedupe và ordering đầy đủ là checkpoint tuần 8).
- Script kiểm tra GPS là file tạm, đã xóa sau khi chạy, nên chưa chạy lại được từ repo.

## Còn thiếu và rủi ro

- Pickup, deliver, fail và endpoint history chưa có trên `develop` (TV1), nên các ca TC03.x và TC06.1 chỉ ghi BLOCKED.
- Worker có chế độ lưu bộ nhớ; log ACK chưa chứng minh đã ghi SQL. Cần xác nhận runtime dùng PostgreSQL.
- Sheet ghi TV5 triển khai push subscription, code hiện dùng pull; nhóm cần chốt.
- Chưa có bằng chứng Cloud cho bất kỳ ca nào ở tuần này.
