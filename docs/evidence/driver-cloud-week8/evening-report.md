# TV4 — nghiệm thu GPS Cloud 17–18/11/2026

**W707 đạt ngày 18/11, có khôi phục DLQ:** Driver thật gửi 17 mẫu mô phỏng,
API chấp nhận đủ; sau khôi phục có đủ 17 mẫu trong SQL và current đúng mẫu
hợp lệ mới nhất. Đã đối chiếu cùng eventId qua API, Pub/Sub, Worker và hai
bảng. Worker chỉ được bật cấu hình chạy nền tạm thời, đã hoàn nguyên trong
hạn 20 phút; kết quả này không bảo đảm runtime tiết kiệm hiện tại chạy nền.

Lượt này tiếp tục W707 sau [nghiệm thu buổi chiều](report.md). Người dùng đã
mở sẵn ParcelFlow Driver và GCP Console, đã bật lại Cloud SQL (Console ghi
Started 20:57:04; Overview xác nhận Runnable). Không đổi IAM, secret, schema
hoặc deploy trong lượt kiểm này. Chỉ gửi GPS **Mô phỏng**, không lấy vị trí thiết bị.

## Driver → API: đạt gửi mẫu và gửi bù

- Nguồn: `https://int3326e.web.app/driver`, phiên Driver thật; không mock Auth/API.
- 17 mẫu, seq 1–17, timestamp client từ `2026-11-17T14:51:22.709Z` đến
  `2026-11-17T14:53:30.708Z` (hơn hai phút). Kết thúc: đã dừng, 17 accepted,
  pending 0, không còn request đang gửi.
- DevTools Network chuyển Offline khoảng 21:52:12–21:52:43 giờ Việt Nam
  (khoảng 30 giây, dài hơn 20 giây của checklist). UI giữ 7 accepted, buffer
  tăng từ 1 đến 4; sau khôi phục No throttling, accepted lên 12/12 và buffer
  về 0, rồi tiếp tục đến 17/17. Không reload/rời trang trong lượt offline.
- Ảnh [Driver ở 390 CSS px](gps-replay-390.png) chụp sau khi dừng; ảnh xuất
  từ DevTools device toolbar, Responsive width 390, DPR 2.
- Response 202 cuối đọc trực tiếp trong DevTools Network:

```json
{
  "status": "ACCEPTED",
  "eventId": "evt_3de4d199-19ac-444d-8779-5f93382eddaf",
  "receivedAt": "2026-11-17T14:53:26.684Z"
}
```

## API → Pub/Sub → Worker: đã đối chiếu cùng eventId

[Log xuất từ Logs Explorer](gps-event-logs.json) chỉ giữ timestamp, service,
revision và message; bỏ ANSI, metadata instance và các trường không cần thiết.

| Bằng chứng | Kết quả |
| --- | --- |
| API Broker Confirmed | `2026-11-17T14:53:26.745785Z`, revision `backend-service-00037-4c5` |
| Worker nhận EVT01 cùng eventId | `2026-11-17T14:53:29.491685Z`, revision `worker-service-00025-hnp` |
| Pub/Sub message ID | `23329669095927704` |
| Driver nghiệp vụ | `usr_01M5SW7617KAKAMEE4G0W50HRX` |
| Mẫu cuối | lat `21.028511`, lng `105.804817`, clientTimestamp `2026-11-17T14:53:30.708Z`, seq `17` |

Lỗi publish 503 của buổi chiều không tái hiện trong lượt này. Chưa xác minh
SHA của hai revision mới hoặc thay đổi nào trước lượt kiểm đã giải quyết lỗi.

Worker nhận lại cùng message nhiều lần đến `14:54:05.791998Z`. Trước đó log
ghi `GPS Persistence Failed`, `timeout exceeded when trying to connect`,
transaction rolled back và message not acknowledged với cùng message ID.
Đến `14:54:10.292228Z`, repository ghi mẫu cuối chỉ vào history và bỏ cập nhật
current_locations (`history-only: clock_skew`). ClientTimestamp của mẫu cuối
đi trước receivedAt khoảng 4 giây; không sửa thời gian gốc để làm mẫu có vẻ mới.

Log nhận message hoặc bỏ cập nhật current không đủ chứng minh COMMIT. Tại
mốc cuối tối 17/11, W707 còn mở do SQL Studio yêu cầu người dùng đăng nhập
database. Phần đối chiếu ngày 18/11 bên dưới thay thế trạng thái chờ này.
Có sẵn [truy vấn chỉ đọc](verify-gps.sql) để chạy lại.

Chưa kiểm marker di chuyển trên Customer/Admin trong lượt tối này; phần đó
cần được đối chiếu sau khi xác nhận SQL. W713 nhận/giao đã đạt ở lượt chiều,
không đổi trạng thái các đơn có sẵn trong lượt GPS này.

## SQL và khôi phục DLQ ngày 18/11

Người dùng đăng nhập SQL Studio, database `parcelflow` trên `int3326esql`.
Chỉ chạy SELECT; không sửa schema hoặc chèn dữ liệu trực tiếp vào SQL.

Ban đầu, mẫu cuối có `location_history.id = 1208`, persistedAt
`2026-11-17T14:54:09.400Z`. Nhưng toàn lượt chỉ có 8/17 dòng (seq 1–7, 17),
cả 8 đều future theo receivedAt gốc. Current vẫn là `evt_na_live_test_01`
ngày 16/11. Xem [snapshot trước phục hồi](sql-verification-20261118.json)
và [kết quả SQL 8 dòng](sql-history-before-recovery.json).

Console DLQ `gps-events-dlq-sub` chứa đủ seq 8–16, được chuyển từ `gps-events-sub`
sau 5 lần giao. Đã Pull để đọc, không bật ACK. Lưu [9 payload gốc](dlq-recovered-payloads.json)
và publish từng message một vào topic `gps-events`, giữ nguyên eventId,
clientTimestamp, receivedAt, seq, tọa độ và driverId. Không tạo eventId mới,
không sửa thời gian để biến mẫu future thành eligible. Console xác nhận
`Message published.` cho từng lần; không ACK/xóa bản gốc trong DLQ.

Sau replay, [history có đủ 17 dòng](sql-history-after-recovery.json), seq
1–17, 17 eventId và 17 timestamp khác nhau. 9 dòng mới giữ toàn bộ payload
đã lưu từ DLQ; các dòng đã có trước không thay đổi persistedAt.

| Cùng eventId `evt_448a87a7-8d70-4b87-a419-2bf4ec2092b1` | Bằng chứng |
| --- | --- |
| API chấp nhận / broker confirmed | `2026-11-17T14:52:44.311108Z`, `backend-service-00037-4c5` |
| Pub/Sub lần giao gốc | message ID `23343761458077690`, Worker nhận `14:52:45.292894Z` |
| Pub/Sub replay | message ID `20358141893121952`, Worker `worker-service-00026-xkd` nhận `2026-11-18T00:58:49.532635Z` |
| History đã commit | seq 11, persistedAt `2026-11-18T00:58:49.562Z` |
| Current đã cập nhật | cùng eventId, seq 11, clientTimestamp `2026-11-17T14:52:42.710Z`, updatedAt `2026-11-18T00:58:49.562Z` |
| Tọa độ | lat `21.029111`, lng `105.805417` |

[Log cùng eventId qua API và Worker](gps-current-event-logs.json),
[JSON current](sql-current-after-recovery.json),
[ảnh kết quả SQL desktop](sql-current-after-recovery.png).

Current đúng seq 11: seq 8–11 là các mẫu offline được API tiếp nhận sau
thời điểm đo; seq 12–17 có clientTimestamp đi trước receivedAt nên chỉ vào
history. Việc replay vào ngày hôm sau không thay đổi eligibility tính theo
receivedAt gốc. Mẫu current ngày 17/11 đã stale tại lúc đọc ngày 18/11;
không coi replay này là bằng chứng marker cập nhật gần real-time.

## Worker bật tạm và hoàn nguyên

Console thực tế của Worker `00025-hnp`: min instances 0, max 20,
Request-based, CPU 1; khác ghi nhận Streaming Pull đã bàn giao. Log trong
lượt 17/11 có 49 lỗi `GPS Persistence Failed`, timeout kết nối và NACK;
9 mẫu đã đi DLQ. Không kết luận mọi lỗi timeout chỉ do một nguyên nhân,
nhưng cấu hình này không đáp ứng yêu cầu chạy nền của Streaming Pull.

Người dùng xác nhận chỉ bật min 1/Instance-based **tối đa 20 phút rồi hoàn
nguyên**. Mốc giới hạn bắt đầu `2026-11-18T00:50:07Z` (07:50:07 giờ Việt Nam),
hạn 08:10:07. Revision `worker-service-00026-xkd` triển khai 07:50:36, nhận
100% traffic. Chỉ thay hai trường trong diff; giữ image, max instances,
concurrency, timeout và cấu hình DB.

Sau kiểm, đã deploy hoàn nguyên min 0/Request-based. Console xác nhận cả ba
bước Updating service, Creating revision, Routing traffic đều Completed;
ảnh giao diện cuối hiển thị min 0 và Request-based được chọn. Đã xác nhận
trước 08:08:33, trong hạn 20 phút. Không giữ Worker chạy Instance-based 24/7.
Cloud SQL do người dùng bật giữ nguyên; lượt này không Stop instance SQL.

W707 đóng ở mức hành trình có phục hồi DLQ và đối chiếu SQL. Vận hành nền
liên tục, checkpoint marker Customer/Admin và việc dọn bản DLQ đã replay
còn cần TV5/TV2/TV3/TV6 phối hợp. Không nâng toàn bộ AC04/AC05 lên Cloud.

## Kiểm tra local

`NODE_OPTIONS=--no-experimental-webstorage npm.cmd run check` đạt, exit 0 trên
working tree `fix/gps-publish-diagnostics` từ `7a41c55`: Worker/shared/load 166,
health e2e 2, API 465, web 584 test đạt; 125 ca phụ thuộc PostgreSQL/Firebase
emulator bỏ qua. Lint/typecheck/build đạt; cảnh báo chunk web 502.93 kB không
làm build thất bại. Log local `.vitest/tv4-cloud-resume-check.log` không đưa vào Git.
`git diff --check` đạt. Các test local không thay thế đối chiếu SQL Cloud.

Đã chạy lại check ngày 18/11, exit 0 với cùng số test/skipped. Lượt cuối trên
`c344f50` đã tích hợp `develop@ef93b55`, log `.vitest/tv4-final-check-20261118.log`;
lượt trước tích hợp ở `.vitest/tv4-cloud-sql-check-20261118.log`. Các artifact JSON được đối chiếu
tự động về đủ seq/eventId/timestamp, payload replay không đổi và current là
mẫu eligible mới nhất; việc này kiểm tính nhất quán bằng chứng đã xuất,
không thay thế lượt SELECT thật trên Cloud.
