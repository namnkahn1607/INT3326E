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
| W8-TV6-05 | Regression AC01–AC10 trên Cloud | Đợt deploy của TV5, tài khoản demo ba role | Bảng lỗi: ca test, dữ liệu tái hiện, mức ảnh hưởng, người sửa | AC01–AC10 | Chưa chạy: Cloud chưa có API09, chưa có tài khoản demo cho TV6. Đã phát hiện 1 lỗi ở local (TC03.4), xem bảng lỗi |

## Đã làm được

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
| BUG-W8-01 | TC03.4: hai `POST /v1/shipments/{id}/deliver` đồng thời của cùng tài xế hiện hành | Đơn PICKED_UP; gửi hai Deliver cùng lúc. Chạy dồn 60 vòng thì 59 vòng có một request trả 503 `SERVICE_UNAVAILABLE` thay vì 200 no-op | Trung bình. Dữ liệu vẫn đúng (chỉ một event DELIVERED, một thông báo, trạng thái không đổi) nhưng tài xế bấm lặp hoặc mạng gửi lại sẽ thấy lỗi giả | TV1 | Đã báo, chưa sửa |

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

- **Regression AC01–AC10 trên Cloud (W8-TV6-05) chưa chạy.** Cần TV5 deploy lại API từ `a9df87b` (để có API09 và `/health`), gửi SHA và revision, và có ba tài khoản demo DRIVER, CUSTOMER, ADMIN gửi cho TV6 qua kênh riêng (không đưa vào Git).
- **BUG-W8-01** chờ TV1 sửa; sau khi sửa, gỡ `it.fails` ở ca TC03.4 và chạy lại.
- QA tracking và GPS trùng, sai thứ tự mới chạy local; trên Cloud cần chạy lại sau đợt deploy và khi Worker có `DATABASE_URL` trỏ vào Cloud SQL.
- ETA của TV1 chưa được TV6 kiểm (TC09.x thuộc tuần 10).
- Muốn chạy test Worker, cần build `@parcelflow/types` trước (`npm run build --workspace=@parcelflow/types`), nếu không vitest báo `Failed to resolve entry for package "@parcelflow/types"`.
