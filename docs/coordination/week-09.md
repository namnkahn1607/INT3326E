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

- **TV2 (22/11):** hoàn thành xử lý lỗi Worker và bàn giao truy vấn vị trí ETA.
  - Phân loại lỗi database trong `GpsSubscriber`: publish sang `gps-events-dlq` rồi mới ACK đối với các lỗi không thể tự phục hồi như vi phạm khóa ngoại `23503`, `23502` (not null), `23514` (check), và `23P01` (exclusion) để tránh tight-loop retry kẹt tin nhắn; chỉ NACK khi gặp lỗi tạm thời (mất kết nối, timeout, `ECONNREFUSED`, `57P01` admin shutdown). Bổ sung 17 unit tests kiểm tra phân loại lỗi và publish DLQ tại `apps/worker/src/consumer/gps.subscriber.spec.ts` (đạt 22/22 tests); bộ phục hồi `recovery-scenarios.spec.ts` đạt 5/5.
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
