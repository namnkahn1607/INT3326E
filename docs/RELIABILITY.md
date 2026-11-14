# Độ tin cậy

Cách chứng minh hệ thống chạy đúng và khởi động lại được. Một tính năng chưa tính là xong nếu sau đó hệ thống không còn qua các kiểm tra dưới đây.

## Đường dẫn chuẩn

| Việc | Lệnh |
| --- | --- |
| Cài đặt | `npm ci` |
| Kiểm tra toàn repo | `npm run check` (lint, typecheck, test, build API, Worker, web) |
| Chạy web local | `npm run dev:web` (cần `apps/web/.env.local`) |
| Chạy Worker local | `npm run start:dev` (cần `.env`; Pub/Sub emulator xem [deploy](features/deploy.md)) |
| Smoke Pub/Sub | `npm run test:gps-pubsub` (emulator) hoặc `-- --cloud --project int3326e` |
| Health trên Cloud | `GET /health` của API và Worker (không dùng `/healthz`, Cloud Run chặn) |

## Luồng chính phải luôn chạy được

Mỗi luồng có lệnh kiểm local và cách kiểm trên Cloud. Trước khi chốt tuần, cả hai luồng phải đạt trên Cloud.

**1. Đơn hàng: tạo → gán → nhận → giao**

- Local: `npm test --workspace=@parcelflow/api -- assignments.postgres shipment-flow` (có `SHIPMENT_TEST_DATABASE_URL`, `TV6_ADMIN_TEST_DATABASE_URL` để chạy trên PostgreSQL thật).
- Cloud: trên https://int3326e.web.app, Customer tạo đơn, Admin gán tài xế, Driver nhận rồi giao; Customer thấy đủ lịch sử trạng thái và thông báo. Ghi mã đơn và revision vào file tuần.
- Dấu hiệu hỏng: API trả 503 (DB hoặc Firebase lỗi), 409 `USER_NOT_PROVISIONED` (tài khoản chưa liên kết bảng `users`).

**2. GPS: Driver → API → Pub/Sub → Worker → SQL**

- Local: `npm test -- gps-writer gps-duplicate-order` (có `WORKER_TEST_DATABASE_URL`).
- Cloud: Driver bật gửi GPS; lấy `eventId` từ phản hồi 202, tìm trong log Worker và trong `location_history`, `current_locations`.
- Dấu hiệu hỏng: API trả 202 nhưng SQL không có dòng mới (Worker thiếu `DATABASE_URL` hoặc subscription sai tên); backlog subscription tăng mãi.

## Tín hiệu runtime

- API log lỗi dependency có giai đoạn (Firebase, SQL, Pub/Sub), không lộ chi tiết SQL ra client.
- Worker log từng message lỗi kèm ID: `EVT01 Invalid Payload` (payload sai, không thử lại), `GPS Persistence Failed` (lỗi tạm thời, NACK để thử lại).
- Pub/Sub: theo dõi backlog và tuổi message cũ nhất của `gps-events-sub` trên Cloud Monitoring.

## Quy tắc

- Không chốt tuần khi một luồng chính chưa đạt trên Cloud; ghi rõ luồng nào chưa đạt.
- Deploy một lần từ một SHA đã qua `npm run check`; ghi SHA và revision vào file tuần.
- Lỗi lặp lại lần thứ hai thì thêm test hoặc kiểm tra tự động cho nó, không chỉ nhắc trong chat.
