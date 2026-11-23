# Week 9 (16/11–22/11): giao việc

Mục lục: [Điều phối theo tuần](README.md)

**Checkpoint:** Hoàn thành đầy đủ 8 use case bắt buộc (AC01–AC08) trên Cloud.

**Tình hình đầu tuần (20/11, tuần 8 chốt trễ):**
- Code tuần 8 chốt ở PR #47 (`week/08` → `main`, `9803e72`), chờ duyệt.
- Trên Cloud đã đạt AC01–AC06 và AC10 ([regression 20/11](../tv6/week-08.md)).
- Còn thiếu cho checkpoint:
  - **AC07:** API chưa có báo giao thất bại (API07). Web Admin đã có form gọi `POST /v1/shipments/{id}/fail` nhưng API chưa có route. Cờ giao trễ `isLate` đã tính trong response nhưng chưa kiểm trên Cloud.
  - **AC08:** API thông báo (API10) đã có; trang Thông báo của Customer còn dữ liệu minh họa (BUG-W8-03).
- Lỗi tồn tuần 8: nền bản đồ "API KEY REQUIRED" (BUG-W8-02), Worker NACK lỗi khóa ngoại `23503`. Xem [nợ kỹ thuật](../tech-debt.md).
- Chỉ còn đến 22/11. Ưu tiên AC07 và AC08; việc khác làm sau khi hai việc này có PR.

**Quy ước chung:**
- Mỗi người làm trên nhánh riêng, mở PR vào `develop`, có ít nhất một người review. **Không đẩy thẳng vào `develop`.**
- Mỗi PR kèm kết quả test của phần mình. Kết quả trên Cloud kèm URL hoặc revision.
- Không đưa mật khẩu, key, token vào Git hay nhóm chat. Không tự sửa secret, IAM, bật/tắt DB; cần thì báo TV5.

---

## TV1: báo giao thất bại và giao trễ (GẤP, chặn AC07)

- Viết API07 `POST /v1/shipments/{id}/fail`, body `{ reason }`:
  - Tài xế hiện hành hoặc Admin, đơn đang `PICKED_UP`, chuyển sang `DELIVERY_FAILED`.
  - Ghi `failureReason`, `failedByRole`, `failedByUserId`, lịch sử trạng thái và thông báo trong cùng transaction, giống pickup/deliver.
  - Gọi lặp khi đã `DELIVERY_FAILED` trả 200 no-op; sai người 403, sai bước 409; lý do rỗng 400.
- Kiểm cờ `isLate` theo `expectedDeliveryAt` và thêm test.
- OpenAPI đang có API07 dạng bản nháp: cập nhật thành bản chính thức, sửa dòng AC07 trong `docs/features.md`.
- **Đầu ra:** PR kèm test PostgreSQL thật (gọi lặp, đồng thời, sai quyền). Xong báo TV3 và TV6.

## TV3: giao diện thông báo và giao thất bại (GẤP, chặn AC08)

- Nối trang Thông báo của Customer với `GET /v1/notifications`, bỏ dữ liệu minh họa; hỏi thông báo mới định kỳ, không chồng request (BUG-W8-03).
- Driver có nút báo giao thất bại kèm lý do khi đơn `PICKED_UP`, gọi API07 của TV1. Form Admin đã có, kiểm lại khi API07 lên.
- Hiện cờ giao trễ trên chi tiết đơn Customer và Admin.
- **Đầu ra:** PR kèm test, ảnh 390px và 1440px.

## TV5: sửa Cloud và CI

- **Làm ngay (BUG-W8-02):** lấy key basemap tại carto.com/basemaps/apikey, giới hạn `int3326e.web.app` và `localhost`, build và deploy lại Hosting. Xóa API Access Token CARTO cũ (có quyền SQL API, đã nằm trong bundle công khai).
- Ghi revision API, Worker đang nhận traffic và cấu hình Worker chạy nền (min instances, CPU, chi phí) vào `docs/features/deploy.md`.
- Tạo thêm một tài khoản Customer và một tài khoản Driver trên Cloud để TV6 kiểm phân quyền chéo; gửi qua kênh riêng.
- Thiết lập GitHub Actions chạy `npm run check` trên mỗi PR (build, test). Deploy tự động làm ở tuần 10.
- Sau khi API07 và trang thông báo merge: deploy API và Hosting từ một SHA, báo nhóm SHA và revision.

## TV2: Worker và chuẩn bị ETA

- Worker ACK (đưa vào DLQ) lỗi không thể tự hết như khóa ngoại `23503`, chỉ NACK lỗi tạm thời. Thêm test.
- Cung cấp truy vấn vị trí hiện tại cho ETA tuần 10, ghi vào tài liệu bàn giao.

## TV4: load test

- Hoàn thiện script k6 trong `infra/load/` nhắm vào `POST /v1/locations`.
- Dry-run nhỏ trên Cloud khi TV5 bật DB, ghi offered/accepted, lỗi, p95, backlog Pub/Sub.

## TV6: điều phối và QA 8 use case

- Review PR của TV1, TV3 trước, vì hai PR này chặn checkpoint.
- Sau khi deploy: chạy lại AC01–AC08 trên Cloud, thêm AC07 (báo thất bại, giao trễ) và AC08 (thông báo).
- Khi có tài khoản thứ hai: Customer khác mở đơn, tài xế khác sau gán lại.
- Backend Admin cơ bản theo sheet (quản lý tài xế và tài khoản): kiểm phần đã có, ghi phần thiếu.
- Chốt tuần: cập nhật file này, mở PR `week/09` → `main`.

## Thứ tự

| Bước | Việc |
| --- | --- |
| Ngay | TV5 sửa key CARTO, tạo tài khoản thứ hai. TV1 làm API07. TV3 nối trang Thông báo. |
| Khi API07 có PR | TV3 nối nút báo thất bại của Driver. TV6 review. |
| Sau khi merge | TV5 deploy từ một SHA. TV6 chạy AC01–AC08 trên Cloud. |
| Song song | TV2 sửa Worker NACK. TV4 load test. TV5 CI. |

## Thực tế từng người

- **TV1** (21/11, nhánh `tv1/week9`): hoàn thiện `API07` (`POST /v1/shipments/:id/fail`, `Cache-Control: no-store`) cho `DRIVER` hiện hành hoặc `ADMIN` từ `PICKED_UP` sang `DELIVERY_FAILED`, hợp nhất khóa giao dịch `runLockedTransition` (kèm đọc lại snapshot mới ở nhánh no-op `DELIVERED` / `DELIVERY_FAILED` dưới `READ COMMITTED`), kiểm `isLate` đủ 3 mốc ở trạng thái active và terminal, cập nhật `docs/openapi.json`, `docs/features.md` (`AC07` mức `local`), `docs/tech-debt.md` và `docs/contracts/api-contract.md`. Đã kiểm tra trên PostgreSQL 16 thật (container tạm): `src/qa/` đạt 15/15 (gồm `TC03.4` Deliver vs Fail, Fail vs Fail đồng thời và ma trận quyền `TC10`), `assignments.postgres.spec.ts` đạt 190/192 (2 ca PGlite-only bỏ qua ở chế độ tương ứng); chưa deploy hoặc kiểm trên Cloud, chờ TV3 ghép nút Fail phía Driver và TV6 nghiệm thu `AC07`/`AC08`.
- **TV3 (22/11):** đã lấy `develop@5e79dcb` vào `feature/frontend`, bảo toàn
  phần local 18/11 và nội dung điều phối chung. Customer Notifications nối
  API10, polling 10s serial/cursor/account; Admin Accounts nối directory khách
  hàng; Customer/Admin hiện và đồng bộ `isLate` từ server. Driver có form
  fail/reason/review/no-op/recovery theo contract PR #51, chưa ghép backend
  chưa merge. Local đạt check toàn repo (181 Worker/shared/load, 2 health,
  465 API, 621 web; 125 skipped), integration Nest/PGlite 15/15, 103 test liên
  quan và browser 10 lượt 390/1440px. Bàn giao qua PR vào develop; chưa deploy. AC07/08
  Cloud còn chờ API07 tích hợp và deploy từ SHA chung. [Bàn giao và ảnh](../features/week9-frontend-handoff.md).
  Công cụ đo tracking/polling local 18/11 vẫn được giữ trong
  [tracking-read-load](../features/tracking-read-load.md); chưa đo LT04 Cloud,
  không thay thứ tự ưu tiên AC07/08 hiện tại.
- **TV2 (22/11):** hoàn thành xử lý lỗi Worker và bàn giao truy vấn vị trí ETA.
  - Phân loại lỗi database trong `GpsSubscriber`: publish sang `gps-events-dlq` rồi mới ACK (publish DLQ lỗi thì NACK để Pub/Sub thử lại, không mất message) đối với các lỗi không thể tự phục hồi như vi phạm khóa ngoại `23503`, `23502` (not null), `23514` (check), và `23P01` (exclusion) để tránh tight-loop retry kẹt tin nhắn; chỉ NACK khi gặp lỗi tạm thời (mất kết nối, timeout, `ECONNREFUSED`, `57P01` admin shutdown). Bổ sung 17 unit tests kiểm tra phân loại lỗi và publish DLQ tại `apps/worker/src/consumer/gps.subscriber.spec.ts` (đạt 22/22 tests); bộ phục hồi `recovery-scenarios.spec.ts` đạt 5/5.
  - Hoàn thiện tài liệu bàn giao kỹ thuật cho tuần 10 tại [`docs/features/eta-location-handoff.md`](../features/eta-location-handoff.md): chuẩn hóa truy vấn vị trí tức thời theo `driverId` từ bảng `current_locations` (DATA04), câu truy vấn MVCC snapshot bảo vệ trạng thái khi gán lại tài xế, công thức tính ETA Haversine 20 km/h, trần giây `Math.ceil`, quy tắc độ tươi 30 giây và ma trận kiểm thử TC09.1–TC09.4 cho TV6 (QA).

- **TV4 (21/11):** cập nhật giao diện Driver với Express sáng và Midnight
  tối, bổ sung thẻ hành trình trên trang đầu từ dữ liệu đơn được phân công.
  Kiểm trên Edge local với Auth/API giả lập (49 kịch bản đạt, gồm luồng
  lấy/giao hàng và gửi GPS). Chưa kiểm UI mới trên Cloud.
- **TV4 (21/11, load test):** hoàn thiện [k6 API08](../../infra/load/README.md)
  trên `test/tv4-week9-gps-load`. `npm run check` đạt (170 Worker/shared/load,
  2 health, 465 API, 589 web; 125 ca môi trường bị bỏ qua). Smoke k6 v2.4.0
  qua Nest HTTP local với Firebase, lookup và Pub/Sub mock đạt 7/7. Lượt
  2 Driver × 3 giây ghi 6 offered, 6 accepted, 0 lỗi, p95 30,68 ms. Tải cố
  định 2 event/s ghi 6 offered, 6 accepted, 0 drop và p95 23,22 ms. Khi đưa
  độ trễ broker giả lập vào lượt 30 event/s, k6 ghi 24 drop và trả exit 99.
  **Cloud:** dry-run 1 Driver, chu kỳ 8 giây trong 90 giây. Có 12 offered,
  12 accepted, 0 lỗi, p95 HTTP 1.209,90 ms. Tổng backlog `gps-events-sub`
  bằng 0 tại các điểm đo theo phút trước, trong và sau lượt. Worker nhận
  đủ 12 mẫu, đều đi theo nhánh history-only do clock skew. `int3326esql`
  đã về `Stopped` lúc 21:01:43 ICT. [Báo cáo Cloud](../evidence/gps-ingest-load/week-09-cloud.md).

## Chốt tuần

Chốt ngày 23/11/2026 (trễ 1 ngày) bằng PR `week/09` → `main`.

**Checkpoint đạt:** đủ 8 use case bắt buộc chạy được trên Cloud. AC01–AC06 đạt ngày 20/11 ([regression tuần 8](../tv6/week-08.md)); AC07 báo giao thất bại và AC08 thông báo đạt ngày 23/11 ([kết quả TV6](../tv6/week-09.md)).

**Đã xong trong tuần:**
- TV1: API07 `POST /v1/shipments/{id}/fail` cho Driver hiện hành và Admin, thông báo cùng transaction, kiểm `isLate` (PR #51).
- TV2: Worker đưa lỗi vĩnh viễn (`23503`, `23502`, `23514`, `23P01`) sang `gps-events-dlq` rồi mới ACK, publish DLQ lỗi thì NACK; tài liệu truy vấn vị trí cho ETA (PR #57).
- TV3: trang Thông báo gọi API10, trang Tài khoản Admin gọi directory, nút báo giao thất bại của Driver, nhãn giao trễ (PR #56).
- TV4: script k6 cho API08 và dry-run trên Cloud: 12/12 accepted, 0 lỗi, backlog 0 (PR #53, #54); giao diện Driver sáng/tối (PR #52).
- TV5: deploy API, Worker, Hosting từ `develop` có đủ code tuần 9; thay key basemap CARTO (BUG-W8-02 đã đóng); tạo tài khoản Customer và Driver thứ hai.
- TV6: review PR #51, kiểm Admin cơ bản (PR #55), kiểm AC07 và AC08 trên Cloud (PR #58), sửa PR #57.

**Lỗi đã đóng:** BUG-W8-02 (nền bản đồ), BUG-W8-03 (trang Thông báo), Worker NACK lỗi khóa ngoại.

## Chuyển sang tuần 10

- **TV5:** GitHub Actions chạy `npm run check` trên mỗi PR (việc tuần 9 chưa làm); giới hạn domain key CARTO và xóa hai token `eyJh…` cũ; xác nhận Worker có quyền publish `gps-events-dlq`.
- **TV6:** chạy ca Customer khác và tài xế khác sau gán lại mở đơn (AC10, 403) bằng tài khoản thứ hai.
- Việc tuần 10 theo sheet: ETA cùng tracking (checkpoint tuần 10). Xem [nợ kỹ thuật](../tech-debt.md).
