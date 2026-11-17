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

## Nguyên nhân xác nhận từ Cloud Console

Sau lượt thử, người dùng mở Logs Explorer của project `int3326e`. Đã đọc
log `backend-service` đúng khoảng 15:26–15:30 và kiểm tra trang Overview của
Cloud SQL `int3326esql`:

- `2026-11-17T08:26:42.321Z`: Cloud SQL connector không lấy được ephemeral
  certificate cho `int3326e:asia-southeast1:int3326esql`; Google API trả
  `409 invalidState`, "The instance or operation is not in an appropriate
  state to handle the request".
- Cùng thời điểm, `UsersRepository` ghi
  `{"event":"dependency_failure","stage":"users.lookup","code":"ECONNREFUSED"}`.
- Lỗi tương tự lặp lại khi gọi GPS, và tại
  `2026-11-17T08:28:08.355Z` ngay sau GET danh sách đơn 503.
- Cloud SQL Overview hiển thị **Stopped** và "This instance is stopped.
  Start it to allow connections and operations". Vì DB dừng, API không đọc
  được business user trước khi xử lý danh sách đơn hoặc publish GPS.
- Người dùng yêu cầu **chỉ đọc log, chưa bật database**. Không khởi động
  instance, không thay cấu hình/secret/schema. W707/W713 vẫn BLOCKED;
  chưa xác nhận hành vi sau khi DB được bật lại.

## Tái hiện và tiếp tục

1. Đăng nhập tài khoản test DRIVER trên Hosting, mở `/driver`, thử đọc danh
   sách đơn. DevTools Network ghi `shipments?limit=20` trả 503.
2. Chọn Mô phỏng, bắt đầu phát, chờ chu kỳ 8 giây. `locations` trả 503;
   accepted giữ 0 và pending tăng. Dừng phát sau khi có bằng chứng.
3. Nguyên nhân DB dừng đã được xác nhận bằng log và Cloud SQL Overview như
   trên. Cần người có quyền và được cho phép bật lại `int3326esql`, đợi instance
   sẵn sàng rồi kiểm tra lại API. Không sửa secret/schema hoặc nới guard để
   che lỗi kết nối; chưa thực hiện khởi động theo lựa chọn của người dùng.
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
