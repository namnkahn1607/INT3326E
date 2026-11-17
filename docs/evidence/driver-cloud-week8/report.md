# TV4 — nghiệm thu Driver trên Cloud, 17/11/2026

Kết quả: **W713 đạt luồng list → pickup → deliver trên Cloud; W707 còn BLOCKED**.
Kiểm tra trực tiếp bằng Customer, Admin và Driver do người dùng đăng nhập,
không dùng Auth/API mock. Nguồn repo: `develop@2ed8f04`; nhánh bằng chứng:
`test/week8-driver-cloud-acceptance`.

## Môi trường và phiên bản

- Web: `https://int3326e.web.app`, bundle `/assets/index-BIrSjnkZ.js`, HTTP 200,
  Last-Modified `Tue, 17 Nov 2026 03:12:34 GMT`; có buffer/retry tuần 8.
  Chưa xác minh SHA build Hosting.
- API: `https://backend-service-wcvss3dnxa-as.a.run.app`. Revision đọc trực
  tiếp từ Cloud Run: `backend-service-00036-f67`, nhận 100% traffic, triển
  khai 17/11 lúc 10:02:01 +0700. Chưa xác minh SHA image này.
- Worker: `https://worker-service-wcvss3dnxa-as.a.run.app`.
  Revision `worker-service-00020-kht` và SHA `286f6db` là thông tin bàn giao
  TV2, chưa đọc lại revision Worker trong lượt này.
- Project `int3326e`, region `asia-southeast1`, Cloud SQL `int3326esql`.
- Mốc giờ dưới đây là giờ Việt Nam ngày 17/11/2026. Chỉ dùng GPS **Mô phỏng**,
  không lấy vị trí thiết bị. Không sao chép token, cookie hoặc mật khẩu.

## Khôi phục DB

Lượt đầu 15:26–15:30: `/v1/auth/me` trả 200 nhưng danh sách đơn và GPS trả
503. API và Worker `/health` đều 200; health không chứng minh DB/pipeline.
Log tại `2026-11-17T08:26:42.321Z`: Cloud SQL connector không lấy được
certificate cho `int3326e:asia-southeast1:int3326esql`, trả `409 invalidState`;
`UsersRepository` ghi
`{"event":"dependency_failure","stage":"users.lookup","code":"ECONNREFUSED"}`.
Overview xác nhận **Stopped**.

Ban đầu người dùng chọn chỉ đọc log. Sau đó người dùng cho phép bật DB
2 vCPU/8 GB có tính phí và tiếp tục nghiệm thu. Start bắt đầu 15:51:41,
hoàn tất 15:55:37; Overview chuyển **Runnable**. Danh sách/chi tiết Driver
sau đó trả 200. Không đổi secret, schema hoặc IAM.

Sau nghiệm thu, theo yêu cầu tắt tài nguyên tính phí của người dùng, đã Stop
instance: bắt đầu 16:48:03, Console xác nhận **Stopped** lúc 16:48:49.
DB hiện dừng và cần bật lại khi nghiệm thu tiếp; các luồng phụ thuộc DB sẽ
không hoạt động trong thời gian này. Dừng instance không xóa dữ liệu.

## W713 — đơn kiểm thử mới, nhận và giao thành công

Theo yêu cầu người dùng, tạo **một đơn mới**, không đổi trạng thái các đơn có
sẵn. Tên, điện thoại, bưu kiện và địa chỉ là dữ liệu mô phỏng, không giao thật.

| Trường | Giá trị |
| --- | --- |
| Mã vận đơn | `PF20261117CGDANJ` |
| Shipment ID | `sh_01M7MCZ70H77SVH0AFY0B1PXN4` |
| Customer | `usr_01M5SW7618CWKRAADEJZ7FAJX8` |
| Admin | `usr_01M5SW7612Q3QZDNAY0AE7SWY9` |
| Driver | `usr_01M5SW7617KAKAMEE4G0W50HRX` (Nguyen Van B) |

| Bước UI thật | Kết quả quan sát |
| --- | --- |
| Customer tạo đơn, 16:21 | Trang xác nhận tạo thành công, có mã và liên kết chi tiết |
| Admin gán Driver, 16:28 | Máy chủ xác nhận phân công đúng đơn và Driver |
| Driver đọc danh sách/chi tiết | Có đơn mới, trạng thái Đã gán tài xế |
| Driver xác nhận lấy hàng, 16:36 | “Máy chủ đã xác nhận lấy hàng.”; Đang giao hàng; lịch sử đúng Driver |
| Driver xác nhận giao thành công, 16:39 | “Máy chủ đã xác nhận giao thành công.”; lịch sử thêm đúng bước và Driver |
| Đọc lại sau giao | Driver sau reload, Customer và Admin cùng hiển thị Giao thành công, lịch sử 16:36/16:39 và ghi chú giao hàng |
| Tracking đơn kết thúc | Customer/Admin: “Đơn đã kết thúc”, “Đã dừng theo dõi và ẩn vị trí tài xế.” |

Ghi chú giao hàng đã lưu và đối chiếu:
`NGHIEM THU CLOUD W8 17/11/2026 - don mo phong, khong giao hang thuc te.`

W713 đạt luồng trên backend thật. Chưa thử cạnh tranh, gọi lặp, sai quyền
hoặc truy vấn transaction SQL; không nâng toàn bộ AC03/AC06/AC10 lên Cloud.

## W707 — GPS vẫn lỗi publish sau khi DB hoạt động

Sau khôi phục DB, simulator tạo **6 mẫu, accepted 0, pending 6**. Đã Stop và
rời dashboard để dọn buffer; không để emitter phát/retry liên tục. Lượt trước
DB khôi phục có 4 mẫu, accepted 0, pending 4, cũng đã dừng và dọn.

Logs Explorer 15:59:41–16:00:19: `POST /v1/locations` **503**, preflight 204;
`LocationService` ghi “Không publish được sự kiện GPS”. Ví dụ lần lỗi
`evt_375ce7c3-8d46-4356-a482-71802c1680be` tại `2026-11-17T08:59:43.123Z`.
Đây **không phải eventId đã được chấp nhận**; chưa có bằng chứng 202/Broker
Confirmed để đối chiếu Worker/SQL. Catch hiện tại không ghi lỗi Pub/Sub gốc,
nên chưa kết luận chính xác lỗi IAM từ phản hồi 503.

Cấu hình và quyền đọc trực tiếp từ Console:

- API runtime service account: `cloud-run-backend@int3326e.iam.gserviceaccount.com`.
- `PUBSUB_TOPIC_GPS_EVENTS=gps-events`, `FIREBASE_PROJECT_ID=int3326e`.
  Topic `projects/int3326e/topics/gps-events` và subscription `gps-events-sub`
  tồn tại. Biến legacy `PUBSUB_TOPIC=int3326e_pubsub` không được code API08 dùng.
- Project IAM hiển thị Cloud SQL Client, Firebase Authentication Viewer,
  Secret Manager Secret Accessor cho service account API; không thấy Pub/Sub
  Publisher cấp project. **Chưa biết quyền hiệu lực cấp topic**.
- Console không cho tài khoản hiện tại xem Permissions của topic:
  “You don't have permission to view the permissions of the selected resource”.
  Edit principal ở Project IAM bị vô hiệu hóa. Không thay quyền để thử.
- Người dùng chưa có tài khoản database; chưa đối chiếu trực tiếp
  `location_history` và `current_locations` qua SQL Studio.

TV5/người có quyền cần kiểm tra `pubsub.topics.publish` của service account
API trên `gps-events`. Nếu thiếu, cấp `roles/pubsub.publisher` chỉ trên topic
này theo quy trình cấp quyền. Nếu quyền đủ, lấy lỗi publish gốc để chẩn đoán.
Sau sửa, chạy lại simulator, lấy eventId được API trả 202 rồi đối chiếu
Pub/Sub, Worker và SQL với **cùng eventId** trước khi đóng W707. Log Worker
nhận message riêng lẻ không chứng minh transaction đã commit.

## Kiểm tra local trong cùng phiên

`NODE_OPTIONS=--no-experimental-webstorage npm run check`: **exit 0** trên
`8168a1a` (code không đổi so với `develop@2ed8f04`, chỉ khác tài liệu).
Lint, typecheck và build API/Worker/web đạt. Worker/shared/load 166 passed /
8 skipped, health e2e 2 passed, API 454 passed / 117 skipped, web 584 passed.
Tổng 125 ca phụ thuộc môi trường bỏ qua; không coi là đã chạy PostgreSQL/
Firebase emulator thật. Log local `.vitest/driver-cloud-final-check.log`
(không đưa log đầy đủ vào Git). Cảnh báo bundle web lớn không làm check thất bại.

Không nâng AC04/AC05 hoặc toàn bộ AC03 lên Cloud. Nghiệm thu đầy đủ còn W707;
bật DB đã giải quyết lỗi đọc đơn, chưa giải quyết lỗi publish GPS.
