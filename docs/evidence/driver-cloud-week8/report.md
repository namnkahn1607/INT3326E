# TV4 — nghiệm thu Driver trên Cloud, 17/11/2026

Kết quả: **BLOCKED**, chưa đóng W707/W713. Kiểm tra trực tiếp trên phiên
Driver do người dùng đăng nhập, không dùng Auth/API mock. Nguồn repo kiểm
tra: `develop@2ed8f04`; nhánh ghi bằng chứng: `test/tv4-week8-cloud-acceptance`.

## Môi trường và phiên bản

- Web: `https://int3326e.web.app/driver`, HTTP 200.
- Bundle Hosting: `/assets/index-BIrSjnkZ.js`, HTTP 200, Last-Modified
  `Tue, 17 Nov 2026 03:12:34 GMT`. Đã có nhãn buffer 100 mẫu/5 phút và gửi bù
  của emitter tuần 8. Chưa xác minh SHA build của Hosting.
- API: `https://backend-service-wcvss3dnxa-as.a.run.app`.
- Worker: `https://worker-service-wcvss3dnxa-as.a.run.app`.
- Bàn giao TV2 ghi SHA Cloud `286f6db`, revision API
  `backend-service-00035-b6c`, Worker `worker-service-00020-kht`. Đây là thông
  tin được bàn giao, chưa đọc lại cấu hình Cloud Run trong lượt nghiệm thu này.
- Thời điểm quan sát browser: khoảng 15:26–15:29 ngày 17/11, giờ Việt Nam
  (08:26–08:29 UTC). Chỉ dùng GPS **Mô phỏng**, không lấy vị trí thiết bị.

## Kết quả quan sát

| Kiểm tra | Kết quả thực tế | Kết luận |
| --- | --- | --- |
| Đăng nhập Driver và role route | Trang Driver hiển thị tài khoản và vai trò Tài xế | Đạt bước truy cập UI |
| Firebase account lookup | Browser Network: HTTP 200 | Firebase có phản hồi thành công |
| `GET /v1/auth/me` sau reload | Browser Network: HTTP 200 | Profile xác thực đọc được |
| API `/health`, Worker `/health` | GET trực tiếp đều HTTP 200 | Chỉ xác nhận HTTP process, không xác nhận DB/pipeline |
| `GET /v1/shipments?limit=20` | Browser Network: HTTP 503; preflight 204. Lỗi còn sau reload | Không tải được danh sách, chưa kiểm pickup/deliver |
| `POST /v1/locations` | Browser Network: 5 phản hồi 503 trong lượt có retry; preflight 204 | Chưa có GPS được API chấp nhận |
| Buffer khi API lỗi | Tạo 4 mẫu, accepted 0, pending 4; UI báo API chưa nhận được mẫu GPS | Đã quan sát giữ mẫu trên API thật bị lỗi; chưa kiểm replay thành công |
| Dừng và dọn | Stop chuyển sang Đã dừng; reload đưa generated/accepted/pending về 0 | Không để emitter tiếp tục phát/retry sau kiểm tra |
| Pickup/deliver | Không thực hiện vì không tải được đơn | W713 còn mở |
| Pub/Sub → Worker → SQL và tracking | Chưa có accepted `eventId` từ lượt này để đối chiếu | W707 còn mở |

Body một phản hồi GPS được đọc trong Network → Response (không sao chép
Authorization, cookie hoặc Firebase token):

```json
{
  "type": "about:blank",
  "title": "Service temporarily unavailable",
  "status": 503,
  "code": "SERVICE_UNAVAILABLE",
  "instance": "/v1/locations",
  "timestamp": "2026-11-17T08:26:42.322Z"
}
```

## Tái hiện và tiếp tục

1. Đăng nhập tài khoản test DRIVER trên Hosting, mở `/driver`, thử đọc danh
   sách đơn. DevTools Network ghi `shipments?limit=20` trả 503.
2. Chọn Mô phỏng, bắt đầu phát, chờ chu kỳ 8 giây. `locations` trả 503;
   accepted giữ 0 và pending tăng. Dừng phát sau khi có bằng chứng.
3. TV1/TV5 đọc log `backend-service` trong khoảng UTC
   `2026-11-17T08:26:30Z`–`2026-11-17T08:29:30Z`, đối chiếu request 503 và
   `dependency_failure` (`stage`, `code`). Chưa đủ bằng chứng để kết luận lỗi
   DB, linkage hay Pub/Sub. Không thay secret/schema hoặc nới guard theo suy đoán.
4. Sau khi API hoạt động, dùng đơn test đã gán để kiểm list → pickup → deliver;
   lấy `eventId` của GPS 202 rồi cùng TV2/5/6 đối chiếu log Worker,
   `location_history`, `current_locations` và tracking. Chỉ đóng W707/W713
   khi các bằng chứng tương ứng có thật.

## Kiểm tra local trong cùng phiên

`NODE_OPTIONS=--no-experimental-webstorage npm run check`: **exit 0** trên
`2ed8f04`; lint, typecheck và build API/Worker/web đạt. Worker/shared/load
166 passed / 8 skipped, health e2e 2 passed, API 454 passed / 117 skipped,
web 584 passed. Tổng 125 ca phụ thuộc môi trường bị bỏ qua; không coi là đã
chạy PostgreSQL/Firebase emulator thật trong lượt này. Log local:
`.vitest/driver-acceptance-20261117-check.log` (không đưa log đầy đủ vào Git).

Không nâng trạng thái AC03/AC04/AC05 lên Cloud từ các kiểm tra trên.
