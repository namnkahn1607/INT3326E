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

| Ca | Tài khoản (role) | Mã đơn | Trạng thái trước → sau | Lịch sử và thông báo | Quyền truy cập | Lỗi và phục hồi | Môi trường | Kết quả |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TC01.1 | Customer `usr_01ARZ3NDEKTSV4RRFFQ69G5FAV` (CUSTOMER) | Sinh khi chạy: `sh_`+26 ký tự, `PF`+8 số+6 ký tự | không có → CREATED, `driverId` null | 1 shipment, 1 event (CREATED, actor là Customer, `fromStatus` null), 1 notification (kind CREATED, không chứa số điện thoại), 1 idempotency key | Chủ đơn lấy từ token, không từ body | 201; response khớp `ShipmentResponse` trong OpenAPI | PostgreSQL local, Firebase mock | PASS |
| TC01.2 | Customer như trên, cùng key và payload | Một đơn duy nhất | CREATED, không đổi | Gửi lặp kể cả hai request cạnh tranh: vẫn 1 shipment, 1 event, 1 notification, 1 key | Như trên | 201 gốc, không tạo bản trùng | PostgreSQL local, Firebase mock | PASS |
| TC01.3 | Customer như trên, cùng key, payload đổi | Đơn đã tạo | CREATED, không đổi | Số dòng không đổi (1/1/1/1) | Như trên | 409 `IDEMPOTENCY_KEY_CONFLICT` | PostgreSQL local, Firebase mock | PASS |
| TC01.4 | Customer như trên | Không tạo | không có | Không ghi gì | Như trên | 400 khi key thiếu, sai hoặc là UUID v1, field sai hoặc tham số query lạ | PostgreSQL local, Firebase mock | PASS |
| TC01.5 | Customer như trên | Không tạo (rollback) | không có | Lỗi ghi event, notification hoặc idempotency: số dòng về 0/0/0/0 | Như trên | 503, không lộ chi tiết lỗi. Hết lỗi, gửi lại cùng key: 201 | PostgreSQL local, Firebase mock | PASS |
| TC01.6 | Customer như trên; đơn bị đổi sang ASSIGNED bằng SQL | Đơn vừa tạo | response replay vẫn CREATED; trong DB là ASSIGNED | Replay trả đúng snapshot cũ dù hạn giao đã qua, DB giữ ASSIGNED và driver | Như trên | 201 snapshot, không kiểm lại hạn giao | PostgreSQL local, Firebase mock | PASS |
| Quyền Create | Không token; DRIVER; ADMIN; Customer chưa liên kết `users` | Không tạo | không đổi | Không có statement ghi nào trước khi kiểm quyền | 401 không token; 403 cho DRIVER và ADMIN; 409 `USER_NOT_PROVISIONED` | Không mở transaction | PostgreSQL local, Firebase mock | PASS |
| TC02.1 | Admin `usr_…05` (ADMIN) gán Driver `usr_…03` (DRIVER); chủ đơn Customer `usr_…01` | Đơn tạo trong test | CREATED → ASSIGNED, `driverId` = driver 1 | `statusHistory` 2 dòng, dòng 2: ASSIGNED, từ CREATED, `newDriverId` driver 1, actor Admin. 1 notification kind ASSIGNED gửi chủ đơn, không chứa số điện thoại | Admin được gán | 200, `Cache-Control: no-store` | PostgreSQL local, Firebase mock | PASS |
| TC02.2 | Admin `usr_…06` gán lại cùng Driver 1 | Như trên | ASSIGNED, không đổi | Không thêm event hay notification (vẫn 1/1), thời gian giữ nguyên | Như trên | 200, response bằng lần đầu | PostgreSQL local, Firebase mock | PASS |
| TC02.3 | Admin `usr_…06` gán Driver 2 `usr_…04` thay Driver 1 | Như trên | ASSIGNED (driver 1) → ASSIGNED (driver 2) | Dòng 3: REASSIGNED, `previousDriverId` driver 1, `newDriverId` driver 2, actor Admin 2. Tổng 2 event, 2 notification | Driver 1: chi tiết 403, danh sách rỗng. Driver 2: 200. Customer chủ đơn đọc được lịch sử | 200 | PostgreSQL local, Firebase mock | PASS |
| TC02.4 | Admin gán; đơn ở các trạng thái khác | Đơn tạo trong test | Trạng thái PICKED_UP, DELIVERED, DELIVERY_FAILED được đặt bằng SQL, không qua API pickup | Không thêm event hay notification | Gán cho Customer: 400 | 404 đơn không tồn tại, 404 tài xế không tồn tại, 400 sai role, 409 `INVALID_STATE_TRANSITION` khi đơn đã lấy hàng hoặc kết thúc | PostgreSQL local, Firebase mock | PASS |
| Quyền Assign và đọc đơn | Không token; Customer; Driver; Admin chưa liên kết; Admin lệch role | Đơn tạo trong test | không đổi | Không ghi event hay notification (0/0) | 401 không token; 403 cho Customer và Driver khi gán; 409 `USER_NOT_PROVISIONED` khi chưa liên kết hoặc lệch role | Áp dụng cho list, detail và assign | PostgreSQL local, Firebase mock | PASS |
| TC02.6 | Admin `usr_…05` | Đơn tạo trong test | CREATED → ASSIGNED, response bị mất sau commit | Detail thấy ASSIGNED, driver 1, history 2 dòng. Gọi lại assign: 200, vẫn 1 event, 1 notification | Như TC02.1 | Mất response trả 503; đọc lại detail để phục hồi, không ghi trùng | PostgreSQL local, Firebase mock | PASS |
| Rollback Assign | Admin `usr_…05` | Đơn tạo trong test | CREATED, `driverId` null (không đổi) | Lỗi ghi event, notification hoặc UPDATE: 0 event, 0 notification | Như TC02.1 | 503, không lộ SQL. Hết lỗi, gán lại: 200 | PostgreSQL local, Firebase mock | PASS |
| Gán đồng thời | Admin `usr_…05`, 5 request cùng lúc | Một đơn | CREATED → ASSIGNED | 1 event, 1 notification | Như TC02.1 | 5 request đều 200, không ghi trùng | PostgreSQL local, Firebase mock | PASS |
| TC04.1, TC04.2 | Driver (mock Firebase), broker giả | Không có đơn | không áp dụng | Không ghi SQL ở API | Chỉ DRIVER; actor lấy từ server | 202 chỉ khi broker xác nhận; lỗi hoặc timeout trả 503 | Mock Firebase, mock broker | PASS |
| GPS Worker ghi, API đọc | Driver `usr_01ARZ3NDEKTSV4RRFFQ69G5FAW` có một đơn ASSIGNED | `sh_01ARZ3NDEKTSV4RRFFQ69G5FAV` (fixture) | ASSIGNED, không đổi | `current_locations` có đúng 1 mẫu; `location_history` có mẫu đó | Admin directory (`GET /v1/drivers`) đọc đúng tọa độ, `clientTimestamp`, `receivedAt` | Mẫu trùng khóa khác tọa độ giữ bản đầu; mẫu cũ không kéo current lùi (kết quả phụ, chưa tính AC04) | PostgreSQL local, bảng GPS dựng theo Prisma | PASS |
| TC03.1–TC03.4 | Driver, Admin |  | ASSIGNED → PICKED_UP → DELIVERED (chưa chạy) |  |  | Chưa có handler pickup, deliver trên `develop` (TV1) |  | BLOCKED |
| TC06.1 | Customer, Driver, Admin |  |  | History theo scope và thứ tự (chưa chạy) |  | Chưa có endpoint history riêng (TV1) |  | BLOCKED |
| TC02.5 | Admin, Driver |  |  |  |  | Cần Pickup để tạo race với Assign |  | BLOCKED |
| Toàn bộ ca trên Cloud | Tài khoản demo ba role |  |  |  |  | Chưa có tài khoản demo và revision từ TV5 | Cloud | NOT RUN |

Mã đơn và ID người dùng:
- ID `usr_…01` đến `usr_…06` là ID fixture của bộ test assignments (`id(n)`, 26 ký tự số): 01 Customer chủ đơn, 02 Customer khác, 03 và 04 Driver, 05 và 06 Admin. Bộ test Create dùng ID ULID cố định `usr_01ARZ3NDEKTSV4RRFFQ69G5FAV` (Customer), `…FAW` (Driver), `…FAX` (Customer khác).
- Mã đơn do hệ thống sinh ngẫu nhiên mỗi lần chạy, nên không có mã cố định để đối chiếu lại. Nếu cần mã cụ thể cho báo cáo, phải chạy lại và ghi lại mã từ log của lần chạy đó.
- Các ca dựng trạng thái PICKED_UP, DELIVERED, DELIVERY_FAILED hoặc ASSIGNED bằng lệnh SQL (TC01.6, TC02.4) không chứng minh API pickup hay deliver hoạt động.

Ghi chú:
- Repo không có DDL cho `current_locations` và `location_history`; khi kiểm tra GPS tôi dựng hai bảng theo Prisma (snake_case, không khóa ngoại). `users` và `shipments` lấy từ `packages/database/sql/001-create-shipment.sql`. Kiểm tra này chưa chứng minh DB Cloud có đúng tên cột đó.
- Trong lúc kiểm tra GPS, mẫu trùng khóa khác tọa độ giữ bản đầu, mẫu cũ không kéo `current_locations` lùi. Đây là kết quả phụ trên PostgreSQL local, chưa tính là đạt AC04 (dedupe và ordering đầy đủ là checkpoint tuần 8).
- Script kiểm tra GPS là file tạm, đã xóa sau khi chạy, nên chưa chạy lại được từ repo.

## Còn thiếu và rủi ro

- Pickup, deliver, fail và endpoint history chưa có trên `develop` (TV1), nên các ca TC03.x và TC06.1 chỉ ghi BLOCKED.
- Worker có chế độ lưu bộ nhớ; log ACK chưa chứng minh đã ghi SQL. Cần xác nhận runtime dùng PostgreSQL.
- Sheet ghi TV5 triển khai push subscription, code hiện dùng pull; nhóm cần chốt.
- Chưa có bằng chứng Cloud cho bất kỳ ca nào ở tuần này.
