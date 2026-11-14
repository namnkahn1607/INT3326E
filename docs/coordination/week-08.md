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

- **TV1** (14/11): đã triển khai `API09` (`GET /v1/shipments/:id/tracking`, `Cache-Control: no-store`), ẩn/hiện vị trí tài xế theo trạng thái và nhãn quá cũ (`> 30s` theo `statement_timestamp()`), tính ETA Haversine `20 km/h` khi `PICKED_UP` và GPS còn mới trong một snapshot SQL (`LEFT JOIN current_locations`), đồng bộ `docs/openapi.json` (`SC05` + `EtaDetails`) và thêm test SQL/HTTP/web integration (`assignments.postgres.spec.ts`, `shipment-flow.spec.tsx`). Kiểm tra mức local (PGlite / mock Firebase); PostgreSQL thật (`SHIPMENT_TEST_DATABASE_URL`) và Cloud chưa xác nhận.
