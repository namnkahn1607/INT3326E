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
| W8-TV6-01 | Theo dõi deploy: thăm dò Cloud, chốt SHA và revision | TV5 deploy từ `bbdfe83` | Bảng trạng thái Cloud theo ngày | NF12 | Đã thăm dò 14/11; chờ TV5 gửi SHA, revision |
| W8-TV6-02 | Review PR API09 `GET /v1/shipments/{id}/tracking` | PR của TV1 | Nhận xét trên PR | FR05, AC05, SC05 | Chưa có PR |
| W8-TV6-03 | QA tracking: chủ đơn 200; Customer khác, tài xế khác 403; chưa có GPS; stale; reassign; terminal | API09 trên `develop` | Bảng kết quả TC05.1–05.3 | AC05, NF09 | Chờ API09 |
| W8-TV6-04 | GPS trùng và sai thứ tự đi qua Worker, đối chiếu SQL | Worker trên `develop`, file SQL 001 và 002 | Manifest, bảng đối chiếu SQL | AC04, NF08, TC04.3–04.5, LT06 | Đã chạy local 14/11 (PASS); chưa chạy Cloud |
| W8-TV6-05 | Regression AC01–AC10 trên Cloud | Đợt deploy của TV5, tài khoản demo ba role | Bảng lỗi: ca test, dữ liệu tái hiện, mức ảnh hưởng, người sửa | AC01–AC10 | Chờ deploy và tài khoản demo |

## Đã làm được

### W8-TV6-04: GPS trùng và sai thứ tự (local, 14/11/2026)

Môi trường: PostgreSQL thật trên máy (loopback, cụm tạm đã xóa sau khi chạy), schema dựng từ `001-create-shipment.sql` và `002-create-gps-locations.sql`, source `develop` tại `bbdfe83`. Message đi đúng đường Worker: JSON → `GpsSubscriber` → `GpsProcessorService` → `GpsWriterRepository` → PostgreSQL. Không phải Cloud, không qua Pub/Sub thật.

Test: `apps/worker/src/qa/week8-gps-duplicate-order.postgres.spec.ts`, chạy khi có `WORKER_TEST_DATABASE_URL`. Kết quả: 3/3 PASS. Chạy kèm test Worker có sẵn `gps-writer.postgres.spec.ts`: 5/5 PASS.

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

- **API09 chưa có PR** (TV1, hạn 15/11). W8-TV6-02 và W8-TV6-03 chưa bắt đầu được.
- **Deploy tuần 7 chưa xong** (TV5, hạn tối 14/11): web vẫn là bản 11/10; chưa có SHA, revision Worker, tên subscription. W8-TV6-05 chưa chạy được.
- **Tài khoản demo:** cần ba tài khoản DRIVER, CUSTOMER, ADMIN có `firebaseUid` khớp Firebase và đúng role để chạy regression trên Cloud. Thông tin đăng nhập gửi qua kênh riêng, không đưa vào Git.
- GPS trùng và sai thứ tự mới chạy local; trên Cloud cần chạy lại sau khi Worker có `DATABASE_URL` trỏ vào Cloud SQL.
- Muốn chạy test Worker, cần build `@parcelflow/types` trước (`npm run build --workspace=@parcelflow/types`), nếu không vitest báo `Failed to resolve entry for package "@parcelflow/types"`.
