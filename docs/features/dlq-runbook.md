# Runbook Vận Hành Dead Letter Queue (DLQ Replay)

| Thông tin | Chi tiết |
| :--- | :--- |
| **Tính năng** | Dead Letter Queue (DLQ) Replay cho sự kiện GPS Telemetry |
| **Người thực hiện** | TV2 (Na) |
| **Topic chính** | `projects/int3326e/topics/gps-events` |
| **Topic DLQ** | `projects/int3326e/topics/gps-events-dlq` |
| **Subscription DLQ** | `projects/int3326e/subscriptions/gps-events-dlq-sub` |
| **CLI Tool** | [`infra/pubsub/dlq-replay.mjs`](../../infra/pubsub/dlq-replay.mjs) |

---

## 1. Mục đích và Cơ chế DLQ

Khi Worker không thể ghi nhận sự kiện GPS do lỗi tạm thời (Database timeout, mất kết nối mạng chập chờn) hoặc gặp gói tin độc hại (Poison pill), Worker sẽ không `ack()` message (hoặc gọi `nack()`). 

Google Cloud Pub/Sub được cấu hình chính sách Dead Letter với `maxDeliveryAttempts = 5`:
- Nếu tin nhắn thử lại quá 5 lần vẫn thất bại, Pub/Sub tự động chuyển tiếp message sang topic Dead Letter Queue: `gps-events-dlq`.
- Việc này giúp **hàng đợi chính không bị nghẽn (unblock pipeline)** và bảo toàn các message lỗi để kỹ sư vận hành điều tra, phân loại và replay.

---

## 2. Phân biệt Message Lỗi Tạm Thời (Replay) vs Message Sai (Không Replay)

Trước khi thực hiện replay, kỹ sư vận hành bắt buộc phải phân loại message:

| Tiêu chí | Lỗi tạm thời (Transient Error) 👉 **ĐƯỢC REPLAY** | Message sai / Gói tin độc (Poison Pill) 👉 **KHÔNG REPLAY** |
| :--- | :--- | :--- |
| **Nguyên nhân** | • Cloud SQL bị quá tải hoặc khởi động lại.<br>• Worker cold-start timeout socket kết nối DB.<br>• Lỗi phân quyền DB tạm thời (đã được cấp lại). | • Payload JSON sai định dạng cú pháp.<br>• Thiếu trường bắt buộc (`eventId`, `driverId`, `lat`, `lng`, `clientTimestamp`).<br>• Tọa độ ngoài biên hợp lệ (`lat` ngoài `[-90, 90]`, `lng` ngoài `[-180, 180]`).<br>• Clock skew vượt quá 60 giây (`clientTimestamp > receivedAt + 60s`). |
| **Hành động** | Sửa nguyên nhân hạ tầng xong $\rightarrow$ Replay về topic chính `gps-events`. | Giữ lại trong DLQ hoặc xuất file lưu trữ audit/quarantine. **Tuyệt đối không đẩy lại** vì sẽ tiếp tục bị Worker từ chối và làm nghẽn DLQ. |
| **Ví dụ payload** | `{"eventId":"evt_01","driverId":"usr_01","lat":21.0285,"lng":105.8542,"clientTimestamp":1731730000000}` | `{"foo":"bar"}` hoặc `{"eventId":"e1","lat":"invalid_lat"}` |

---

## 3. Lệnh Replay (`infra/pubsub/dlq-replay.mjs`)

Công cụ CLI replay được cung cấp tại [`infra/pubsub/dlq-replay.mjs`](../../infra/pubsub/dlq-replay.mjs).

### 3.1. Chế độ kiểm tra an toàn (Dry-run / Audit)
Chế độ này chỉ đọc và kiểm tra tính hợp lệ của batch message, phân loại tin hợp lệ vs poison pill mà **không đẩy lên Pub/Sub**:

```bash
# Kiểm tra batch giả lập mặc định
node infra/pubsub/dlq-replay.mjs --dry-run

# Kiểm tra batch message xuất từ DLQ subscription
node infra/pubsub/dlq-replay.mjs --dry-run --file=dlq-batch-20261116.json
```

### 3.2. Chế độ Replay thực tế (Live Replay)
Sau khi xác nhận batch dữ liệu an toàn:

```bash
# Replay batch message đã lưu từ file JSON về topic gps-events
node infra/pubsub/dlq-replay.mjs --file=dlq-batch-20261116.json

# Hoặc chạy kiểm chứng luồng giả lập với cấu hình môi trường
GCP_PROJECT_ID=int3326e PUBSUB_TOPIC_GPS_EVENTS=gps-events node infra/pubsub/dlq-replay.mjs
```

---

## 4. Bất biến: Cách giữ nguyên `eventId` và thời gian gốc

Khi thực hiện Replay, quy tắc toàn vẹn dữ liệu (Bất biến D02 & D08) yêu cầu:
1. **Giữ nguyên định danh sự kiện**: Trường `eventId` ban đầu **bắt buộc phải giữ nguyên**, tuyệt đối không sinh mới UUID khi replay.
2. **Giữ nguyên mốc thời gian phát sinh**: Trường `clientTimestamp` và `receivedAt` ban đầu phải được bảo tồn chính xác:
   - `location_history` dựa vào cặp khóa tự nhiên `(driverId, clientTimestamp)` để áp dụng quy tắc **First-write-wins (ON CONFLICT DO NOTHING)**.
   - `current_locations` dựa vào điều kiện `candidate.clientTimestamp > stored.clientTimestamp` để không bị thụt lùi thời gian vị trí hiện tại của tài xế.
3. Trong mã nguồn [`infra/pubsub/dlq-replay.mjs`](../../infra/pubsub/dlq-replay.mjs):
   ```javascript
   // Bất biến: giữ nguyên payload gốc, không override eventId hay clientTimestamp
   const payload = item.data;
   console.log(
     `[PREPARED] eventId=${payload.eventId} | driverId=${payload.driverId} | clientTimestamp=${payload.clientTimestamp}`
   );
   const buffer = Buffer.from(JSON.stringify(payload), 'utf-8');
   await topic.publishMessage({ data: buffer });
   ```

---

## 5. Quy trình đối chiếu số dòng sau khi Replay

Để nghiệm thu quá trình Replay thành công và chứng minh không mất mát/trùng lặp dữ liệu:

### Bước 1: Ghi nhận trạng thái trước khi Replay
Chạy truy vấn trong Cloud SQL Studio:
```sql
-- Ghi nhận tổng số bản ghi hiện tại
SELECT count(*) AS total_history_before FROM location_history;
SELECT count(*) AS total_current_before FROM current_locations;
```

### Bước 2: Thực thi Replay $N$ messages
Chạy CLI replay với file batch $N$ bản ghi:
```bash
node infra/pubsub/dlq-replay.mjs --file=dlq-batch.json
```
Ghi nhận kết quả tóm tắt từ CLI:
- `Replayed`: $K$ bản ghi hợp lệ được publish lại.
- `Rejected (Poison)`: $M$ bản ghi rác bị cách ly ($K + M = N$).

### Bước 3: Đối chiếu số dòng trong Database sau khi Replay
Chạy truy vấn kiểm chứng trong Cloud SQL Studio:

1. **Kiểm tra sự kiện đã được ghi vào `location_history`**:
   ```sql
   -- Danh sách eventId vừa được replay phải có mặt đầy đủ
   SELECT id, "driverId", lat, lng, "clientTimestamp", "eventId", "persistedAt"
   FROM location_history
   WHERE "eventId" IN ('evt_dlq_001', 'evt_dlq_002', '...')
   ORDER BY "persistedAt" DESC;
   ```
   - **Số dòng tăng thêm**: Bằng đúng số $K$ message hợp lệ mới (nếu message chưa từng được ghi trước đó).
   - **Nếu message đã từng được ghi 1 phần trước khi fail**: Số dòng không tăng thêm (nhờ cơ chế idempotent deduplication `ON CONFLICT DO NOTHING`), đảm bảo không có bản ghi trùng lặp.

2. **Kiểm tra vị trí tức thời trong `current_locations`**:
   ```sql
   SELECT "driverId", lat, lng, "clientTimestamp", "eventId", "updatedAt"
   FROM current_locations
   WHERE "driverId" = '<driver_id_replay>';
   ```
   - Bản ghi phải phản ánh đúng tọa độ tương ứng với `clientTimestamp` lớn nhất của tài xế.

3. **Kiểm tra hàng đợi DLQ đã được giải phóng**:
   ```bash
   gcloud pubsub subscriptions describe gps-events-dlq-sub --project=int3326e --format="value(numUndeliveredMessages)"
   ```
   - Số message chưa chuyển giao (unacknowledged) phải giảm về `0`.
