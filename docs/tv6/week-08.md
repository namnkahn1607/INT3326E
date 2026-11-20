# Tuần 8 (09/11–15/11)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: FALSE. Checkpoint nhóm: Customer thấy vị trí tài xế cập nhật gần real-time trên Cloud. Nguồn giao việc: `tai-lieu/giao-viec-tuan-8.pdf` (bản giao việc tuần 8 của nhóm).

## Việc của TV6 theo bản giao việc

Điều phối và kiểm thử:

- Theo dõi TV5 deploy, chốt SHA, review PR API09.
- QA tracking: đúng chủ đơn xem được; Customer khác và tài xế khác bị 403; chưa có GPS; stale; gán lại tài xế; đơn đã kết thúc.
- Test thủ công GPS trùng và sai thứ tự, đối chiếu dữ liệu trong SQL.
- Regression AC01–AC10 trên Cloud. Mỗi lỗi có ca test, dữ liệu tái hiện, mức ảnh hưởng, người sửa.

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng 14/11 |
| --- | --- | --- | --- | --- | --- |
| W8-TV6-01 | Theo dõi deploy: thăm dò Cloud, chốt SHA và revision | TV5 deploy từ `bbdfe83` | Bảng trạng thái Cloud theo ngày | NF12 | Thăm dò 14/11 và 15/11: Hosting đã lên bản 13/11; API chưa có tracking và `/health`. Chưa nhận SHA, revision từ TV5 |
| W8-TV6-02 | Review PR API09 `GET /v1/shipments/{id}/tracking` | PR của TV1 | Nhận xét trên PR | FR05, AC05, SC05 | Đã review 15/11 (TV1 đẩy thẳng vào `develop`, không có PR): đạt yêu cầu, có ghi chú bên dưới |
| W8-TV6-03 | QA tracking: chủ đơn 200; Customer khác, tài xế khác 403; chưa có GPS; stale; reassign; terminal | API09 trên `develop` | Bảng kết quả TC05.1–05.3 | AC05, NF09 | Đã chạy local 15/11 (PASS 8/8); chưa chạy Cloud vì Cloud chưa có API09 |
| W8-TV6-04 | GPS trùng và sai thứ tự đi qua Worker, đối chiếu SQL | Worker trên `develop`, file SQL 001 và 002 | Manifest, bảng đối chiếu SQL | AC04, NF08, TC04.3–04.5, LT06 | Đã chạy local 14/11 (PASS); chưa chạy Cloud |
| W8-TV6-05 | Regression AC01–AC10 trên Cloud | Đợt deploy của TV5, tài khoản demo ba role | Bảng lỗi: ca test, dữ liệu tái hiện, mức ảnh hưởng, người sửa | AC01–AC10 | Đã chạy trên Cloud 20/11: luồng chính AC01–AC06 và AC10 (tài xế không được gán) đạt; AC07, AC09 chưa kiểm được qua giao diện; AC08 lỗi UI; ca Customer khác chưa chạy vì chỉ có một tài khoản Customer |

## Đã làm được

### W8-TV6-05: regression trên Cloud (20/11/2026, 13:20–13:35 giờ Việt Nam)

Môi trường: Hosting `https://int3326e.web.app` (bundle `index-BLeSH4fI.js`, last-modified 20/11/2026 01:46 GMT), API `https://backend-service-wcvss3dnxa-as.a.run.app`, Cloud SQL `int3326esql` vừa được bật lại trước lượt chạy. Source `develop` lúc chạy: `888e9e8`. Chưa đọc được revision API và Worker đang nhận traffic (tài khoản dùng để kiểm không có quyền xem Cloud Run và Cloud SQL); bản ghi gần nhất trong `docs/coordination/week-08.md` là API `backend-service-00037-4c5`, Worker `worker-service-00026-xkd`. Cần TV5 xác nhận lại revision.

Cách chạy: thao tác giao diện thật bằng ba tài khoản demo (Customer, Admin, Driver), mỗi tài khoản một tab riêng; người dùng tự đăng nhập, TV6 không nhập mật khẩu. Mã HTTP đọc từ trình duyệt. GPS dùng chế độ Mô phỏng, dữ liệu đơn là dữ liệu giả có ghi "TV6 W8".

Đơn kiểm thử: `PF202611200DAG40`, ID `sh_01M7VSVBWM562CD2ZBHHYJHM0H`. Customer `usr_01M5SW7618CWKRAADEJZ7FAJX8`, Admin `usr_01M5SW7612Q3QZDNAY0AE7SWY9`, Driver `usr_01M5SW7617KAKAMEE4G0W50HRX`.

| AC | Ca | Tài khoản | Kết quả trên Cloud | Kết luận |
| --- | --- | --- | --- | --- |
| Trước khi bật DB | Danh sách đơn | Customer | `/v1/auth/me` 200, `/v1/shipments` 503 | Cloud SQL đang dừng thì mọi API cần DB trả 503 |
| AC01 | Tạo đơn qua form | Customer | `POST /v1/shipments` 201 lúc 13:21; tìm địa chỉ VIETMAP trả 5 kết quả | PASS |
| AC02 | Gán tài xế | Admin | `POST /v1/shipments/{id}/assign` 200 lúc 13:24; màn hình báo máy chủ đã xác nhận phân công | PASS |
| AC03 | Lấy hàng, giao hàng | Driver | `POST /pickup` 200 lúc 13:26 (Đang giao hàng); `POST /deliver` 200 lúc 13:31 (Giao thành công) | PASS |
| AC04 | Gửi GPS mô phỏng | Driver | 33 lần `POST /v1/locations`, cả 33 trả 202; màn hình: chấp nhận 33, chờ gửi 0 | PASS |
| AC05 | Tracking khi đang giao | Customer | `/tracking` 200, nhãn "GPS mới", vị trí tài xế đổi từ `21.028811, 105.805117` sang `21.028511, 105.804817` sau một chu kỳ polling | PASS. Vị trí đi được từ API qua Pub/Sub, Worker, SQL tới tracking |
| AC05 | Tracking khi đã giao | Customer | Trang ghi "Đơn đã kết thúc. Đã dừng theo dõi và ẩn vị trí tài xế", không còn vị trí tài xế | PASS |
| AC06 | Lịch sử đơn | Customer, Driver, Admin | Đủ 4 bước: tạo (Customer, 13:21), phân công (Admin, 13:24), lấy hàng (Driver, 13:26), giao (Driver, 13:31), đúng người thực hiện và tài xế | PASS |
| AC07 | Giao trễ | | Đơn kiểm thử không đặt hạn giao nên chưa kiểm được cờ giao trễ | NOT RUN |
| AC08 | Thông báo Customer | Customer | Trang Thông báo hiện "Dữ liệu minh họa", không gọi `GET /v1/notifications` | FAIL (UI chưa nối API, xem BUG-W8-03) |
| AC09 | ETA | Customer | Trang tracking không hiển thị ETA, chỉ ghi "Hạn giao dự kiến không phải ETA" | NOT RUN qua giao diện; API có trả ETA theo review 15/11 |
| AC10 | Tài xế không được gán mở đơn | Driver | Mở đơn `PF20261101R3YNHE` (chưa gán ai): `GET /v1/shipments/sh_01M6C3A0S47QRFKXF31TFFW6HF` trả 403, giao diện báo không còn quyền | PASS |
| AC10 | Customer khác mở đơn | | Cả 11 đơn trên Cloud thuộc cùng một Customer; không có tài khoản Customer thứ hai | NOT RUN |
| AC10 | Tài xế khác (sau gán lại) | | Hệ thống chỉ có một tài xế (`/v1/drivers` trả 1 dòng) nên không gán lại được | NOT RUN |
| AC10 | Không token | | `GET /v1/auth/me`, `/v1/shipments/{id}/tracking` trả 401 (thăm dò 17/11 và 20/11) | PASS |

### W8-TV6-05: regression local (17/11/2026)

Source `develop` tại `7a41c55`, PostgreSQL thật trên máy (loopback, cụm tạm đã xóa sau khi chạy), Firebase giả lập.

| Phần | Lệnh | Kết quả |
| --- | --- | --- |
| API, gồm các bộ SQL (`SHIPMENT_TEST_DATABASE_URL`, `TV6_ADMIN_TEST_DATABASE_URL`) | `npx vitest run` trong `apps/api` | 571 test: 561 đạt, 10 skip (7 ca Firebase Emulator chưa bật, 3 ca chỉ chạy ở chế độ khác), 0 lỗi |
| Worker, `packages/types`, `infra/pubsub` (`WORKER_TEST_DATABASE_URL`) | `npx vitest run` ở gốc repo | 174/174 đạt |
| Web | `npm test --workspace=@parcelflow/web` | 584/584 đạt |
| Tích hợp UI → Nest → PGlite | `npm run test:integration --workspace=@parcelflow/web` | 12/12 đạt |
| Typecheck API | `npm run typecheck --workspace=@parcelflow/api` | Đạt |

Bộ API phủ AC01–AC10 ở mức local: tạo đơn và idempotency (AC01), gán và gán lại (AC02), pickup và deliver (AC03), ingest GPS (AC04), tracking theo quyền (AC05), lịch sử (AC06), giao trễ (AC07), thông báo (AC08), ETA trong response tracking (AC09, chưa có ca riêng của TV6), xác thực và phân quyền (AC10). Chạy Web cần `NODE_OPTIONS=--no-experimental-webstorage` với Node 26.

Lượt chạy trên `7a41c55` vẫn còn BUG-W8-01. Ngay sau đó TV1 merge PR #38 (`fe02ad5`): ở nhánh no-op, đọc lại đơn bằng một câu SELECT mới sau khi có khóa, và gỡ `it.fails` ở TC03.4. Kiểm lại trên `ef93b55`: ca Deliver đồng thời (10 vòng mỗi lượt) đạt 3/3 lượt; toàn bộ API 561 đạt, 10 skip, 0 lỗi.

### W8-TV6-01: thăm dò Cloud lần 3 (17/11/2026 20:53 giờ Việt Nam)

| Kiểm tra | Kết quả | Kết luận |
| --- | --- | --- |
| API `GET /health` | 200 | Đã có route `/health` (PR #31) |
| API `GET /v1/shipments/{id}/tracking` không token | 401 | Đã có API09 trên Cloud (trước là 404) |
| Worker `GET /health` | 200 | Worker đang chạy |
| Cloud SQL `int3326esql` | Stopped từ 16:48 ngày 17/11 theo [báo cáo nghiệm thu Driver của TV4](../evidence/driver-cloud-week8/report.md) | Mọi API cần DB sẽ trả 503 cho đến khi bật lại |

Theo báo cáo của TV4: revision API `backend-service-00036-f67` (deploy 10:02 ngày 17/11), Worker `worker-service-00020-kht` (SHA `286f6db` theo bàn giao TV2), Hosting bundle `index-BIrSjnkZ.js`. Chưa có biên bản deploy của TV5 ghi SHA của image API.

### W8-TV6-02: review API09 (15/11/2026)

TV1 đưa API09 thẳng vào `develop` (commit `f083761` đến `584941a`, 14/11) nên không có PR để nhận xét; tôi review trên code. Phạm vi: `shipments.controller.ts`, `shipments-read.repository.ts` (hàm `tracking`), `shipment-response.mapper.ts` (`shipmentTrackingResponse`).

| Yêu cầu trong bản giao việc | Kết quả review |
| --- | --- |
| `GET /v1/shipments/{id}/tracking` trả 200, `Cache-Control: no-store` | Đạt |
| Quyền: chủ đơn, tài xế đang được gán, Admin; người khác 403; đơn không tồn tại 404 | Đạt. Lưu ý: kiểm 404 trước 403 nên người ngoài vẫn biết đơn có tồn tại hay không; bản giao việc không cấm |
| Đủ 13 key của SC05 | Đạt |
| Lộ vị trí theo trạng thái (CREATED, ASSIGNED, PICKED_UP, terminal) | Đạt |
| Stale khi tuổi mẫu tính từ `clientTimestamp` quá 30 giây; không có vị trí thì `isLocationStale = null` | Đạt |
| Đọc trong một snapshot; sau reassign không trả vị trí tài xế cũ | Đạt: một câu SELECT, `LEFT JOIN current_locations` theo `s."driverId"` hiện hành |
| ETA để tuần 9 | TV1 làm luôn ETA (Haversine, 20 km/h). Không sai, nhưng ETA chưa được TV6 kiểm (việc tuần 10) |

Ghi chú nhỏ cho TV1: đơn DELIVERED hoặc DELIVERY_FAILED trả `etaUnavailableReason: 'NOT_PICKED_UP'`, nghĩa không khớp với trạng thái; nên chốt lý do riêng cho đơn đã kết thúc hoặc ghi rõ trong OpenAPI.

### W8-TV6-03: QA tracking theo quyền (local, 15/11/2026)

Môi trường: PostgreSQL thật trên máy (loopback, cụm tạm đã xóa), schema từ `001` và `002`, Firebase giả lập, source `develop` tại `a9df87b`. Vị trí GPS được ghi thẳng vào `current_locations` để dựng từng tình huống. Test: `apps/api/src/qa/tracking.postgres.spec.ts` (chạy khi có `TV6_ADMIN_TEST_DATABASE_URL`). Kết quả 8/8 PASS.

| Ca | Kết quả |
| --- | --- |
| Chủ đơn, tài xế được gán, Admin: 200; Customer khác, tài xế khác: 403; không token: 401; đơn không tồn tại: 404; đủ 13 key SC05; `no-store` | PASS |
| CREATED: không tài xế, không vị trí | PASS |
| ASSIGNED chưa có GPS: vị trí null, `isLocationStale` null | PASS |
| ASSIGNED có GPS 5 giây trước: trả vị trí, không stale, `eta` null | PASS |
| PICKED_UP: GPS 5 giây trước không stale; GPS 31 giây trước có nhãn stale, `eta` null, lý do `LOCATION_STALE` | PASS |
| PICKED_UP chưa có GPS: vị trí null, lý do `LOCATION_MISSING` | PASS |
| Gán lại tài xế: không trả vị trí tài xế cũ, tài xế cũ 403; tài xế mới gửi GPS thì hiện vị trí mới | PASS |
| DELIVERED: không lộ vị trí với chủ đơn, tài xế, Admin dù tài xế vẫn còn GPS | PASS |

Toàn bộ API trên PostgreSQL thật: 571 test, 561 đạt, 10 skip, 0 lỗi, chạy 3 lượt liên tiếp đều ổn định. Typecheck đạt.

### Lỗi phát hiện

| Mã | Ca test | Dữ liệu tái hiện | Mức ảnh hưởng | Người sửa | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| BUG-W8-01 | TC03.4: hai `POST /v1/shipments/{id}/deliver` đồng thời của cùng tài xế hiện hành | Đơn PICKED_UP; gửi hai Deliver cùng lúc. Chạy dồn 60 vòng thì 59 vòng có một request trả 503 `SERVICE_UNAVAILABLE` thay vì 200 no-op | Trung bình. Dữ liệu vẫn đúng (chỉ một event DELIVERED, một thông báo, trạng thái không đổi) nhưng tài xế bấm lặp hoặc mạng gửi lại sẽ thấy lỗi giả | TV1 | Đã sửa 17/11 (PR #38, `fe02ad5`); TV6 kiểm lại đạt |

| BUG-W8-02 | Mọi bản đồ trên web Cloud (chọn địa chỉ, tracking) | Mở form tạo đơn hoặc trang chi tiết trên `int3326e.web.app`: nền bản đồ chỉ hiện "API KEY REQUIRED" của CARTO | Trung bình. Vẫn chọn được điểm và hiện marker, nhưng người dùng không thấy bản đồ | TV3 (cấu hình key CARTO), TV5 (build Hosting) | Mới, 20/11 |
| BUG-W8-03 | AC08: trang Thông báo của Customer | Mở `/customer/notifications`: trang ghi "Dữ liệu minh họa", hiện thông báo mẫu `#PF-89021`, không gọi `GET /v1/notifications` | Trung bình. Customer không thấy thông báo thật dù API đã có | TV3 | Mới, 20/11 |
Nguyên nhân: request thứ hai chờ khóa `FOR UPDATE`. Ở mức READ COMMITTED, khi request đầu commit, PostgreSQL đọc lại dòng `shipments` mới (DELIVERED) nhưng subquery `terminalAt` trong `SHIPMENT_PROJECTION` vẫn dùng snapshot cũ nên không thấy event DELIVERED, `terminalAt` ra null và `validateShipmentRow` ném 503 ở nhánh no-op (`shipments.repository.ts`, `transitionByDriver`). Hướng sửa gợi ý: ở nhánh no-op, đọc lại đơn bằng một câu SELECT mới (snapshot mới) trước khi dựng response. Pickup đồng thời có cùng nhánh no-op nhưng không bị vì PICKED_UP không cần `terminalAt`.

Test: trong `apps/api/src/qa/shipment-flow.postgres.spec.ts`, ca TC03.4 tách làm hai: kiểm tính toàn vẹn dữ liệu (PASS) và ca tái hiện lỗi đánh dấu `it.fails`. Khi TV1 sửa xong, ca `it.fails` sẽ báo lỗi để nhắc gỡ đánh dấu. Trước đó ca này chạy một vòng nên chỉ lộ lỗi khoảng 1/3 lượt chạy toàn bộ.

### W8-TV6-01: thăm dò Cloud lần 2 (15/11/2026 09:03 giờ Việt Nam)

| Kiểm tra | Kết quả | Kết luận |
| --- | --- | --- |
| `GET /healthz/` | 200 | API đang chạy |
| `GET /health` | 404 | Bản API trên Cloud chưa có route `/health` của PR #31 |
| `GET /v1/shipments/{id}/tracking` | 404 | Cloud chưa có API09; cần TV5 deploy lại từ `a9df87b` |
| Hosting `int3326e.web.app` | bundle `index-Dd8xiE_G.js`, last-modified 13/11/2026 18:06 GMT | Web đã được deploy lại so với lần thăm dò 14/11 |

### W8-TV6-04: GPS trùng và sai thứ tự (local, 14/11/2026)

Môi trường: PostgreSQL thật trên máy (loopback, cụm tạm đã xóa sau khi chạy), schema dựng từ `001-create-shipment.sql` và `002-create-gps-locations.sql`, source `develop` tại `bbdfe83`. Message đi đúng đường Worker: JSON → `GpsSubscriber` → `GpsProcessorService` → `GpsWriterRepository` → PostgreSQL. Không phải Cloud, không qua Pub/Sub thật.

Test: `apps/worker/src/qa/gps-duplicate-order.postgres.spec.ts`, chạy khi có `WORKER_TEST_DATABASE_URL`. Kết quả: 3/3 PASS. Chạy kèm test Worker có sẵn `gps-writer.postgres.spec.ts`: 5/5 PASS.

Manifest gửi theo thứ tự (t0 = 2026-11-14T03:00:00.123Z, r là `receivedAt`):

| Thứ tự | Mẫu | clientTimestamp | Kỳ vọng | Thực tế trong SQL |
| --- | --- | --- | --- | --- |
| 1 | A | t0 | Vào history và current | Đúng |
| 2 | B, trùng khóa A, tọa độ khác | t0 | Không thêm dòng, giữ tọa độ A | Đúng: history giữ lat 21.0001 của A |
| 3 | C, cũ hơn A 10 giây, đến muộn | t0 − 10s | Vào history, current không lùi | Đúng |
| 4 | D | t0 + 8s | Vào history, current chuyển sang D | Đúng |
| 5 | E, cùng thời điểm D nhưng viết `+07:00` | t0 + 8s | Chuẩn hóa UTC, trùng khóa D, không thêm dòng | Đúng |
| 6 | F, đúng biên r + 60s | r + 60s | Chỉ vào history, không chiếm current | Đúng |
| 7 | G, vượt biên 1 ms | r + 60s + 1ms | Bị loại, không lưu ở đâu, vẫn ACK | Đúng |
| 8 | D phát lại | t0 + 8s | Không thêm dòng | Đúng |

Kết quả cuối: `location_history` có 4 dòng (C, A, D, F), không có khóa `(driverId, clientTimestamp)` nào bị trùng; `current_locations` có 1 dòng là D. Cả 8 message đều được ACK, không message nào bị giữ lại hàng đợi.

Ghi chú: lần chạy đầu tôi đặt kỳ vọng sai cho mẫu tương lai (cho rằng mẫu vượt r + 60s vẫn vào history). Đặc tả ghi mẫu vượt r + 60s bị từ chối (API trả 400, Worker cũng loại), mẫu trong khoảng r < t ≤ r + 60s mới chỉ vào history. Đã sửa manifest theo đặc tả; Worker không có lỗi.

### W8-TV6-01: thăm dò Cloud (14/11/2026 00:18 giờ Việt Nam)

Chỉ gửi GET và POST không token, không tạo hay sửa dữ liệu.

| Kiểm tra | Kết quả | Kết luận |
| --- | --- | --- |
| `GET /healthz/` | 200 | API đang chạy |
| `GET /v1/auth/me`, `/v1/notifications` | 401 | Có Auth và API10 |
| `POST /v1/shipments/{id}/pickup`, `/deliver` | 401 | Có pickup và deliver của tuần 7 |
| `GET /v1/shipments/{id}/tracking` | 404 | Chưa có API09, đúng như bản giao việc |
| Hosting `int3326e.web.app` | 200, bundle `index-CCoMdCpR.js`, last-modified 11/10/2026 | Web chưa được deploy lại |
| Worker, Pub/Sub, bảng GPS trên Cloud SQL | Không thăm dò được từ ngoài | Chờ TV5 gửi SHA, revision, tên subscription, file SQL đã chạy |

## Còn thiếu và rủi ro

- Regression trên Cloud còn thiếu ba ca: Customer khác mở đơn (cần thêm một tài khoản Customer có row trong `users`), tài xế khác sau gán lại (cần thêm một tài khoản Driver), giao trễ (cần đơn có hạn giao). AC09 chỉ kiểm được khi giao diện hiển thị ETA.
- Chưa có revision API và Worker đọc trực tiếp cho lượt chạy 20/11; cần TV5 xác nhận.
- BUG-W8-02 và BUG-W8-03 chờ TV3, TV5 sửa rồi chạy lại.
- Cloud SQL đang bật sau lượt kiểm 20/11; người bật cần tắt lại nếu không dùng tiếp để tránh tốn phí.
- Muốn chạy test Worker, cần build `@parcelflow/types` trước (`npm run build --workspace=@parcelflow/types`), nếu không vitest báo `Failed to resolve entry for package "@parcelflow/types"`.
