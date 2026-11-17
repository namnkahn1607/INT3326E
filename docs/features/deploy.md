# Triển khai lên Cloud

Project GCP `int3326e`, vùng `asia-southeast1`. Deploy một lần từ một SHA trên `develop` sau khi chốt code của tuần; ghi lại SHA và revision.

## API và Worker (Cloud Run)

API và Worker có Dockerfile riêng. Context build là gốc repo vì cả hai dùng `packages/types`:

```bash
docker build -f apps/api/Dockerfile -t parcelflow-api .
docker build -f apps/worker/Dockerfile -t parcelflow-worker .
```

Hoặc build bằng Cloud Build: `cloudbuild-api.yaml`, `cloudbuild-worker.yaml` (image hiện gắn tag `:latest`; nên thêm tag SHA để rollback được).

Không dùng `--source=apps/worker` vì thư mục đó không chứa package dùng chung. Deploy Worker từ image:

```bash
gcloud run deploy worker-service \
  --project=int3326e \
  --region=asia-southeast1 \
  --image="$WORKER_IMAGE" \
  --port=8080 \
  --command="" \
  --args="" \
  --update-env-vars=GCP_PROJECT_ID=int3326e \
  --remove-env-vars=PUBSUB_EMULATOR_HOST
```

### Biến môi trường

| Dịch vụ | Biến | Ghi chú |
| --- | --- | --- |
| API | `PUBSUB_TOPIC_GPS_EVENTS` | Mặc định `gps-events` |
| API | `DATABASE_URL`, biến Firebase | Xem `apps/api/.env.example` |
| Worker | `PUBSUB_SUB_GPS_EVENTS` | Mặc định `gps-events-sub` |
| Worker | `DATABASE_URL` | Thiếu thì Worker chỉ ghi vào bộ nhớ, không ghi SQL |
| Cả hai | `GCP_PROJECT_ID` | `int3326e` |

Tên cũ `PUBSUB_TOPIC` và `PUBSUB_SUBSCRIPTION` không còn được đọc. Không đặt `PUBSUB_EMULATOR_HOST` trên Cloud Run. Service account dùng ADC.

### Health

`/healthz` trên Cloud Run bị Google chặn và trả 404 của Google; kiểm bằng `/health` (API và Worker đều có). Health chỉ xác nhận tiến trình HTTP đang chạy, không chứng minh pipeline GPS hoạt động.

### Cơ chế nhận tin Pub/Sub của Worker (Chốt Streaming Pull)

TV2 (Na) và TV5 (Minh Anh) đã chốt dùng **Streaming Pull** thay vì HTTP Push Webhook:

- **Lý do**:
  1. Kiểm soát ACK/NACK ở mức transaction database (quy tắc D08: chỉ ACK sau khi commit SQL thành công; lỗi thì NACK để Pub/Sub gửi lại).
  2. Tích hợp Flow control (`@google-cloud/pubsub`) chống tràn bộ nhớ / quá tải Worker khi có burst GPS events.
  3. Bảo mật: Worker không cần mở endpoint HTTP public nhận webhook từ bên ngoài.
  4. Nhất quán với CLI Replay DLQ (`infra/pubsub/dlq-replay.mjs`).
- **Cấu hình Cloud Run bắt buộc cho Worker** (TV5 xác nhận đã đặt trên Cloud):
  - `Minimum instances = 1` (Worker phải luôn chạy để duy trì stream lắng nghe tin nhắn).
  - `CPU allocation = Instance-based` (CPU luôn được cấp phát, không bị bóp nghẽn khi chạy ngầm).
- Đã xóa mục nợ kỹ thuật tương ứng trong `docs/tech-debt.md`.

## Cloud SQL

Chạy file trong `packages/database/sql/` theo thứ tự số. Mỗi file chỉ tạo bảng mới và lỗi nếu bảng đã tồn tại; với DB đang có dữ liệu, kiểm tra bảng nào đã có trước khi chạy, không chạy lại cả file.

## Web (Firebase Hosting)

Tạo `apps/web/.env.production.local` với `VITE_API_URL`, `VITE_FIREBASE_*`, `VITE_VIETMAP_API_KEY` (mẫu ở `apps/web/.env.example`). Chạy trong `apps/web`, vì `firebase.json` nằm ở đó:

```bash
npm run build && npx --yes firebase-tools deploy --only hosting --project int3326e
```

Firebase CLI phải đăng nhập tài khoản có quyền vào `int3326e`. Kiểm tra: mở https://int3326e.web.app, xem nguồn trang, tên file `assets/index-*.js` phải khác bản trước.

Chi tiết biến môi trường frontend: [frontend-config-handoff](frontend-config-handoff.md).

## Pub/Sub local

```bash
docker compose -f infra/docker-compose.yml up -d pubsub-emulator
sh infra/pubsub/init-pubsub.sh
npm run test:gps-pubsub
```

Chế độ Cloud: `npm run test:gps-pubsub -- --cloud --project int3326e` với ADC. Xem [kiểm thử pipeline GPS](../history/gps-pipeline-validation.md).
