# Week 8 (09/11–15/11): giao việc

Mục lục: [Điều phối theo tuần](README.md)

**Checkpoint:** Customer thấy vị trí tài xế cập nhật gần real-time trên Cloud. Sheet ghi đây là ưu tiên tuyệt đối: trễ việc này thì load test tuần 9 trễ theo.

**Tình hình đầu tuần:**
- Code tuần 7 đã chốt ở PR #26 (`week/07`, `bbdfe83`).
- Trên Cloud mới có API bản mới. Web vẫn là bản 11/10. Worker, Pub/Sub và bảng GPS trên Cloud SQL chưa xác nhận.
- Đã có sẵn: Worker chống trùng (ON CONFLICT) và xử lý mẫu sai thứ tự, test trên PostgreSQL thật đạt; bản đồ tracking Leaflet và polling trên web; DLQ replay; script benchmark Pub/Sub.
- **Thiếu, đang chặn checkpoint:** API chưa có `GET /v1/shipments/{id}/tracking` (API09). Web đã gọi endpoint này, gọi lên Cloud trả 404.

**Quy ước chung:**
- Mỗi người làm trên nhánh riêng, mở PR vào `develop`, có ít nhất một người review.
- Mỗi PR kèm kết quả test của phần mình. Kết quả trên Cloud kèm URL hoặc revision.
- Không đưa mật khẩu, key, token vào Git hay nhóm chat.

---

## TV5: hoàn tất deploy tuần 7, rồi theo dõi hệ thống (GẤP, đang chặn cả nhóm)

**Phải xong trước, chậm nhất tối 14/11:**
1. **Cloud SQL:**
   - Kiểm tra đã đủ 5 bảng của `001`. Thiếu bảng nào thì báo trước, không chạy lại cả file lên DB đang có dữ liệu.
   - Chạy `packages/database/sql/002-create-gps-locations.sql`.
2. **Worker:** deploy từ `bbdfe83`, đặt `DATABASE_URL` trỏ vào Cloud SQL. Thiếu biến này thì Worker chỉ ghi vào bộ nhớ.
3. **Pub/Sub:** subscription của topic GPS trỏ vào Worker. Code hiện dùng pull. Nếu đổi sang push thì báo TV2 trước.
4. **Web:**
   - Tạo `apps/web/.env.production.local` với `VITE_API_URL`, `VITE_FIREBASE_*`, `VITE_VIETMAP_API_KEY`.
   - Trong `apps/web`, chạy: `npm run build && npx --yes firebase-tools deploy --only hosting --project int3326e`.
   - Mở int3326e.web.app thấy trang đăng nhập "Chào mừng trở lại" là đã lên.
5. **Tài khoản demo:** 3 tài khoản DRIVER, CUSTOMER, ADMIN có `firebaseUid` khớp Firebase và đúng role claim.
6. **Gửi vào nhóm:** SHA đã deploy, revision API và Worker, tên subscription, các file SQL đã chạy.

**Việc tuần 8:**
- Theo dõi backlog và độ trễ Pub/Sub trên Cloud Monitoring, chụp dashboard.
- Chỉnh concurrency và max instances của Cloud Run cho API và Worker, ghi lại giá trị trước và sau.
- Gắn thêm tag SHA cho image, không chỉ dùng `:latest`. Ghi cách rollback về revision trước, thử một lần.
- Deploy lại API và web khi TV1 và TV3 xong tracking.

**Đầu ra:** biên bản deploy (SHA, revision, config), ảnh dashboard, các bước rollback đã thử.

---

## TV1: viết API09 tracking (GẤP)

Đặc tả giao API09 cho TV1 (Phần tuần 7–8: "Hoàn thiện tracking response, ownership và điều kiện lộ vị trí theo trạng thái"). Trong `apps/api/src/modules/location/` đã có sẵn DTO `ShipmentTrackingResponseDto` và `LocationRepository` đọc `current_locations`.

**Endpoint:** `GET /v1/shipments/{id}/tracking`, trả 200.
- **Quyền:** Customer chủ đơn, tài xế đang được gán, Admin. Người khác trả 403, đơn không tồn tại trả 404.
- **Response (SC05):** đủ các key `shipmentId`, `status`, `driverId`, `pickupLocation`, `dropoffLocation`, `currentDriverLocation`, `lastLocationUpdatedAt`, `locationClientTimestamp`, `isLocationStale`, `eta`, `etaUnavailableReason`, `expectedDeliveryAt`, `isLate`.
- **Điều kiện lộ vị trí theo trạng thái:**

| Trạng thái | Vị trí | ETA |
| --- | --- | --- |
| CREATED | null | null |
| ASSIGNED có GPS | mẫu mới nhất, có thể stale | null |
| PICKED_UP có GPS mới | mẫu mới nhất | có (nếu kịp làm, không thì null kèm lý do) |
| PICKED_UP thiếu GPS hoặc stale | null, hoặc mẫu cũ có nhãn stale | null |
| DELIVERED, DELIVERY_FAILED | null | null |

- **Stale:** tuổi mẫu tính từ `clientTimestamp` vượt quá 30 giây. Không có vị trí thì `isLocationStale = null`.
- **Đọc trong cùng một snapshot:** quyền, trạng thái, tài xế hiện hành và vị trí phải lấy trong một SELECT join, hoặc trong transaction REPEATABLE READ. Sau khi gán lại tài xế thì không được trả vị trí của tài xế cũ.
- ETA (Haversine, 20 km/h) là việc tuần 9. Tuần này để `eta = null` là được, nhưng giữ đủ key.

**Test:** đúng quyền và sai quyền; từng trạng thái trong bảng; stale và không stale; gán lại tài xế; không có GPS. Chạy được trên PostgreSQL thật, dùng `001` và `002`.

**Thêm:**
- Cập nhật `docs/openapi.json` cho API09.
- Review PR của TV2. Sửa lỗi luồng shipment khi TV6 báo.

**Hạn:** mở PR trước 15/11. Xong thì báo TV3 và TV5.

---

## TV2: kịch bản lỗi của Worker (REC02–REC05)

Chống trùng và xử lý sai thứ tự đã có trong code, đã test trên PostgreSQL thật. Tuần này kiểm trên Cloud và các tình huống lỗi.

1. **Kiểm trên Cloud** (sau khi TV5 deploy): gửi một mẫu GPS qua `POST /v1/locations`, dò theo cùng `eventId` qua Pub/Sub, log Worker, `location_history` và `current_locations`. Chụp bằng chứng.
2. **Chạy và ghi kết quả:**
   - REC02: restart Worker giữa chừng, message không mất và không ghi trùng.
   - REC03: Cloud SQL không kết nối được, message không bị ACK. Có SQL lại thì xử lý tiếp.
   - REC04: message lỗi (poison) vào DLQ, không làm kẹt hàng đợi.
   - REC05: gửi trùng và gửi sai thứ tự. Mỗi khóa chỉ có một dòng history, và `current_locations` không lùi về mẫu cũ hơn.
3. **Runbook DLQ replay:** viết các bước replay, giữ `eventId` và thời gian gốc, phân loại lỗi invalid và lỗi tạm thời, đối chiếu số dòng sau khi replay.
4. **Chốt với TV5:** dùng pull hay push, rồi ghi quyết định vào docs.
5. **(Tùy chọn)** SQL dọn `location_history` cũ hơn 7 ngày.

**Đầu ra:** bảng kết quả REC02–REC05 (ghi rõ chạy local hay Cloud), runbook DLQ, bằng chứng một `eventId` đi hết bốn chặng.

---

## TV3: nối bản đồ tracking của Customer vào API thật

Bản đồ Leaflet, polling và panel tracking đã có trên web (`components/map/TrackingMap.tsx`, `ShipmentTrackingPanel.tsx`, `hooks/usePollingTracking.ts`), nhưng đang chờ API09.

1. **Thống nhất response với TV1** ngay đầu việc. Chạy local với API của TV1 trước, không chờ deploy.
2. **Trang chi tiết đơn của Customer và Admin:**
   - Polling 5–10 giây, chỉ một request chạy tại một thời điểm, không tạo thêm interval khi đổi trang.
   - Hủy request và timer khi rời trang, hoặc khi đơn đã giao hoặc giao thất bại.
   - Hiển thị đủ các trạng thái: đang tải, chưa có vị trí, vị trí cũ (stale, có nhãn), lỗi mạng, 403.
   - Gán lại tài xế thì marker chuyển sang tài xế mới. Đơn đã kết thúc thì xóa marker tài xế.
3. **Kiểm journey Customer và Admin:** đúng quyền, không hiện vị trí không được phép.

**Đầu ra:** PR kèm test và ảnh chụp các trạng thái ở 390px và 1440px. Sau khi deploy, kiểm lại một lần trên Cloud.

---

## TV4: trường hợp đặc biệt khi gửi GPS, và bắt đầu load test

1. **GPS emitter:**
   - Bỏ qua mẫu sai (tọa độ ngoài khoảng cho phép, độ chính xác quá kém) và mẫu cũ.
   - Mất mạng: giữ buffer, có mạng lại thì gửi bù, có giới hạn kích thước buffer.
   - Đổi tài khoản: buffer không lẫn giữa các tài xế.
   - Ghi rõ giới hạn của trình duyệt: quyền vị trí, tab chạy nền, HTTPS.
2. **Load test:** bắt đầu script k6 cho `POST /v1/locations`, dựa vào `infra/pubsub/worker-load-benchmark.mjs`. Script phải chạy lại được, có tham số số tài xế và tần suất gửi. Tuần này chỉ cần chạy thử nhỏ, đo thật là việc tuần 9.
3. **Kiểm journey Driver trên Cloud** sau khi TV5 deploy: nhận hàng, giao hàng, GPS gửi lên đúng.

**Đầu ra:** PR emitter kèm test; script k6 nằm trong `infra/` kèm hướng dẫn chạy.

---

## TV6: điều phối và kiểm thử

- Theo dõi TV5 deploy, chốt SHA, review PR API09.
- QA tracking: đúng chủ đơn xem được; Customer khác và tài xế khác bị 403; chưa có GPS; stale; gán lại tài xế; đơn đã kết thúc.
- Test thủ công GPS trùng và sai thứ tự, đối chiếu dữ liệu trong SQL.
- Regression AC01–AC10 trên Cloud. Mỗi lỗi có ca test, dữ liệu tái hiện, mức ảnh hưởng, người sửa.

---

## Thứ tự và hạn

| Khi nào | Việc |
| --- | --- |
| Ngay | TV5 hoàn tất deploy tuần 7. TV1 viết API09. TV2, TV4 làm song song. |
| Khi API09 có PR | TV3 nối bản đồ (chạy local trước). TV6 review. |
| 15/11 | Merge vào `develop`. TV5 deploy lại API và web từ một SHA. |
| Sau deploy | Cả nhóm kiểm trên Cloud. Customer thấy marker tài xế di chuyển là đạt checkpoint. |

## Thực tế từng người

- **TV4 (18/11, đóng W707):** Người dùng đã đăng nhập SQL Studio database
  `parcelflow`. Ban đầu history chỉ có seq 1–7 và 17; 9 mẫu còn lại ở DLQ.
  Console Worker thực tế min 0, Request-based, khác cấu hình Streaming Pull
  đã bàn giao. Người dùng chỉ cho bật tạm min 1/Instance-based tối đa 20 phút:
  Worker `00026-xkd` nhận 100% traffic từ 07:50:36. Phát lại nguyên payload
  seq 8–16; history đủ 17 seq/eventId/timestamp riêng biệt, current đúng seq 11
  `evt_448a87a7-8d70-4b87-a419-2bf4ec2092b1`, khớp API/Worker/history/current.
  Các mẫu future giữ history-only; không sửa thời gian cho có vẻ mới.
  Đã xác nhận hoàn nguyên min 0/Request-based trước 08:08:33, trong hạn; không
  ACK/xóa DLQ, không đổi schema/IAM/secret. W707 đạt có phục hồi DLQ, checkpoint
  marker Customer/Admin và quyết định vận hành nền lâu dài vẫn mở cho nhóm.
  Check toàn repo đạt (166 Worker/shared/load, 465 API, 584 web, 2 health e2e;
  125 ca môi trường bỏ qua). [Bằng chứng SQL/log/ảnh](../evidence/driver-cloud-week8/evening-report.md).

- **TV4 (17/11, kiểm lại buổi tối):** Console xác nhận DB Runnable sau lần
  Start 20:57:04 của người dùng. GPS mô phỏng hơn hai phút: 17/17 accepted,
  pending 0; Offline khoảng 30 giây giữ buffer, online gửi hết. Đã lưu ảnh
  390 CSS px và response 202. API `backend-service-00037-4c5` Broker Confirmed
  cùng eventId `evt_3de4d199-19ac-444d-8779-5f93382eddaf` với Worker
  `worker-service-00025-hnp`. Lỗi publish buổi chiều không tái hiện. Worker
  từng timeout kết nối SQL và nhận lại message; mẫu cuối history-only do
  lệch giờ. SQL Studio cần đăng nhập DB; đang chờ người dùng/TV5 cung cấp
  phiên truy cập để đối chiếu hai bảng. W707 chưa đóng, chưa kiểm marker
  Customer/Admin; không đổi IAM/schema/secret hoặc deploy trong lượt này.
  [Bằng chứng và truy vấn chỉ đọc](../evidence/driver-cloud-week8/evening-report.md).

- **TV4 (17/11, chẩn đoán tiếp W707):** nhánh `fix/gps-publish-diagnostics`
  bổ sung log mã gRPC an toàn cho API08, giữ dòng `eventId`; không đổi contract,
  quyền client hoặc điều kiện 202 sau broker confirm. Test API08/diagnostics
  local 69/69 đạt, broker/Firebase/lookup mock. Check toàn repo đạt (166
  Worker/shared/load, 465 API, 584 web, 2 health e2e; 125 ca môi trường bỏ qua),
  chưa deploy. Đọc lại Console:
  `gps-events`/`gps-events-sub` tồn tại, không gắn schema; API service account
  chưa có role Publisher cấp project. Tài khoản Editor hiện tại không xem
  được topic IAM, nút Grant access bị vô hiệu hóa và Policy Troubleshooter
  báo thiếu quyền. Chưa kết luận quyền hiệu lực publish; cần TV5/người quản
  lý IAM kiểm tra trước khi sửa quyền, rồi nghiệm thu lại cùng eventId.
  Không bật DB hoặc thay cấu hình Cloud trong lượt chẩn đoán này.

- **TV4 (17/11, nghiệm thu Cloud):** Đã khôi phục Cloud SQL `int3326esql`
  theo cho phép của người dùng (Start 15:51:41, hoàn tất 15:55:37, Runnable),
  giải quyết lỗi đọc đơn. **W713 đạt** với đơn mới `PF20261117CGDANJ`:
  Customer tạo 16:21, Admin gán 16:28, Driver lấy hàng 16:36 và giao 16:39.
  Cả ba role đọc lại khớp trạng thái/lịch sử/ghi chú; Customer/Admin dừng
  tracking khi kết thúc. API revision `backend-service-00036-f67`.
  **W707 vẫn BLOCKED**: GPS sau khôi phục DB tạo 6 mẫu, accepted 0, pending 6;
  log API lỗi publish và trả 503. Đã Stop và rời dashboard để dọn buffer.
  Cần TV5 kiểm tra quyền hiệu lực publish trên topic `gps-events` cho
  `cloud-run-backend@int3326e.iam.gserviceaccount.com`; chưa xem được topic
  IAM, chưa có eventId 202 hoặc tài khoản SQL để đối chiếu đầu cuối.
  Sau nghiệm thu đã Stop DB theo yêu cầu người dùng, xác nhận Stopped lúc
  16:48:49; cần bật lại khi kiểm tiếp. Không đổi IAM/secret/schema. Check toàn repo đạt trên
  `8168a1a` (code `2ed8f04`): Worker/shared/load 166, API 454, web 584,
  health e2e 2; 125 ca môi trường bị bỏ qua. [Bằng chứng Cloud](../evidence/driver-cloud-week8/report.md).

Tích hợp ngày 15/11 theo yêu cầu người dùng: emitter `2585638` và k6 `930e59e`
được kết hợp trên `merge/gps-week8`, base `develop@f28365d`. Chỉ có xung đột
ở file tuần này, đã giữ đủ hai báo cáo; code khớp hai nhánh gốc. Check toàn
repo đạt (web 584, API 454, Worker/shared/load 166, health e2e 2; 116 ca môi
trường bị bỏ qua). Chạy lại k6 thật → Nest HTTP local đạt 5/5 kịch bản, 6/6
accepted, Firebase/lookup/PubSub mock. [Bằng chứng bản kết hợp](../evidence/gps-week8-merge/report.json).
Các ghi nhận chưa merge bên dưới là mốc bàn giao ban đầu; lượt tích hợp này
đã được người dùng yêu cầu merge/push vào develop, không deploy.

- **TV4** (15/11): hoàn thiện emitter trên `feature/gps-emitter-reliability`,
  base `develop@f28365d`: lọc mẫu sai/cũ/accuracy, buffer RAM tối đa 100 mẫu/
  5 phút, gửi bù giữ timestamp/seq với backoff, Stop/Start, cách ly token và
  buffer theo tài khoản. `npm.cmd run check` exit 0 (web 584, API 454,
  Worker/shared 122, health e2e 2; 116 ca môi trường bị bỏ qua). Bộ chuyên biệt
  113/113, Edge 47/47 với Auth/API mock; chưa nghiệm thu Cloud. Xem
  [bàn giao và lệnh chạy lại](../features/gps-emitter-reliability-handoff.md).
  Script k6 và journey Driver trên Cloud vẫn còn mở, không thuộc lượt emitter.
  Sau bàn giao, người dùng cho phép commit/push nhánh; chưa merge/deploy.

Ghi nhận phần script k6 của **TV4** ngày 15/11: nhánh `test/gps-ingest-load`
tạo riêng từ `develop@f28365d`, không kéo theo PR emitter. Có tham số số Driver,
chu kỳ/thời gian, token riêng, kiểm tra 202 đúng body và JSON summary. 44/44
test config/contract; k6 thật → Nest HTTP local đạt 5/5 kịch bản, 6/6 accepted
từ 2 Driver × 3 mẫu. Firebase/lookup/PubSub mock; không Worker/SQL/Cloud.
`npm.cmd run check` exit 0 (166 Worker/shared/load, 454 API, 538 web, 2 health
e2e; 116 ca môi trường bị bỏ qua). [Hướng dẫn và chạy lại](../../infra/load/README.md),
[bằng chứng](../evidence/gps-ingest-load/report.json). Máy hiện tại đã có k6
portable trong `.vitest/tools/k6`, không cài hệ thống hoặc đưa binary/token
vào Git. Nghiệm thu Driver Cloud/hiệu năng thật còn mở. Sau bàn giao người dùng
yêu cầu commit/push nhánh; chưa merge hoặc deploy.

- **TV1** (14/11): đã triển khai `API09` (`GET /v1/shipments/:id/tracking`, `Cache-Control: no-store`), ẩn/hiện vị trí tài xế theo trạng thái và nhãn quá cũ (`> 30s` theo `statement_timestamp()`), tính ETA Haversine `20 km/h` khi `PICKED_UP` và GPS còn mới trong một snapshot SQL (`LEFT JOIN current_locations`), đồng bộ `docs/openapi.json` (`SC05` + `EtaDetails`) và thêm test SQL/HTTP/web integration (`assignments.postgres.spec.ts`, `shipment-flow.spec.tsx`). Kiểm tra mức local (PGlite / mock Firebase); PostgreSQL thật (`SHIPMENT_TEST_DATABASE_URL`) và Cloud chưa xác nhận.
- **TV3** (15/11): tích hợp frontend `f270154` với `develop` `ba230a3`, giữ tracking Leaflet/polling Customer/Admin, map không dựng lại khi refresh/lỗi tạm thời và không giữ GPS cũ khi lỗi. Giải quyết một conflict ở tài liệu tracking, giữ cấu trúc `docs/features/`. `npm run check` đạt (frontend 538, API 454, Worker/shared 122, health e2e 2 test); 116 ca PostgreSQL/emulator bị bỏ qua do chưa cấu hình môi trường. Bộ tích hợp web/Nest/PGlite đạt 12/12, có API09 lifecycle/reassign. Bản đồ và tương tác UI đã kiểm bằng Auth/API mock riêng, không phải bằng chứng Cloud. Chờ deploy và đối chiếu mẫu GPS qua Worker để chốt checkpoint.
