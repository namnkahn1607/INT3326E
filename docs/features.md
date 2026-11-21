# Danh sách tính năng và trạng thái

Mỗi dòng là một tiêu chí nghiệm thu (AC) của đặc tả v1.4. Chỉ đổi trạng thái khi lệnh kiểm tra đã chạy đạt trong đúng môi trường ghi ở cột đó. Cập nhật file này trong cùng PR với thay đổi code.

Trạng thái: `chưa có` · `đang làm` · `local` (đạt trên máy, PostgreSQL thật hoặc mock như ghi chú) · `cloud` (đạt trên môi trường Cloud, kèm revision).

TV4 cập nhật UI02 ngày 21/11/2026: Driver có Express sáng và Midnight tối,
mặc định theo hệ thống. Giao diện tổng quan, danh sách và chi tiết đơn đã kiểm
local với Edge và Auth/API giả lập (49 kịch bản đạt, bố cục 320/390/1440 px).
Xem [bàn giao Driver](features/driver-shipments-handoff.md). Chưa kiểm giao
diện mới trên Cloud. Trạng thái nghiệm thu AC03 và AC04 giữ theo bảng bên dưới.

TV3 sửa hai lỗi tracking ngày 18/11/2026: Customer/Admin tự đọc lại detail khi
status/driverId đổi, cập nhật lịch sử và khóa form theo snapshot cũ; GPS đổi
tọa độ không tải lại detail. Bản build local dùng CARTO đã cấu hình và có tile
thật; Hosting thêm predeploy build để không dùng dist cũ. Check toàn repo đạt
(166 Worker/shared/load, 2 health, 465 API, 589 web; 125 ca môi trường bỏ qua),
integration Nest/PGlite 12/12; Chrome 390/1440px cả hai role đạt, Auth/API mock.
Chưa deploy hoặc nghiệm thu bản sửa trên Cloud; không nâng toàn bộ AC05.
[Báo cáo và ảnh bản sửa](evidence/tv3-tracking-cloud-week8/report.md).

Ghi nhận mới nhất 18/11/2026: W707 đã đối chiếu GPS tới SQL, gồm khôi phục
9 mẫu DLQ, history đủ 17 mẫu và current đúng mẫu hợp lệ mới nhất. Nghiệm thu
chạy với Worker `00026-xkd` được bật tạm; đã hoàn nguyên min 0, Request-based
theo giới hạn chi phí của người dùng. Không nâng toàn bộ AC04/AC05 lên Cloud.
Xem [kết quả và giới hạn vận hành](evidence/driver-cloud-week8/evening-report.md).

Cập nhật: 15/11/2026, bản tích hợp `merge/gps-week8` gồm emitter `2585638` và k6 `930e59e`, từ `develop@f28365d`.
Kiểm tra bản kết hợp: `npm run check` đạt (web 584, API 454, Worker/shared/load 166,
health e2e 2); 116 ca PostgreSQL/Firebase emulator bỏ qua do thiếu cấu hình.

| AC | Hành vi | API / thành phần | Lệnh kiểm tra | Trạng thái |
| --- | --- | --- | --- | --- |
| AC01 | Customer tạo đơn, chống tạo trùng bằng `Idempotency-Key`, ghi đơn, lịch sử và thông báo trong một transaction | API01, DATA02 | `npm test --workspace=@parcelflow/api -- shipments.postgres` | local |
| AC02 | Admin gán và gán lại tài xế trước khi lấy hàng; khóa dòng chống gán cạnh tranh | API04, API11 | `npm test --workspace=@parcelflow/api -- assignments.postgres` | local |
| AC03 | Tài xế được gán lấy hàng rồi giao hàng; gọi lặp không ghi thêm; sai người hoặc sai bước bị chặn | API05, API06 | `npm test --workspace=@parcelflow/api -- assignments.postgres shipment-flow` | local |
| AC04 | Driver gửi GPS; Worker ghi lịch sử và vị trí hiện tại, mẫu đầu tiên thắng, không lùi vị trí, ACK sau commit | API08, EVT01, DATA04, DATA05 | `npm test -- gps-writer gps-duplicate-order` (cần `WORKER_TEST_DATABASE_URL`, thiếu thì bị bỏ qua) | local; pipeline Cloud đã đối chiếu W707, chưa nghiệm thu toàn bộ AC04 |
| AC05 | Customer chủ đơn xem vị trí tài xế gần real-time, ẩn hoặc hiện theo trạng thái, nhãn vị trí cũ | API09, UI01 | `npm test --workspace=@parcelflow/api -- assignments.postgres`, `npm run test:integration --workspace=@parcelflow/web`; web UI mock: `npm test --workspace=@parcelflow/web -- tracking` | local (API09 Nest/PGlite, bản đồ UI mock; Cloud chưa xác nhận) |
| AC06 | Lịch sử trạng thái đúng thứ tự, đúng người thực hiện, đúng phạm vi quyền | API02, API03 | `npm test --workspace=@parcelflow/api -- shipment-flow` (TC06.1) | local |
| AC07 | Báo giao thất bại sau khi lấy hàng; phát hiện giao trễ | API07 | Chưa có | chưa có (việc tuần 9) |
| AC08 | Thông báo tạo cùng lúc đổi trạng thái; người dùng chỉ đọc thông báo của mình | API10, DATA06 | `npm test --workspace=@parcelflow/api -- notifications` | local |
| AC09 | ETA Haversine 20 km/h khi đơn đang giao và vị trí còn mới; không sửa hạn giao | ETA01, API09 | `npm test --workspace=@parcelflow/api -- assignments.postgres` và `npm test -- eta` | local (Cloud chưa xác nhận) |
| AC10 | Phân quyền 3 role; sai quyền 403, chưa liên kết user 409, không token 401 | AUTH01 | `npm test --workspace=@parcelflow/api -- auth shipment-flow` (TC10.x) | local |

Phần client AC04/UI02: emitter lọc mẫu sai/cũ/accuracy, buffer RAM có giới hạn,
gửi bù có backoff, tách buffer/token theo tài khoản và dọn khi rời trang. Đạt
local: bộ emitter/dashboard/queue/adapter 113/113; Edge 47/47 với Auth/API mock,
layout 320/390/1440 px. Xem [bàn giao emitter tuần 8](features/gps-emitter-reliability-handoff.md)
và [báo cáo browser](evidence/gps-emitter-reliability/report.json). Không nâng
trạng thái Cloud của AC04 hoặc checkpoint tuần 8 từ các kiểm tra này.

Một số test chỉ chạy trên PostgreSQL thật, thiếu biến thì bị bỏ qua (vẫn báo đạt, nên đọc số "skipped"):

| Biến | Test |
| --- | --- |
| `SHIPMENT_TEST_DATABASE_URL` | `shipments.postgres`, `assignments.postgres` chế độ PostgreSQL thật (mặc định chạy PGlite) |
| `TV6_ADMIN_TEST_DATABASE_URL` | `shipment-flow`, `admin-directory.postgres` |
| `WORKER_TEST_DATABASE_URL` | `gps-writer.postgres`, `gps-duplicate-order` |

Mỗi biến phải trỏ tới DB loopback dùng tạm; test tự tạo và xóa schema riêng.

Kết quả từng tuần và bằng chứng Cloud ghi ở [điều phối theo tuần](coordination/README.md).

TV4 tuần 9 (21/11/2026) hoàn thiện [k6 API08](../infra/load/README.md) với tải
cố định tùy chọn, số offered/accepted, lỗi, p95 HTTP và số lượt bị bỏ. Kiểm
local đạt 48 test cấu hình/hợp đồng và 7/7 smoke bằng k6 thật → Nest HTTP,
với Firebase, lookup và Pub/Sub mock. `npm run check` đạt, 125 ca cần
PostgreSQL thật hoặc Firebase emulator bị bỏ qua. Dry-run Cloud đạt 12/12
accepted, 0 lỗi, p95 HTTP 1.209,90 ms. Các điểm đo `gps-events-sub` ghi tổng
backlog bằng 0. Worker nhận 12 mẫu history-only do clock skew. Xem
[báo cáo Cloud](evidence/gps-ingest-load/week-09-cloud.md).

Công cụ thử tải GPS tuần 8 (15/11/2026): nhánh `test/gps-ingest-load` từ
`develop@f28365d` có [script k6 và hướng dẫn](../infra/load/README.md) cho API08,
tham số số Driver/nhịp/thời gian, token riêng theo Driver và JSON summary.
Đạt local: 44/44 test config/contract và 5/5 smoke k6 thật → Nest HTTP với
Firebase/lookup/PubSub mock, 6/6 accepted từ 2 Driver × 3 mẫu. Bằng chứng ở
[report](evidence/gps-ingest-load/report.json). `npm.cmd run check` exit 0
(Worker/shared/load 166, API 454, web 538, health e2e 2; 116 ca môi trường bị
bỏ qua). Không thay trạng thái AC04/Cloud hoặc kết luận NFR từ smoke này;
base của lượt k6 riêng chưa bao gồm emitter. Bản kết hợp ngày 15/11 đã được
kiểm tra lại bằng check toàn repo và 5/5 smoke k6 (6/6 accepted); xem
[bằng chứng tích hợp](evidence/gps-week8-merge/report.json). Code hai phần giữ
nguyên, chỉ giải quyết xung đột tài liệu; chưa deploy/nghiệm thu Cloud.

Nghiệm thu TV4 trên Cloud ngày 17/11/2026: đã bật lại `int3326esql` theo
cho phép của người dùng, khắc phục lỗi đọc đơn do DB Stopped. **W713 đạt**:
đơn kiểm thử mới `PF20261117CGDANJ` được Customer tạo, Admin gán, Driver lấy
hàng 16:36 và giao thành công 16:39; đọc lại trên cả ba role khớp lịch sử,
ghi chú và tracking kết thúc. API revision `backend-service-00036-f67`.
**W707 còn mở**: sau khôi phục DB, GPS vẫn 503 tại publish, 6 mẫu/0 accepted;
chưa đối chiếu Worker/SQL. Cần người có quyền xác minh quyền publish cấp
topic của service account API; Console hiện tại không cho xem topic IAM.
`npm run check` đạt trên `8168a1a`, code giữ nguyên `develop@2ed8f04`
(125 ca môi trường bỏ qua). Không nâng toàn bộ AC03/AC04/AC05 lên Cloud.
Xem [bằng chứng và bước tiếp tục](evidence/driver-cloud-week8/report.md).

Chẩn đoán W707 ngày 17/11/2026 trên nhánh `fix/gps-publish-diagnostics`: API
đã bổ sung log mã gRPC an toàn ở `locations.publish`, giữ log `eventId` và
response 503 khi broker chưa xác nhận. Bộ API08/diagnostics local đạt 69/69
(Firebase/lookup/PubSub mock); `npm run check` đạt (Worker/shared/load 166,
API 465, web 584, health e2e 2; 125 ca môi trường bỏ qua). Chưa deploy bản log này. Console xác nhận topic
và subscription tồn tại nhưng phiên Editor không xem được IAM cấp topic,
không cấp được quyền project và không chạy được Policy Troubleshooter.
W707/AC04 giữ nguyên trạng thái chưa nghiệm thu Cloud; xem
[hướng chẩn đoán](features/deploy.md#api08-trả-503-khi-publish-gps).

Kiểm lại TV4 tối 17/11/2026 trên Cloud: người dùng đã bật DB (Console ghi
Started 20:57:04, Overview Runnable). Driver gửi GPS mô phỏng hơn hai phút,
17/17 accepted, pending 0; buffer tăng khi Offline và gửi hết sau khôi phục.
Đã lưu ảnh 390 CSS px, response 202 và cùng eventId qua API Broker Confirmed
(`backend-service-00037-4c5`) → Worker (`worker-service-00025-hnp`). Lỗi publish
503 không tái hiện; chưa xác minh thay đổi/SHA của các revision mới. Worker
từng lỗi kết nối SQL và nhận lại message; mẫu cuối history-only do lệch giờ.
W707/AC04 vẫn mở cho đối chiếu SQL; SQL Studio cần người dùng đăng nhập DB.
Chưa kiểm marker Customer/Admin trong lượt tối. Xem
[bằng chứng buổi tối](evidence/driver-cloud-week8/evening-report.md).

Đóng W707 ngày 18/11: SQL Studio database `parcelflow` xác nhận mẫu cuối đã
commit; phát hiện 9/17 mẫu ở DLQ sau timeout SQL. Người dùng cho phép bật
Worker min 1, Instance-based tối đa 20 phút: revision `worker-service-00026-xkd`
100% traffic từ 07:50:36. Phát lại đúng 9 payload, giữ eventId/clientTimestamp/
receivedAt; SQL sau replay có đủ seq 1–17, 17 eventId và timestamp riêng biệt.
Current là seq 11 `evt_448a87a7-8d70-4b87-a419-2bf4ec2092b1`, có cùng eventId
ở API Broker Confirmed, Worker, history và current. Các mẫu future không được
đổi timestamp khi replay. Đã xác nhận hoàn nguyên min 0, Request-based trước
08:08:33; cấu hình này không bảo đảm Streaming Pull chạy nền. Không ACK/xóa
bản gốc trong DLQ, không đổi schema/IAM/secret, không deploy code API. Check
toàn repo đạt ngày 18/11 trên `c344f50` đã tích hợp `develop@ef93b55`
(166 Worker/shared/load, 465 API, 584 web, 2 health;
125 ca môi trường bỏ qua). Marker Customer/Admin còn thuộc checkpoint nhóm.
