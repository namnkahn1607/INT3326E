# Báo cáo Tuần 8 - Kịch bản lỗi Worker (REC02–REC05) & Runbook DLQ

| Người thực hiện | Vai trò | Trọng tâm bàn giao tuần 8 | Nhánh thực hiện |
| :--- | :--- | :--- | :--- |
| **Nguyễn Lê Na (TV2)** | Backend / GPS Worker | Kịch bản lỗi Worker (REC02–REC05), Runbook DLQ Replay, Chốt cơ chế Streaming Pull | `feature/tv2-week8-worker` / đã vào `develop` |

---

## 1. Kiểm thử luồng 4 chặng & Hiện trạng Cloud

### 1.1. Sơ đồ vận chuyển dữ liệu 4 chặng
Luồng sự kiện GPS của hệ thống ParcelFlow được vận hành liên tục qua 4 chặng độc lập:

$$\text{Chặng 1: Driver App} \xrightarrow[\text{REST POST /v1/locations}]{} \text{Chặng 2: Backend API} \xrightarrow[\text{Topic gps-events}]{} \text{Chặng 3: Worker (Streaming Pull)} \xrightarrow[\text{Prisma / SQL}]{} \text{Chặng 4: PostgreSQL}$$

### 1.2. Bằng chứng kiểm chứng 1 `eventId` đi hết 4 chặng
Trong kịch bản kiểm thử tích hợp tự động (`apps/worker/src/integration/week5-gps-pipeline.spec.ts` và `apps/worker/src/integration/week8-recovery-scenarios.spec.ts`):
1. **Chặng 1 (Driver gửi request)**: Driver gửi tọa độ `(lat: 21.0285, lng: 105.8542, seq: 1, clientTimestamp: "2026-11-15T08:00:00.000Z")`.
2. **Chặng 2 (API tiếp nhận)**: API gán `eventId = "evt_e2e_wk8_001"`, `driverId = "drv_hanoi_01"`, `receivedAt = "2026-11-15T08:00:00.120Z"` và publish JSON UTF-8 vào Pub/Sub topic `gps-events`, trả về `HTTP 202 Accepted`.
3. **Chặng 3 (Worker tiêu thụ)**: Worker nhận message qua Pub/Sub Subscription `gps-events-sub`, kiểm tra tính toàn vẹn (validate schema, kiểm tra clock skew).
4. **Chặng 4 (Ghi nhận DB)**:
   - Ghi vào bảng `location_history`: Lưu dòng lịch sử với khóa tự nhiên `(driverId, clientTimestamp)`.
   - Ghi vào bảng `current_locations`: Cập nhật vị trí tức thời mới nhất của tài xế phục vụ API tracking của Khách hàng.

### 1.3. Xác nhận triển khai trên Google Cloud (Đồng bộ với TV5)
Hệ thống đã được TV5 triển khai lên môi trường Google Cloud với các thông số xác thực:
- **Git SHA triển khai**: `1ff48800` (đồng bộ nhánh `main` và tài liệu bàn giao).
- **API Cloud Run Revision**: `backend-service-00033-2w5`.
- **Worker Cloud Run Revision**: `worker-service-00014-l9b`.
- **Cơ chế Pub/Sub**: **Streaming Pull** (theo quyết định kiến trúc của TV2).
- **Topics & Subscriptions**:
  - GPS Pipeline: Topic `gps-events` $\rightarrow$ Subscription `gps-events-sub` (Worker đọc dữ liệu).
  - General Events: Topic `int3326e_pubsub` $\rightarrow$ Subscription `int3326e_subcription`.
- **Cloud SQL**: Đã thực thi script khởi tạo bảng GPS `002-create-gps-locations.sql` (tạo `location_history` và `current_locations`).
- **Frontend Hosting**: Đã trực tiếp hoạt động tại https://int3326e.web.app.
- **Trạng thái nghiệm thu Cloud**: Môi trường hạ tầng Google Cloud (Cloud Run, Pub/Sub Pull, Cloud SQL) đã sẵn sàng tiếp nhận luồng GPS từ Driver và ghi nhận vị trí liên tục.

---

## 2. Bảng kết quả chạy kịch bản phục hồi lỗi (REC02–REC05)

Toàn bộ các ca kiểm thử phục hồi lỗi được tự động hóa tại file:  
`apps/worker/src/integration/week8-recovery-scenarios.spec.ts`.

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
node node_modules/vitest/vitest.mjs run apps/worker/src/integration/week8-recovery-scenarios.spec.ts
```

Log trích xuất:
```text
 RUN  v4.1.11 E:/INT3326E
 ✓ apps/worker/src/integration/week8-recovery-scenarios.spec.ts (5 tests) 22ms
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

## 3. Runbook vận hành Dead Letter Queue (DLQ Replay)

### 3.1. Mục đích
Khi tin nhắn bị lỗi lặp đi lặp lại vượt quá số lần retry tối đa (`maxDeliveryAttempts = 5`), Google Cloud Pub/Sub sẽ tự động chuyển tin nhắn sang Dead Letter Topic: `projects/int3326e/topics/gps-events-dlq`.  
Runbook này hướng dẫn kỹ sư vận hành rà soát, khắc phục nguyên nhân và replay lại các message hợp lệ về luồng chính.

### 3.2. Phân loại lỗi trong DLQ
1. **Lỗi tạm thời (Transient Errors - Cần Replay)**:
   - Cloud SQL bị quá tải hoặc khởi động lại (đã phục hồi).
   - Mất kết nối mạng tạm thời giữa Cloud Run và Cloud SQL.
   - Timeout khi thực hiện transaction.
2. **Lỗi vĩnh viễn (Poison Pill - Không Replay, giữ lại audit)**:
   - Sai cấu trúc JSON hoặc thiếu các trường bắt buộc (`lat`, `lng`, `clientTimestamp`).
   - Tọa độ ngoài biên hợp lệ (`lat` ngoài `[-90, 90]`, `lng` ngoài `[-180, 180]`).
   - Clock skew vượt ngưỡng 60 giây (đồng hồ máy client sai lệch quá lớn so với server).

### 3.3. Các bước vận hành Replay (Giữ nguyên `eventId` và `clientTimestamp`)

* **Bước 1: Kiểm tra số lượng message tồn trong DLQ**:
  ```bash
  gcloud pubsub subscriptions describe gps-events-dlq-sub --project=int3326e --format="value(numUndeliveredMessages)"
  ```

* **Bước 2: Chạy công cụ Replay CLI**:
  Hệ thống đã tích hợp sẵn script CLI tại `infra/pubsub/dlq-replay.mjs`:
  ```bash
  # Chế độ kiểm tra (Dry run / Batch inspection)
  node infra/pubsub/dlq-replay.mjs --dry-run

  # Chế độ Replay trực tiếp từ DLQ về Topic chính
  node infra/pubsub/dlq-replay.mjs --batch-size=50
  ```

* **Bước 3: Nguyên tắc bảo toàn tính bất biến (Invariants)**:
  - Giữ nguyên 100% `eventId`, `driverId`, `clientTimestamp` và `receivedAt` gốc của gói tin.
  - Tuyệt đối không sinh mới `eventId` để tránh phá vỡ cơ chế chống trùng first-write-wins của Worker.

* **Bước 4: Đối chiếu số dòng sau Replay**:
  Truy vấn PostgreSQL để xác nhận số dòng tăng thêm khớp với số lượng message được replay:
  ```sql
  SELECT driver_id, COUNT(*) AS total_points, MAX(client_timestamp) AS latest_time
  FROM location_history
  WHERE client_timestamp >= NOW() - INTERVAL '1 hour'
  GROUP BY driver_id;
  ```

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

## 5. Script SQL dọn dẹp `location_history` cũ hơn 7 ngày (Tùy chọn)

Để tránh phình to dung lượng lưu trữ Cloud SQL với tần suất gửi GPS 8s/lần:
```sql
-- packages/database/sql/cleanup-old-gps-history.sql
-- Xóa các bản ghi GPS chi tiết cũ hơn 7 ngày nhưng vẫn bảo toàn vị trí hiện tại trong current_locations
DELETE FROM location_history
WHERE client_timestamp < NOW() - INTERVAL '7 days';

-- Re-index định kỳ để tối ưu hóa hiệu năng truy vấn
REINDEX TABLE location_history;
```
Script này có thể được gán vào Cloud Scheduler chạy lúc 02:00 AM hàng ngày.
