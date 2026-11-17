# Báo cáo Tuần 8 - Kịch bản lỗi Worker (REC02–REC05) & Runbook DLQ

| Người thực hiện | Vai trò | Trọng tâm bàn giao tuần 8 | Nhánh thực hiện |
| :--- | :--- | :--- | :--- |
| **Nguyễn Lê Na (TV2)** | Backend / GPS Worker | Kịch bản lỗi Worker (REC02–REC05), Runbook DLQ Replay, Chốt cơ chế Streaming Pull | `feature/tv2-week8-docs` |

---

## 1. Luồng 4 chặng và hiện trạng Cloud

Luồng GPS: Driver gửi `POST /v1/locations` → API publish lên topic `gps-events` → Worker nhận qua subscription `gps-events-sub` (Streaming Pull) → ghi `location_history` và `current_locations` trên Cloud SQL.

### 1.1. Bằng chứng trên Cloud (16/11/2026)

| Chặng | Kết quả | Bằng chứng |
| --- | --- | --- |
| 1–2. Driver → API → Pub/Sub | **Chưa kiểm** | Cần Driver đăng nhập gửi GPS qua `POST /v1/locations`, lấy `eventId` từ phản hồi 202 |
| 2–3. Pub/Sub → Worker | Đạt | Publish tay một message vào topic `gps-events` trên console |
| 3–4. Worker → Cloud SQL | Đạt (`current_locations`) | `SELECT * FROM current_locations` có dòng `eventId = evt_na_live_test_01`, `driverId = usr_01M5SW7617KAKAMEE4G0W50HRX`, `seq = 1` |

Còn thiếu: kiểm cùng `eventId` trong `location_history`, và một lần đi đủ 4 chặng bắt đầu từ API.

### 1.2. Bản đang chạy trên Cloud (theo TV5, 17/11/2026)

- SHA: `286f6db`.
- API: `backend-service-00035-b6c`. Worker: `worker-service-00020-kht`.
- `DATABASE_URL` ghim Secret Manager version 4. Sự cố 16/11: version 5 bị destroy làm Worker không khởi động được.
- Pub/Sub: topic `gps-events` → subscription `gps-events-sub`, Streaming Pull.
- Cloud SQL đã có bảng của `002-create-gps-locations.sql`.

## 2. Bảng kết quả chạy kịch bản phục hồi lỗi (REC02–REC05)

Toàn bộ các ca kiểm thử phục hồi lỗi được tự động hóa tại file:  
`apps/worker/src/integration/recovery-scenarios.spec.ts`.

### 2.1. Bảng kết quả tổng hợp

| Mã kịch bản | Mô tả tình huống lỗi | Hành vi thiết kế của Worker | Kết quả kiểm thử | Môi trường |
| :--- | :--- | :--- | :---: | :---: |
| **REC02** | Cơ sở dữ liệu bị lỗi / kết nối Cloud SQL chập chờn | Transaction ghi DB thất bại $\rightarrow$ Worker tự động rollback toàn bộ thay đổi $\rightarrow$ phát tín hiệu **NACK** về Pub/Sub $\rightarrow$ Pub/Sub phân phối lại message $\rightarrow$ Worker xử lý thành công ở lần thử tiếp theo, không mất dữ liệu. | **PASS** (100%) | Local Integration |
| **REC03** | Worker bị sập (crash / restart đột ngột) giữa chừng | Message chưa được ACK sẽ được Pub/Sub gửi lại (redelivery). Nhờ cơ chế **idempotent first-write-wins**, message gửi lại được ghi nhận an toàn, không sinh lỗi trùng lặp dữ liệu. | **PASS** (100%) | Local Integration |
| **REC04** | Tin nhắn đến sai thứ tự (Out-of-order) & Tin nhắn bị lặp (Duplicate) | • `location_history`: Giữ nguyên bản ghi ban đầu, bỏ qua bản ghi trùng lặp.<br>• `current_locations`: Kiểm tra điều kiện `candidateTimestamp > currentTimestamp`; nếu tin nhắn cũ đến sau, Worker chỉ lưu vào history mà **không lùi thời gian/vị trí hiện tại** về quá khứ. | **PASS** (100%) | Local Integration |
| **REC05** | Gói tin rác (Poison Pill: JSON hỏng, sai biên tọa độ, clock skew > 60s) | Worker bắt ngoại lệ, ghi log cảnh báo, chuyển tiếp message lỗi về Dead Letter Queue (DLQ) hoặc loại bỏ an toàn; **hàng đợi không bị nghẽn (unblocked)**, các message hợp lệ tiếp theo vẫn được xử lý bình thường. | **PASS** (100%) | Local Integration |

### 2.2. Lệnh thực thi & Log kiểm chứng
Lệnh chạy kiểm thử:
```bash
npx vitest run apps/worker/src/integration/recovery-scenarios.spec.ts
```

Log trích xuất:
```text
 RUN  v4.1.11 E:/INT3326E
 ✓ apps/worker/src/integration/recovery-scenarios.spec.ts (5 tests) 22ms
   ✓ REC02: Database connection drop or transaction failure triggers rollback, nack, and subsequent retry succeeds
   ✓ REC03: Worker crash simulation preserves unacknowledged message and processes redelivery idempotently
   ✓ REC04: Duplicate delivery and out-of-order arrival preserve canonical record and prevent regression
   ✓ REC05: Poison pills (malformed JSON, invalid coords, clock skew >60s) are quarantined without stalling valid stream
   ✓ DLQ Replay Runbook: Dead-letter simulation replay verifies poison quarantine and idempotent reprocessing

Test Files  1 passed (1)
     Tests  5 passed (5)
  Duration  1.76s
```

---

## 3. Runbook DLQ

Xem [runbook DLQ](dlq-runbook.md).

---

## 4. Quyết định kiến trúc: Chốt cơ chế Streaming Pull với TV5

TV2 đã thống nhất và chốt lựa chọn cơ chế **Google Cloud Pub/Sub Streaming Pull** thay vì HTTP Push Webhook cho GPS Worker.

### So sánh kỹ thuật & Lý do lựa chọn:

| Tiêu chí | Streaming Pull (Được chọn) | HTTP Push Webhook (Loại bỏ) |
| :--- | :--- | :--- |
| **Kiểm soát luồng (Flow Control / Backpressure)** | **Rất tốt**: Worker chủ động kéo message theo năng lực xử lý (hạn chế tối đa nguy cơ cạn kiệt kết nối DB). | **Kém**: Pub/Sub tự đẩy dồn dập qua HTTP, dễ làm sập Worker hoặc quá tải Cloud SQL khi có lượng lớn GPS đổ về. |
| **Gia hạn ACK Deadline (Lease Management)** | **Tự động**: Thư viện `@google-cloud/pubsub` tự động gia hạn deadline trong khi Worker đang xử lý batch DB. | **Phức tạp**: Cần trả lời HTTP 200 trong vòng 10-60s; nếu query DB lâu sẽ bị Pub/Sub coi là lỗi và đẩy lại. |
| **Bảo mật mạng** | **An toàn cao**: Worker chạy ngầm trong mạng nội bộ VPC, không cần mở port HTTP ra ngoài Internet. | **Kém hơn**: Phải expose public HTTPS URL để Google Pub/Sub gọi webhook vào. |
| **Tích hợp DLQ** | Tích hợp gốc và tự nhiên với Dead Letter Topic của Google Cloud. | Cần cấu hình retry HTTP status codes thủ công. |

* **Kết luận bàn giao**: TV5 giữ nguyên Worker dạng background daemon chạy bằng lệnh `npm run start:prod` (đã cấu hình sẵn trong `apps/worker/Dockerfile`), chỉ cần cấp quyền IAM `roles/pubsub.subscriber` cho Service Account của Worker.

---

## 5. Dọn `location_history` cũ hơn 7 ngày (tùy chọn)

Script: [`packages/database/sql/cleanup-old-gps-history.sql`](../../packages/database/sql/cleanup-old-gps-history.sql). Không xóa `current_locations`. Có thể gắn vào Cloud Scheduler chạy hằng ngày; chưa cấu hình.

## 6. Hạn chế đã biết

- Test REC02–REC05 chạy với repository trong bộ nhớ, chưa chạy trên Cloud.
- Worker NACK mọi lỗi khi ghi DB, kể cả lỗi vĩnh viễn như vi phạm khóa ngoại (mã `23503`, `driverId` không có trong `users`). Message như vậy bị gửi lại cho tới khi vào DLQ (nếu subscription đã gắn DLQ) hoặc hết hạn giữ. Đã gặp trên Cloud lúc 23:47 ngày 16/11. Ghi ở [nợ kỹ thuật](../tech-debt.md).
- Cấu hình DLQ (`gps-events-dlq`, `maxDeliveryAttempts = 5`), `min instances = 1` và CPU luôn cấp cho Worker cần TV5 xác nhận trên GCP.
