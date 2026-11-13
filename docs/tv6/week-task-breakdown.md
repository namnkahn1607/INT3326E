# ParcelFlow: phân rã công việc tuần 4–13

Ngày soạn: 05/11/2026. Nguồn: tab "Tiến độ 10 Tuần" của sheet phân công, Phần III (FR/AC), IV (NFR, LT, REC), VI.14 (TC) và VII của đặc tả v1.4.

Tài liệu này chỉ tách các dòng trong sheet thành đầu việc nhỏ hơn. Người phụ trách, phạm vi tuần và checkpoint giữ nguyên như sheet. Không có việc nào ở đây tự đánh dấu đã xong.

## Cách đọc

- Mã việc theo mẫu của Phần VII: `W<tuần>-TV<người>-<số>`. Tuần 7 chép lại từ ví dụ trong đặc tả.
- Dispatcher là Admin làm điều phối, không có role thứ tư. `POST /location` trong sheet là `POST /v1/locations`.
- "Tiêu chí" dẫn mã FR/AC/NFR/TC/LT/REC của đặc tả. Chỉ tính đạt khi có bằng chứng đúng môi trường (mock, SQL local hay Cloud), ghi riêng từng loại.
- Mỗi việc bàn giao thêm: commit/PR, môi trường hoặc revision, người rà soát, phần chưa đạt.
- Thứ tự tích hợp chung: chốt contract, tài khoản, schema; rồi API và Worker; rồi UI và cấu hình Cloud; rồi QA đầu cuối; cuối cùng sửa lỗi và xác nhận checkpoint. Việc độc lập làm song song, không dồn kiểm thử đến tuần 11.

| TV | Họ tên | Mảng |
| --- | --- | --- |
| TV1 | Nguyễn Lê Nam Khánh | Backend nghiệp vụ (Shipment) |
| TV2 | Nguyễn Lê Na | GPS và Worker |
| TV3 | Lê Đình Anh Tuấn | Frontend Customer/Admin |
| TV4 | Nguyễn Minh Anh | Frontend Driver, GPS emitter, load test |
| TV5 | Trần Đại Quang | Cloud, CI/CD, giám sát |
| TV6 | Đỗ Đức Đạt | Auth, Admin, notification, QA |

## Tuần 4–6: đã đánh dấu xong trong sheet

Không phân rã lại. Sheet ghi TRUE cho cả 18 dòng. Người làm thực tế khác phân công (ví dụ Đạt làm API assign tuần 6 thay TV1) ghi riêng ở báo cáo, không sửa ngược sheet.

| Tuần | Checkpoint |
| --- | --- |
| 4 (12/10–18/10) | URL chung truy cập được, health check hai Cloud Run service trả 200, Pub/Sub topic/subscription tồn tại. |
| 5 (19/10–25/10) | Customer đăng nhập, tạo và xem đơn thật lưu trên Cloud SQL. |
| 6 (26/10–01/11) | Dispatcher gán được tài xế; message GPS test thấy trong Pub/Sub console. |

## Tuần 7 (02/11–08/11)

Checkpoint: luồng tạo đơn đến giao hàng hoạt động hoàn chỉnh; vị trí driver ghi được qua Worker.

| Mã | Việc | Phụ thuộc | Đầu ra | Tiêu chí |
| --- | --- | --- | --- | --- |
| W7-TV1-01 | Pickup/deliver: kiểm tra driver và trạng thái, transaction, lưu history/notification | Assign tuần 6, contract Phần VI | API pickup, deliver, kèm test | FR03, AC03, TC03.1–03.4 |
| W7-TV1-02 | Endpoint history đúng scope, thứ tự, phân trang | W7-TV1-01 | API history, bàn giao method/path/payload/mã lỗi cho TV3 | FR06, AC06 |
| W7-TV2-01 | Đồng bộ schema và migration GPS (cột camelCase theo DATA04/05 cho cả Worker và API directory) | Schema DATA04/DATA05, TV6 | Mapping chốt theo DB thật | AC04; điểm tích hợp 1 trong báo cáo 04/11 |
| W7-TV2-02 | Consume, ghi history/current vào SQL, ACK sau commit | W7-TV2-01 | Bằng chứng một mẫu đi từ queue đến SQL | FR04, TC04.8; chưa tính đạt toàn bộ AC04 |
| W7-TV3-01 | Hiển thị tiến độ cho Admin theo quyền | W7-TV1-01 | UI tiến độ, không thêm quyền ngoài FRD | FR03, FR10 |
| W7-TV3-02 | Customer xem history từ API thật, có loading/rỗng/lỗi | W7-TV1-02 | Tab lịch sử bỏ dữ liệu mẫu | FR06, AC06 |
| W7-TV4-01 | Lấy vị trí trình duyệt hoặc simulator có nhãn | Driver dashboard tuần 6 | `GpsEmitter` thay tọa độ cố định | FR04 |
| W7-TV4-02 | Gửi bằng tài khoản Driver thật, đúng contract, chu kỳ 8 giây, báo lỗi/quyền định vị | API ingest, liên kết danh tính | Driver gửi được GPS đổi theo nguồn | AC04, TC04.1–04.2 |
| W7-TV5-01 | Kiểm tra runtime, IAM, SQL của API và Worker | Mapping W7-TV2-01 | Ghi nhận cấu hình, không lộ secret | NF12 |
| W7-TV5-02 | Triển khai đúng source/revision, smoke có mẫu ghi SQL | W7-TV2-02, W7-TV5-01 | Revision gắn SHA, smoke có hàng SQL | NF10 |
| W7-TV6-01 | Chuẩn bị tài khoản Customer/Admin/Driver và đơn test | Auth tuần 5 | Fixture theo `docs/qa/test-plan.md` | AC10 |
| W7-TV6-02 | Chạy create, assign, pickup, deliver; sai quyền; history; đối chiếu SQL; bằng chứng Cloud | Các việc trên | Bảng kết quả theo ca, PASS/FAIL/BLOCKED | AC01–AC03, AC06, AC10 |

Cần đối chiếu: sheet ghi TV5 triển khai push subscription, code hiện dùng pull. Nhóm quyết định, không tự đổi runtime.

## Tuần 8 (09/11–15/11)

Checkpoint: Customer thấy vị trí tài xế cập nhật gần real-time trên cloud. Trễ ở đây thì tuần 8–9 (load test) gặp rủi ro, nên ưu tiên cao nhất.

| Mã | Việc | Phụ thuộc | Đầu ra | Tiêu chí |
| --- | --- | --- | --- | --- |
| W8-TV1-01 | Sửa bug luồng shipment phát sinh từ QA tuần 7 | Báo cáo W7-TV6-02 | Danh sách lỗi đã đóng kèm commit | AC01–AC03 |
| W8-TV1-02 | Hỗ trợ API đọc tracking đúng scope owner | W8-TV2-02 | Endpoint tracking trả đủ key theo `ShipmentTrackingResponse` | FR05, AC05, NF04 |
| W8-TV2-01 | Idempotency: `ON CONFLICT ("driverId", "clientTimestamp")`, giữ bản đầu | W7-TV2-02 | History một dòng mỗi khóa mẫu | AC04, NF08, TC04.3, TC04.6 |
| W8-TV2-02 | Out-of-order: current chỉ tiến theo mẫu hợp lệ mới hơn, xử lý mẫu tương lai | W8-TV2-01 | Current không lùi; test trên PostgreSQL thật | AC04, NF08, TC04.4, TC04.5, REC04 |
| W8-TV3-01 | Bản đồ Leaflet cho Customer | Contract tracking | Map hiển thị vị trí, không lỗi khi chưa có GPS | FR05, AC05 |
| W8-TV3-02 | Polling nối `current_location`, dừng khi rời trang, báo cũ/stale | W8-TV3-01 | Polling dọn đúng khi unmount | AC05, TC05.1–05.3 |
| W8-TV4-01 | Xử lý GPS stale/invalid ở emitter, gửi lại mẫu giữ timestamp | W7-TV4-02 | Emitter không gửi tọa độ sai | TC04.7, REC06 |
| W8-TV4-02 | Phác thảo load test script | NFR Phần IV | Bản nháp theo LT01–LT03 | NF01, NF02 |
| W8-TV5-01 | Giám sát Pub/Sub backlog và latency qua Cloud Monitoring | Revision tuần 7 | Biểu đồ backlog, tuổi message cũ nhất | NF10 |
| W8-TV5-02 | Tune concurrency Cloud Run | W8-TV5-01 | Cấu hình ghi lại cùng số đo trước/sau | NF05, NF06 |
| W8-TV6-01 | QA tracking: owner, driver sau reassign, GPS terminal không lộ | W8-TV3-02 | Bảng kết quả TC05.x | AC05, NF09 |
| W8-TV6-02 | Thủ công duplicate và out-of-order, đối chiếu manifest với SQL | W8-TV2-02 | History/current khớp manifest | AC04, LT06, TC04.3–04.5 |

## Tuần 9 (16/11–22/11)

Checkpoint: hoàn thành đầy đủ 8 use case bắt buộc. Đặc tả không liệt kê rõ tám use case nào trong FR01–FR10, nhóm cần chốt danh sách trước khi nghiệm thu.

| Mã | Việc | Phụ thuộc | Đầu ra | Tiêu chí |
| --- | --- | --- | --- | --- |
| W9-TV1-01 | Fail giao hàng: chỉ sau pickup, có reason, retry không sửa reason | Pickup tuần 7 | API fail, audit Admin can thiệp | FR07, AC07, TC07.1–07.2 |
| W9-TV1-02 | Suy ra late từ hạn giao (trước/đúng/sau hạn, hạn trống là unknown) | W9-TV1-01 | Cờ `isLate` đúng khi đọc lại | AC07, TC07.3 |
| W9-TV2-01 | Expose query `current_location` cần cho ETA | W8-TV2-02 | Hàm/endpoint đọc nội bộ, null khi thiếu GPS | FR09 |
| W9-TV2-02 | Kiểm tra độ mới của mẫu (biên 30 giây) | W9-TV2-01 | Quy tắc stale thống nhất với TV3 | AC09, NF04 |
| W9-TV3-01 | UI failed/late | W9-TV1-01/02 | Hiển thị lý do và cờ trễ từ server | FR07, AC07 |
| W9-TV3-02 | UI notification, poll thông báo mới | W9-TV6-01 | Danh sách thông báo từ `GET /v1/notifications`; không có mark-read | FR08, AC08 |
| W9-TV4-01 | Viết load test script (k6 hoặc wrk2) nhắm GPS ingest | W8-TV4-02 | Script baseline và peak | NF01, NF02, LT01–LT02 |
| W9-TV4-02 | Kịch bản burst, kịch bản offline-gửi-lại | W9-TV4-01 | Script LT03 | LT03, REC06, TC04.7 |
| W9-TV5-01 | CI/CD GitHub Actions: build, test | Repo develop | Workflow chạy trên PR | NF12 |
| W9-TV5-02 | CI/CD: deploy, ghi revision gắn SHA | W9-TV5-01 | Deploy có thể truy ngược về commit | NF12 |
| W9-TV6-01 | Backend notification: tạo khi đổi trạng thái, mỗi event thật đúng một thông báo | Vòng đời tuần 7 | Bảng notification, API đọc theo chủ đơn | FR08, AC08, TC08.1–08.2 |
| W9-TV6-02 | Admin cơ bản (driver/account) trong phạm vi đã chốt | Directory tuần 6 | Không thêm CRUD hay cấp role ngoài phạm vi, giữ ADM15 | FR10, AC10 |

## Tuần 10 (23/11–29/11)

Checkpoint: ETA hoạt động cùng tracking.

| Mã | Việc | Phụ thuộc | Đầu ra | Tiêu chí |
| --- | --- | --- | --- | --- |
| W10-TV1-01 | Hỗ trợ sửa bug tích hợp tuần 9 | Báo cáo QA | Danh sách lỗi đã đóng | AC01–AC08 |
| W10-TV1-02 | Gắn ETA vào response tracking | W10-TV2-01 | Key `eta`, `etaUnavailableReason` đúng | FR09, AC09 |
| W10-TV2-01 | ETA Haversine kèm hệ số điều chỉnh, chỉ cho PICKED_UP | W9-TV2-01 | Hàm ETA, `null` kèm lý do, không NaN/Infinity | AC09, TC09.1–09.4 |
| W10-TV2-02 | Expose cùng tracking, không đổi `expectedDeliveryAt` | W10-TV2-01 | Test biên 0 và 30 giây, hai điểm giống nhau | AC09 |
| W10-TV3-01 | Hiển thị ETA trên map | W10-TV1-02 | ETA hoặc lý do rõ ràng | FR09, AC09 |
| W10-TV3-02 | Trạng thái loading/rỗng/lỗi của tracking | W10-TV3-01 | Ba trạng thái phân biệt được | AC05 |
| W10-TV4-01 | Hoàn thiện load test đúng số NFR | W9-TV4-01 | Script theo LT01–LT05 | NF01–NF05 |
| W10-TV4-02 | Dry-run trên staging | W10-TV4-01, TV5 | Báo cáo dry-run, nêu rõ chưa phải số đo chính thức | LT01 |
| W10-TV5-01 | Auto deploy khi merge main | W9-TV5-02 | Pipeline có cổng test | NF12 |
| W10-TV5-02 | Kiểm tra rollback | W10-TV5-01 | Quay về revision cũ và smoke lại | NF12 |
| W10-TV6-01 | QA ETA | W10-TV2-02 | Bảng kết quả TC09.x | AC09 |
| W10-TV6-02 | Phân quyền chéo customer/driver/dispatcher/admin: đoán ID, giả actor, driver sau reassign | Toàn bộ API | Ma trận role × API × quan hệ owner | FR10, AC10, NF09, TC10.1–10.3 |

## Tuần 11 (30/11–06/12)

Checkpoint: hệ thống ổn định trên cloud; kịch bản demo recovery sẵn sàng.

| Mã | Việc | Phụ thuộc | Đầu ra | Tiêu chí |
| --- | --- | --- | --- | --- |
| W11-TV1-01 | Integration test cho module Shipment (create, assign, pickup, deliver, fail) | Vòng đời đủ | Test chạy trên PostgreSQL thật | AC01–AC03, AC07, NF08 |
| W11-TV1-02 | Test đồng thời và gọi lặp (assign/pickup race, retry) | W11-TV1-01 | Chỉ một terminal, không lặp tác động | NF08, TC02.5, TC03.x |
| W11-TV2-01 | Integration test cho GPS pipeline | Worker tuần 8 | Test queue đến SQL, ACK sau commit | AC04, TC04.8, REC02–REC05 |
| W11-TV2-02 | Kịch bản recovery-demo: kill rồi restart Worker | W11-TV2-01, TV5 | Quy trình lặp lại được | NF06, REC01 |
| W11-TV3-01 | Polish UI, sửa lỗi toàn bộ màn hình | Các UI trước | Danh sách lỗi UI đã đóng | AC05, AC06, AC08 |
| W11-TV3-02 | Kiểm tra trên trình duyệt thật, a11y cơ bản | W11-TV3-01 | Bằng chứng trình duyệt | FR05, FR06 |
| W11-TV4-01 | Dry-run baseline khoảng 60 event/s | W10-TV4-01 | Số đo offered/accepted/committed | NF01, LT01 |
| W11-TV4-02 | Chuẩn bị manifest LT06 và dữ liệu mô phỏng | W11-TV4-01 | Manifest mẫu mới/cũ/lặp | LT06, NF08 |
| W11-TV5-01 | Kiểm tra backup/restore Cloud SQL thủ công | Cloud SQL | Biên bản restore | NF07 |
| W11-TV5-02 | Review chi phí, hoàn thiện CI/CD | W10-TV5-02 | Báo cáo chi phí có ngày giá | NF11, NF12 |
| W11-TV6-01 | QA toàn diện: đủ use case đã chốt và phân quyền | Toàn bộ | Bảng kết quả theo ca, local/mock tách khỏi Cloud | AC01–AC10 |
| W11-TV6-02 | Dry-run backup-deploy cùng TV5 | W11-TV5-01 | Biên bản dry-run | NF07, NF12 |

## Tuần 12 (07/12–13/12)

Checkpoint: có bộ số liệu performance/scalability thật, release candidate sẵn sàng.

| Mã | Việc | Phụ thuộc | Đầu ra | Tiêu chí |
| --- | --- | --- | --- | --- |
| W12-TV1-01 | Sửa bug shipment phát sinh từ load test | LT05 | Lỗi đóng kèm commit | NF03 |
| W12-TV1-02 | Đo p95 Create/Assign trong LT05 | W12-TV4-02 | Số đo từng operation | NF03 |
| W12-TV2-01 | Theo dõi và tune Worker, Pub/Sub khi chạy tải | W11-TV2-02 | Cấu hình tune kèm số đo | NF02, NF06 |
| W12-TV2-02 | Đối chiếu history/current với manifest sau tải | W11-TV4-02 | Báo cáo reconciliation | NF08, LT06 |
| W12-TV3-01 | Sửa lỗi UI lúc burst (ví dụ map chậm) | W12-TV4-01 | Danh sách lỗi đóng | NF04 |
| W12-TV3-02 | Đo trải nghiệm polling dưới tải | W12-TV3-01 | Ghi chú đo | LT04 |
| W12-TV4-01 | Chạy baseline 60 event/s và 5× (khoảng 300 event/s) | W11-TV4-01 | Latency, throughput; offered/accepted/committed | NF01, NF02, NF05, LT01–LT03 |
| W12-TV4-02 | Chạy tracking và mixed business | W12-TV4-01 | Số đo p95 tracking và Create/Assign | NF03, NF04, LT04–LT05 |
| W12-TV5-01 | Dashboard Cloud Monitoring: latency, tuổi backlog, error rate | W8-TV5-01 | Dashboard có requestId/eventId đối chiếu | NF10 |
| W12-TV5-02 | Chụp số liệu trong lúc chạy tải, báo cáo chi phí | W12-TV5-01 | Ảnh/số liệu gắn thời điểm chạy | NF10, NF11 |
| W12-TV6-01 | Tổng hợp kết quả load test và QA theo mẫu Phần IV mục 9 | W12-TV4-02 | Bảng NF03, NF04, NF05, NF06, NF11 | Đạt hoặc chưa đạt, không làm tròn |
| W12-TV6-02 | Tiếp tục sửa bug, xác nhận release candidate | W12-TV6-01 | Danh sách lỗi còn mở | AC01–AC10 |

## Tuần 13 (14/12–20/12)

Checkpoint: sản phẩm, tài liệu và số liệu sẵn sàng bàn giao. Sheet giao việc cho cả nhóm, nên mã dùng `W13-ALL`.

| Mã | Việc | Đầu ra |
| --- | --- | --- |
| W13-ALL-01 | Dự phòng sửa bug | Danh sách lỗi cuối đã đóng hoặc ghi rõ còn mở |
| W13-ALL-02 | Mỗi người hoàn thiện báo cáo và ADR của module mình | Báo cáo ghi đúng người có commit và đúng môi trường kiểm tra |
| W13-ALL-03 | Chuẩn bị Architecture Defense, nhất là câu 6 (tải 5×/10×) và câu 11 (chi phí) | Số liệu từ tuần 12 gắn với NF02, NF11 |
| W13-LEAD-01 | Nhóm trưởng rà tài khoản demo cho từng vai trò | Giảng viên kiểm tra được mọi luồng; sheet chưa ghi tên nhóm trưởng |

## Điểm cần nhóm chốt

1. Danh sách "8 use case bắt buộc" của checkpoint tuần 9.
2. Push hay pull cho Worker (dòng tuần 7 của TV5 so với code hiện tại).
3. Cột GPS: đặc tả dùng camelCase, Worker của Na đã đổi theo (nhánh chưa merge), Worker trên `develop` vẫn snake_case. Cần merge nhánh của Na và chốt theo DB thật.
4. Phân rã trên chưa tính độ lệch người được giao với người làm thực tế.

## Mẫu bàn giao mỗi việc

| Mã | Commit/PR | Môi trường/revision | Người rà soát | Kết quả | Phần chưa đạt |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
