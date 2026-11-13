# Tuần 7 (02/11–08/11)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: FALSE. Checkpoint nhóm: luồng tạo đơn đến giao hàng hoạt động hoàn chỉnh; vị trí driver ghi được qua Worker.

## Việc của TV6 theo sheet

QA luồng end-to-end create → assign → pickup → deliver.

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W7-TV6-01 | Chuẩn bị tài khoản Customer, Admin, Driver đúng role và đơn test | Auth tuần 5, `set-role` | Fixture trong [qa-test-plan.md](../qa/test-plan.md); không đưa mật khẩu hay token vào Git | AC10 | Fixture mock đã có trong test; tài khoản thật trên Firebase chưa có |
| W7-TV6-02a | Create: tạo đơn, kiểm shipment, history, notification trong SQL | W7-TV6-01 | Bảng kết quả TC01.x | AC01 | Đã chạy local (PASS), chưa chạy Cloud |
| W7-TV6-02b | Assign và reassign trước pickup | W7-TV6-02a | Kết quả TC02.1–02.4 | AC02 | Đã chạy local (PASS), chưa chạy Cloud |
| W7-TV6-02c | Pickup và deliver | API pickup/deliver của TV1 (có trên `develop` từ 08/11) | Kết quả TC03.1–03.4 | AC03 | Đã chạy local 11/11 (PASS), riêng TC03.4 chỉ chạy phần Deliver đồng thời vì chưa có Fail |
| W7-TV6-02d | Quyền sai (Customer khác, Driver không được gán, Admin) | W7-TV6-01 | Kết quả TC10.x | AC10, NF09 | Đã chạy local 11/11 (PASS) ma trận TC10.1–TC10.3 |
| W7-TV6-02e | History theo scope và thứ tự | Endpoint history của TV1 | Kết quả TC06.1 | AC06 | Đã chạy local 11/11 (PASS) đủ chuỗi tới DELIVERED |
| W7-TV6-02f | GPS lưu SQL: một mẫu đi từ queue đến hàng SQL | Worker + SQL thật (TV2, TV5) | `eventId` đối chiếu qua API, Pub/Sub, Worker, SQL | AC04, TC04.8 | Một phần: Worker ghi, Admin đọc cùng cột đã PASS trên PostgreSQL local; chưa qua queue và Cloud |
| W7-TV6-03 | Tổng hợp lỗi và bằng chứng, tách mock/local/Cloud | Các bước trên | Bảng PASS/FAIL/BLOCKED theo ca | Mẫu ghi kết quả ở [tv6-weekly.md](tv6-weekly.md) | Đã có bản local ở mục "Kết quả chạy 07/11/2026" |

## Đã làm được

- 07/11: chốt cột GPS theo đặc tả (camelCase, DATA04/05). Lúc đầu tôi đổi Admin directory sang snake_case để khớp Worker trên `develop`, sau đó hoàn tác vì đặc tả và Worker mới của Na đều dùng camelCase. Worker trên `develop` vẫn ghi snake_case cho đến khi nhánh của Na (`0626fd0`) được merge.
- 07/11: test Admin directory chạy thật trên PostgreSQL local (7 ca SQL); toàn bộ API 406 đạt.
- Có sẵn kịch bản, fixture và ma trận ca trong `qa-test-plan.md`.

## Kết quả chạy 11/11/2026

Môi trường: PostgreSQL thật trên máy (loopback, cụm tạm đã xóa sau khi chạy), Firebase giả lập, source `develop` tại `730a84c` (đã có pickup, deliver của TV1 và Worker của Na). Không phải Cloud. Toàn bộ API: 550 test, 540 đạt, 0 lỗi, 10 skip (7 ca Firebase Emulator chưa bật, 3 ca chỉ chạy ở chế độ khác). Typecheck đạt.

Ca của TV1 trong `assignments.postgres.spec.ts` chạy ở ba chế độ (PGlite, PGlite có enum, PostgreSQL thật). Ca bổ sung của TV6 nằm ở `apps/api/src/qa/week7-flow.postgres.spec.ts`, chỉ chạy với PostgreSQL thật.

| Ca | Tài khoản (role) | Trạng thái trước → sau | Lịch sử và thông báo | Quyền truy cập | Lỗi và phục hồi | Nguồn test | Kết quả |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC03.1 | Driver hiện hành (sau reassign) | ASSIGNED → PICKED_UP → DELIVERED | Mỗi bước 1 event và 1 notification cùng commit; notification không chứa số điện thoại | Chỉ Driver được gán | | TV1 | PASS |
| TC03.2 | Driver khác, Customer, Admin | CREATED hoặc ASSIGNED, không đổi | Không thêm event | 403 khi sai scope hoặc sai role; 409 khi đúng Driver nhưng sai bước (deliver khi ASSIGNED, pickup sau DELIVERED); 404 đơn không tồn tại | DB không đổi | TV1 (test ghi nhãn "TC03.3") | PASS |
| TC03.3 | Driver hiện hành, gọi lặp với ghi chú khác | PICKED_UP, DELIVERED giữ nguyên | Không thêm event; giữ ghi chú và thời gian lần đầu | | Pickup sau terminal trả 409 | TV1 (test ghi nhãn "TC03.2") | PASS |
| TC03.4 (một phần) | Driver hiện hành, hai Deliver đồng thời | PICKED_UP → DELIVERED | Chỉ 1 event và 1 notification; hai response giống nhau | | Pickup sau đó trả 409 | TV6 | PASS. Ca Deliver đối đầu Fail chưa chạy được vì chưa có API Fail (việc tuần 9 của TV1) |
| Rollback pickup, deliver | Driver hiện hành | Giữ ASSIGNED hoặc PICKED_UP | Lỗi ghi event, notification hoặc UPDATE: không thêm dòng | | 503 không lộ SQL; hết lỗi thì thử lại thành công | TV1 | PASS |
| TC02.5 | Admin reassign và Driver pickup đồng thời | Theo bên giành khóa dòng trước | | | Bên thua nhận 403 hoặc 409 theo đặc tả | TV1 (có ca khóa dòng trên PostgreSQL thật) | PASS |
| TC06.1 | Customer chủ đơn, Driver 1 (cũ), Driver 2, Admin | CREATED → ASSIGNED → REASSIGNED → PICKED_UP → DELIVERED | `statusHistory` đủ 5 dòng, đúng thứ tự thời gian, đúng actor (CUSTOMER, ADMIN, ADMIN, DRIVER, DRIVER); không có trường GPS hay total; lọc `status` và `trackingNumber` đúng; `/notifications` của chủ đơn có đủ 5 loại | Customer khác và Driver cũ: chi tiết 403, danh sách rỗng, Customer khác không có notification; Driver 2 xem được | | TV1 và TV6 | PASS |
| TC10.1 | Không token | Không đổi | Không ghi gì | 12 API bảo vệ đều 401; `/healthz` 200 | | TV6 | PASS |
| TC10.2 | Token hợp lệ, chưa có row `users` | Không đổi | | 409 `USER_NOT_PROVISIONED` ở list, detail, notifications, create | | TV6 | PASS |
| TC10.3 | Customer khác, Driver không được gán, Admin | Không đổi (mỗi ca gọi 2 lần) | Số event và notification không đổi | Customer khác: 403 ở detail, assign, pickup, deliver, drivers, admin/customers, locations. Driver không được gán: 403 ở detail, pickup, deliver, assign, notifications, drivers, create. Admin: detail 200, drivers 200; pickup, deliver, notifications, create, locations 403; assign đơn đã giao 409 | Gọi lặp cho cùng kết quả | TV6 | PASS |

Ghi chú:
- Test của TV1 ghi nhãn TC03.2 và TC03.3 ngược với đặc tả VI.14 (TC03.2 là sai scope, TC03.3 là gọi lặp). Bảng trên xếp theo đặc tả; tôi không đổi tên test của TV1.
- Repo chưa có DDL cho bảng GPS, nên test TV6 tự dựng `current_locations` theo DATA04 (camelCase) để `/drivers` chạy được. Không dựng bảng đó thì `/drivers` trả 503 đúng thiết kế.
- Tất cả là kết quả local. Ca trên Cloud chờ đợt deploy ở mục tồn đọng bên dưới.

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
| TC03.1–TC03.4 | | | | | | Đã chạy ngày 11/11, xem bảng trên | | Xem kết quả 11/11 |
| TC06.1 | Customer `usr_…01`, Driver 1 và 2, Admin | Đơn tạo trong test | CREATED → ASSIGNED → REASSIGNED | `statusHistory` của Detail đủ actor, thời gian, `previousDriverId`, `newDriverId`, đúng thứ tự (xem TC02.1, TC02.3); lọc theo trạng thái và mã đơn, phân trang không lặp dòng | Driver cũ mất quyền xem sau reassign (403, danh sách rỗng); cursor khác người dùng hoặc bộ lọc bị chặn | History không có GPS. Event pickup và terminal chưa dựng được qua API | PostgreSQL local, Firebase mock | Xem kết quả 11/11 (PASS đủ chuỗi) |
| TC02.5 | | | | | | Đã chạy ngày 11/11, xem bảng trên | | Xem kết quả 11/11 |
| Smoke Cloud không đăng nhập (07/11/2026 03:25 UTC) | Không có token | Không có | không áp dụng | Không ghi gì | `GET /v1/auth/me`, `/v1/admin/me`, `/v1/drivers`, `/v1/admin/customers`, `/v1/shipments` và `POST /v1/shipments`, `/v1/shipments/:id/assign`, `/v1/locations` đều 401 `UNAUTHENTICATED` dạng `application/problem+json` | `GET /healthz/` 200; `GET /healthz` 404; `POST …/pickup` 404 (chưa có route); CORS cho `https://int3326e.web.app`, cho `Authorization` và `Idempotency-Key` | Cloud Run `backend-service`, chưa biết SHA | PASS (chỉ chứng minh route có mặt và chặn đúng khi thiếu token) |
| Ca có đăng nhập trên Cloud | Tài khoản demo ba role |  |  |  |  | Chưa có tài khoản demo từ TV5 | Cloud | NOT RUN |

Smoke Cloud chỉ gửi GET, OPTIONS và POST không token, không tạo hay sửa dữ liệu. URL lấy từ [frontend-config-handoff.md](../features/frontend-config-handoff.md). So với thăm dò 18/10 (revision `backend-service-00012-m54`, mọi route Auth 404), revision hiện tại đã có Auth, Admin, Shipments, Locations. Chưa xác nhận được SHA nguồn của revision.

Mã đơn và ID người dùng:
- ID `usr_…01` đến `usr_…06` là ID fixture của bộ test assignments (`id(n)`, 26 ký tự số): 01 Customer chủ đơn, 02 Customer khác, 03 và 04 Driver, 05 và 06 Admin. Bộ test Create dùng ID ULID cố định `usr_01ARZ3NDEKTSV4RRFFQ69G5FAV` (Customer), `…FAW` (Driver), `…FAX` (Customer khác).
- Mã đơn do hệ thống sinh ngẫu nhiên mỗi lần chạy, nên không có mã cố định để đối chiếu lại. Nếu cần mã cụ thể cho báo cáo, phải chạy lại và ghi lại mã từ log của lần chạy đó.
- Các ca dựng trạng thái PICKED_UP, DELIVERED, DELIVERY_FAILED hoặc ASSIGNED bằng lệnh SQL (TC01.6, TC02.4) không chứng minh API pickup hay deliver hoạt động.

Ghi chú:
- Repo không có DDL cho `current_locations` và `location_history`; khi kiểm tra GPS tôi dựng hai bảng theo Prisma lúc đó (snake_case, không khóa ngoại) và dùng Admin directory bản snake_case. Kết quả "GPS cột" PASS ở trên chỉ đúng với Worker trên `develop` (snake_case) và bản Admin đó; Admin hiện đã về camelCase theo đặc tả nên cần chạy lại sau khi nhánh của Na (camelCase) được merge. `users` và `shipments` lấy từ `packages/database/sql/001-create-shipment.sql`.
- Trong lúc kiểm tra GPS, mẫu trùng khóa khác tọa độ giữ bản đầu, mẫu cũ không kéo `current_locations` lùi. Đây là kết quả phụ trên PostgreSQL local, chưa tính là đạt AC04 (dedupe và ordering đầy đủ là checkpoint tuần 8).
- Script kiểm tra GPS là file tạm, đã xóa sau khi chạy, nên chưa chạy lại được từ repo.

## Tồn đọng giao cho người khác

Cập nhật 11/11/2026 theo quy tắc deploy một lần: mọi phần code và schema vào `develop` trước, TV5 deploy một lần API, Worker và Hosting từ cùng một SHA, sau đó TV6 chạy toàn bộ ca Cloud một lượt. Không deploy từng phần.

| Giai đoạn | # | Việc tồn đọng | Người nhận | Trạng thái 11/11 | Điều kiện hoàn thành |
| --- | --- | --- | --- | --- | --- |
| Trước deploy | 8 | DDL cho `current_locations` và `location_history`, cột camelCase theo DATA04/05, đặt trong `packages/database/sql/` | TV2 và TV1 | Chưa có trong repo. Chặn deploy: thiếu bảng thì `/drivers` trả 503 và Worker không ghi được | File SQL trên `develop`, chạy được trên PostgreSQL local cùng file 001 |
| Trước deploy | 10 | Chốt cơ chế nhận message: sheet ghi push, code dùng pull | TV2 và TV5 | Chưa chốt | Quyết định ghi vào tài liệu; cấu hình Cloud khớp quyết định |
| Trước deploy | 6 | Tài khoản demo ba role trên Firebase `int3326e` (cấp role bằng `npm run auth:set-role`), có row trong `users`; gửi TV6 qua kênh riêng, không đưa vào Git | TV5; TV1 hoặc TV5 seed `users` | Chưa có | Ba tài khoản đăng nhập được, `/v1/auth/me` đúng role |
| Trước deploy | 4 | Driver app: danh sách đơn, nút nhận và giao, GPS từ trình duyệt hoặc simulator có nhãn | TV4 | Code đã có trên `develop` (`DriverShipments`, `GpsEmitter` chọn simulator hoặc trình duyệt). TV6 chưa kiểm UI | TV4 tự kiểm local và báo SHA |
| Trước deploy | 5 | UI tiến độ Admin và lịch sử thật cho Customer | TV3 | Có `CustomerHistoryPage` trên `develop`. TV6 chưa kiểm dữ liệu thật | TV3 tự kiểm local, có loading, rỗng, lỗi |
| Trước deploy | 11 | Kiểm một mẫu GPS đi từ API qua Pub/Sub, Worker đến SQL trên máy dev (Docker hoặc `gcloud components install beta pubsub-emulator`) | TV2 hoặc TV5 | Chưa làm. Không bắt buộc nếu kiểm thẳng trên Cloud sau deploy | Một `eventId` thấy ở đủ bốn chặng |
| Đợt deploy | 7 | Deploy một lần API, Worker và Hosting từ cùng một SHA trên `develop` (`cloudbuild-api.yaml`, `cloudbuild-worker.yaml` đã có), áp DDL lên Cloud SQL, ghi lại SHA, revision, migration đã chạy | TV5 | Chưa deploy. Thăm dò 07/11: Cloud chưa có route pickup; Hosting vẫn là bundle ngày 02/11 | Biên bản có SHA khớp `develop`, revision API và Worker, bundle Hosting mới |
| Sau deploy | 9 | Worker chạy với PostgreSQL thật, không rơi về bộ nhớ; một mẫu GPS thấy ở `location_history` và `current_locations` | TV2; TV5 cấu hình runtime | Code Worker của Na (camelCase) đã vào `develop` ngày 09/11 | Một `eventId` trong SQL; restart instance vẫn đọc lại được |
| Sau deploy | TV6 | Chạy lại toàn bộ ca của tuần 7 trên Cloud với tài khoản demo: TC01, TC02, TC03, TC06.1, TC10 và GPS lưu SQL | TV6 | Chờ đợt deploy | Bảng kết quả Cloud ghi SHA và revision |

Đã xong (giữ để đối chiếu):

| # | Việc | Người làm | Trạng thái |
| --- | --- | --- | --- |
| 1 | API pickup `POST /v1/shipments/{id}/pickup` | TV1 | Xong: vào `develop` ngày 08/11 (PR #23 đến #25); TV6 chạy local 11/11 PASS |
| 2 | API deliver `POST /v1/shipments/{id}/deliver` | TV1 | Xong, như mục 1 |
| 3 | `statusHistory` có PICKED_UP và DELIVERED | TV1 | Xong; TC06.1 PASS local đủ chuỗi |

Không chặn tuần 7:

| Mục | Nội dung | Người nhận | Ghi chú |
| --- | --- | --- | --- |
| TC03.4 đầy đủ | Ca Deliver đối đầu Fail cần API Fail (việc tuần 9 của TV1, W9-TV1-01) | TV1 | Không chặn tuần 7 |
| Nhãn test | Test của TV1 ghi nhãn TC03.2 và TC03.3 ngược với đặc tả VI.14 | TV1 | Chỉ là nhãn, nội dung test đúng; TV1 tự đổi nếu muốn |

Thứ tự: xong mục 8 và 10 trước (chặn deploy), song song 4, 5, 6; rồi đợt deploy (mục 7); cuối cùng các việc sau deploy. Mục 12 cũ (deploy lại Hosting) đã gộp vào đợt deploy.

## Còn thiếu và rủi ro

- Pickup và deliver đã có từ 08/11; TC03.1–TC03.3, TC06.1 và TC10 đã PASS local ngày 11/11. Fail chưa có nên TC03.4 chỉ chạy phần Deliver đồng thời.
- Worker có chế độ lưu bộ nhớ; log ACK chưa chứng minh đã ghi SQL. Cần xác nhận runtime dùng PostgreSQL.
- Sheet ghi TV5 triển khai push subscription, code hiện dùng pull; nhóm cần chốt.
- Cloud mới có smoke không đăng nhập (route có mặt, 401 đúng, CORS đúng). Chưa có ca nào chạy với token thật. Bundle Hosting `/driver` vẫn là `index-CCoMdCpR.js` như ngày 02/11, chưa thấy frontend mới.
- GPS đi qua queue tới SQL chưa kiểm được trên máy: không có Docker và chưa cài component Pub/Sub emulator của gcloud (cài sẽ sửa cấu hình máy nên tôi không tự làm).
