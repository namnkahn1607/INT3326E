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
| W7-TV6-02e | History theo scope và thứ tự | Endpoint history của TV1 | Kết quả TC06.1 | AC06 | Một phần: create, assign, reassign trong `statusHistory` của Detail đã PASS local; pickup và terminal chưa có (TV1) |
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
| TC06.1 | Customer `usr_…01`, Driver 1 và 2, Admin | Đơn tạo trong test | CREATED → ASSIGNED → REASSIGNED | `statusHistory` của Detail đủ actor, thời gian, `previousDriverId`, `newDriverId`, đúng thứ tự (xem TC02.1, TC02.3); lọc theo trạng thái và mã đơn, phân trang không lặp dòng | Driver cũ mất quyền xem sau reassign (403, danh sách rỗng); cursor khác người dùng hoặc bộ lọc bị chặn | History không có GPS. Event pickup và terminal chưa dựng được qua API | PostgreSQL local, Firebase mock | PARTIAL: create, assign, reassign PASS; pickup và terminal BLOCKED (TV1) |
| TC02.5 | Admin, Driver |  |  |  |  | Cần Pickup để tạo race với Assign |  | BLOCKED |
| Smoke Cloud không đăng nhập (07/11/2026 03:25 UTC) | Không có token | Không có | không áp dụng | Không ghi gì | `GET /v1/auth/me`, `/v1/admin/me`, `/v1/drivers`, `/v1/admin/customers`, `/v1/shipments` và `POST /v1/shipments`, `/v1/shipments/:id/assign`, `/v1/locations` đều 401 `UNAUTHENTICATED` dạng `application/problem+json` | `GET /healthz/` 200; `GET /healthz` 404; `POST …/pickup` 404 (chưa có route); CORS cho `https://int3326e.web.app`, cho `Authorization` và `Idempotency-Key` | Cloud Run `backend-service`, chưa biết SHA | PASS (chỉ chứng minh route có mặt và chặn đúng khi thiếu token) |
| Ca có đăng nhập trên Cloud | Tài khoản demo ba role |  |  |  |  | Chưa có tài khoản demo từ TV5 | Cloud | NOT RUN |

Smoke Cloud chỉ gửi GET, OPTIONS và POST không token, không tạo hay sửa dữ liệu. URL lấy từ [frontend-config-handoff.md](../frontend-config-handoff.md). So với thăm dò 18/10 (revision `backend-service-00012-m54`, mọi route Auth 404), revision hiện tại đã có Auth, Admin, Shipments, Locations. Chưa xác nhận được SHA nguồn của revision.

Mã đơn và ID người dùng:
- ID `usr_…01` đến `usr_…06` là ID fixture của bộ test assignments (`id(n)`, 26 ký tự số): 01 Customer chủ đơn, 02 Customer khác, 03 và 04 Driver, 05 và 06 Admin. Bộ test Create dùng ID ULID cố định `usr_01ARZ3NDEKTSV4RRFFQ69G5FAV` (Customer), `…FAW` (Driver), `…FAX` (Customer khác).
- Mã đơn do hệ thống sinh ngẫu nhiên mỗi lần chạy, nên không có mã cố định để đối chiếu lại. Nếu cần mã cụ thể cho báo cáo, phải chạy lại và ghi lại mã từ log của lần chạy đó.
- Các ca dựng trạng thái PICKED_UP, DELIVERED, DELIVERY_FAILED hoặc ASSIGNED bằng lệnh SQL (TC01.6, TC02.4) không chứng minh API pickup hay deliver hoạt động.

Ghi chú:
- Repo không có DDL cho `current_locations` và `location_history`; khi kiểm tra GPS tôi dựng hai bảng theo Prisma (snake_case, không khóa ngoại). `users` và `shipments` lấy từ `packages/database/sql/001-create-shipment.sql`. Kiểm tra này chưa chứng minh DB Cloud có đúng tên cột đó.
- Trong lúc kiểm tra GPS, mẫu trùng khóa khác tọa độ giữ bản đầu, mẫu cũ không kéo `current_locations` lùi. Đây là kết quả phụ trên PostgreSQL local, chưa tính là đạt AC04 (dedupe và ordering đầy đủ là checkpoint tuần 8).
- Script kiểm tra GPS là file tạm, đã xóa sau khi chạy, nên chưa chạy lại được từ repo.

## Tồn đọng giao cho người khác

Soạn 07/11/2026. Đây là các việc TV6 không tự làm được để đóng QA tuần 7. Hạn theo lịch tuần 7 là 08/11. Khi xong, người nhận gửi commit hoặc PR (hoặc revision Cloud) cho TV6 để chạy lại các ca ở cột "Chặn ca nào".

| # | Việc tồn đọng | Người nhận | Chặn ca nào | Điều kiện hoàn thành (để TV6 chạy lại) | Phụ thuộc | Mã việc tuần 7 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | API lấy hàng `POST /v1/shipments/{id}/pickup`. OpenAPI đã khai báo, `develop` chưa có route (Cloud cũng trả 404) | TV1 | TC03.1–TC03.4, TC02.5, phần pickup của TC06.1 | Driver được gán: 200, đơn ASSIGNED → PICKED_UP, ghi event và notification trong cùng transaction. Driver khác: 403. Sai trạng thái: 409. Gọi lặp: không thêm event. Có test SQL theo mẫu `assignments.postgres.spec.ts` | Assign tuần 6 | W7-TV1-01, AC03 |
| 2 | API giao hàng `POST /v1/shipments/{id}/deliver` (body `proofOfDeliveryNotes` tùy chọn, tối đa 255 ký tự) | TV1 | TC03.x, phần terminal của TC06.1 | Chỉ từ PICKED_UP sang DELIVERED, chỉ Driver được gán. Ghi event và notification một lần, gọi lặp không thêm tác động, lỗi giữa chừng rollback | Mục 1 | W7-TV1-01, AC03 |
| 3 | Lịch sử có event PICKED_UP và DELIVERED trong `statusHistory` của Detail (đủ actor, thời gian, thứ tự). Nếu nhóm chốt endpoint history riêng thì ghi path vào OpenAPI | TV1 | Phần còn lại của TC06.1 | Detail trả đủ chuỗi CREATED, ASSIGNED, PICKED_UP, DELIVERED đúng thứ tự; Customer chủ đơn đọc được, Customer khác 403 | Mục 1, 2 | W7-TV1-02, AC06 |
| 4 | Driver app: danh sách đơn được gán, nút nhận và giao nối API thật, GPS lấy từ trình duyệt hoặc simulator có nhãn (hiện phát một tọa độ cố định) | TV4 | Luồng đầu cuối do Driver thao tác, W7-TV6-02f | Driver đăng nhập thấy đúng đơn của mình, bấm nhận và giao đổi được trạng thái, GPS đổi theo nguồn đã chọn, chu kỳ 8 giây | Mục 1, 2 | W7-TV4-01, W7-TV4-02 |
| 5 | UI tiến độ cho Admin và history thật cho Customer (tab lịch sử Customer còn dữ liệu mẫu theo báo cáo 04/11) | TV3 | Kiểm UI của luồng đầu cuối | Customer chỉ xem history đơn của mình, có loading, rỗng, lỗi; Admin thấy tiến độ nhưng không pickup hay deliver thay Driver | Mục 3 | W7-TV3-01, W7-TV3-02 |
| 6 | Tài khoản demo ba role trên Firebase project `int3326e`: tạo trong Console, cấp role bằng `npm run auth:set-role` (xem [bàn giao Auth](auth-rbac-handoff.md)), có row tương ứng trong `users` (`firebaseUid` duy nhất, `role` khớp claim). Gửi thông tin đăng nhập cho TV6 qua kênh riêng, không đưa vào Git | TV5 (Firebase project); TV1 hoặc TV5 (seed `users`) | Mọi ca có đăng nhập trên Cloud | Ba tài khoản đăng nhập được, `/v1/auth/me` trả đúng role, `/v1/admin/me` 200 cho Admin và 403 cho hai role còn lại | Không | W7-TV6-01 |
| 7 | Ghi lại revision đang chạy: SHA nguồn, ngày deploy, migration và schema đã áp dụng (users, shipments, events, notifications, idempotency, GPS) | TV5; TV1 và TV2 xác nhận migration | Kết luận Cloud: hiện chỉ biết route có mặt, chưa biết SHA | Biên bản có SHA khớp một commit trên `develop`, runtime service account, `DATABASE_URL` trỏ đúng database | Không | W7-TV5-01, W7-TV5-02 |
| 8 | DDL cho `current_locations` và `location_history` (snake_case như Worker ghi và Prisma DATA04/05) áp dụng lên Cloud SQL. Repo hiện không có DDL cho hai bảng này; Admin directory đã đọc theo cột này | TV2 và TV1 (chủ schema); TV5 áp dụng | GPS lưu SQL, Admin đọc vị trí | File SQL trong `packages/database/sql/`, đã chạy trên Cloud SQL, tên cột khớp Worker và `GET /v1/drivers` | Mục 7 | W7-TV2-01 |
| 9 | Worker chạy với PostgreSQL thật, không rơi về bộ nhớ (kiểm `DATABASE_URL` và log khởi động). Ghi một mẫu và thấy hàng trong SQL, ACK sau commit | TV2; TV5 cấu hình runtime | W7-TV6-02f trên Cloud | Một `eventId` thấy ở `location_history` và `current_locations`; khởi động lại instance vẫn đọc lại được | Mục 7, 8 | W7-TV2-02, W7-TV5-02 |
| 10 | Chốt cơ chế nhận message: sheet ghi push subscription, code hiện dùng pull (`subscription.on('message')`). Không trỏ push vào URL chỉ có health check | TV2 và TV5 | Cấu hình Cloud của Worker | Quyết định ghi vào tài liệu (nếu đổi runtime thì ghi amendment); cấu hình thực tế khớp quyết định | Không | Sheet tuần 7 của TV5 |
| 11 | Kiểm một mẫu GPS đi từ API qua Pub/Sub, Worker đến SQL trên máy dev. Cần Docker (`infra/docker-compose.yml` có sẵn emulator) hoặc `gcloud components install beta pubsub-emulator` | TV5 hoặc người có máy chạy được Docker | W7-TV6-02f ở mức local | Một `eventId` đi qua đủ bốn chặng, log Worker và hàng SQL khớp; ghi lại lệnh chạy | Mục 8 | W7-TV6-02f |
| 12 | Deploy lại frontend Hosting. Bundle `/driver` vẫn là `index-CCoMdCpR.js` như ngày 02/11 | TV5 cùng TV3 và TV4 | Kiểm UI trên Cloud | Hosting phục vụ bản build mới, ghi SHA và cấu hình `VITE_*` theo [cấu hình frontend](../frontend-config-handoff.md) | Mục 4, 5 | W7-TV5-02 |

Thứ tự gợi ý: mục 1, 2, 3 trước (mở khóa TC03 và TC06.1), song song với mục 6, 7, 8 (mở khóa Cloud), rồi mục 4, 5, 9, 12, cuối cùng là mục 11.

Lưu ý:
- `fail` và các việc của tuần 8 trở đi không nằm ở bảng này.
- TV6 không tự viết các handler ở mục 1, 2, 3 thay TV1. QA chỉ đánh dấu đạt khi có bằng chứng từ chủ component.
- Các ca TV6 đã đạt ở local không cần người nhận làm lại.

## Còn thiếu và rủi ro

- Pickup, deliver, fail chưa có trên `develop` (TV1), nên TC03.x chỉ ghi BLOCKED; TC06.1 chỉ đạt phần create, assign, reassign.
- Worker có chế độ lưu bộ nhớ; log ACK chưa chứng minh đã ghi SQL. Cần xác nhận runtime dùng PostgreSQL.
- Sheet ghi TV5 triển khai push subscription, code hiện dùng pull; nhóm cần chốt.
- Cloud mới có smoke không đăng nhập (route có mặt, 401 đúng, CORS đúng). Chưa có ca nào chạy với token thật. Bundle Hosting `/driver` vẫn là `index-CCoMdCpR.js` như ngày 02/11, chưa thấy frontend mới.
- GPS đi qua queue tới SQL chưa kiểm được trên máy: không có Docker và chưa cài component Pub/Sub emulator của gcloud (cài sẽ sửa cấu hình máy nên tôi không tự làm).
