# Week 9 (16/11–22/11): giao việc

Mục lục: [Điều phối theo tuần](README.md)

**Checkpoint:** Hoàn thành đầy đủ 8 use case bắt buộc (AC01–AC08) trên Cloud.

**Việc theo sheet (giữ nguyên):**

| TV | Việc tuần 9 |
| --- | --- |
| TV1 | Logic phát hiện failed/late delivery |
| TV2 | Chuẩn bị nền tảng cho ETA — expose query current_location cần thiết |
| TV3 | UI failed/late delivery, UI notification (poll thông báo mới) |
| TV4 | Tiếp tục viết load test script (k6/wrk2) nhắm vào GPS ingest |
| TV5 | Thiết lập CI/CD (GitHub Actions build + test + deploy) |
| TV6 | Backend notification (tạo khi đổi trạng thái), backend Admin cơ bản (quản lý driver/account) |

**Tình hình đầu tuần (20/11, tuần 8 chốt trễ):**
- Code tuần 8 chốt ở PR #47 (`week/08` → `main`, `9803e72`), chờ duyệt. Trên Cloud đã đạt AC01–AC06 và AC10 ([regression 20/11](../tv6/week-08.md)).
- Phần đã có sẵn liên quan việc tuần 9:
  - Cờ giao trễ `isLate` đã tính trong response đơn theo `expectedDeliveryAt`.
  - Thông báo đã tạo khi tạo đơn, gán tài xế, lấy hàng, giao hàng; API đọc thông báo `GET /v1/notifications` đã có.
  - Admin đã có API đọc danh sách tài xế và khách hàng (chỉ đọc).
  - Web Admin đã có form báo giao thất bại gọi `POST /v1/shipments/{id}/fail`, **nhưng API chưa có route này** (API07 trong OpenAPI vẫn là bản nháp).
- Chỉ còn đến 22/11. Việc của TV1 và TV3 chặn AC07, AC08 nên làm trước.

**Quy ước chung:**
- Mỗi người làm trên nhánh riêng, mở PR vào `develop`, có ít nhất một người review. **Không đẩy thẳng vào `develop`.**
- Mỗi PR kèm kết quả test của phần mình. Kết quả trên Cloud kèm URL hoặc revision.
- Không đưa mật khẩu, key, token vào Git hay nhóm chat. Không tự sửa secret, IAM, bật/tắt DB; cần thì báo TV5.

---

## TV1: logic phát hiện failed/late delivery (GẤP, chặn AC07)

- **Failed:** viết API07 `POST /v1/shipments/{id}/fail`, body `{ reason }`.
  - Tài xế hiện hành hoặc Admin, đơn đang `PICKED_UP`, chuyển sang `DELIVERY_FAILED`.
  - Ghi `failureReason`, `failedByRole`, `failedByUserId` và lịch sử trạng thái trong cùng transaction, giống pickup/deliver.
  - Gọi lặp khi đã `DELIVERY_FAILED` trả 200 no-op; sai người 403, sai bước 409, lý do rỗng 400.
- **Late:** kiểm logic `isLate` đang có, thêm test đơn quá hạn và chưa quá hạn.
- Cập nhật OpenAPI (bỏ nhãn bản nháp của API07), dòng AC07 trong `docs/features.md`.
- **Đầu ra:** PR kèm test PostgreSQL thật (gọi lặp, đồng thời, sai quyền). Xong báo TV3 và TV6.

## TV2: nền tảng cho ETA

- Cung cấp truy vấn vị trí hiện tại của tài xế (`current_locations`) mà ETA tuần 10 cần, kèm test và ghi vào tài liệu bàn giao.
- **Tồn tuần 8:** Worker đang NACK cả lỗi không thể tự hết (khóa ngoại `23503`). Sửa để lỗi này đi DLQ, chỉ NACK lỗi tạm thời.

## TV3: UI failed/late delivery, UI notification (GẤP, chặn AC08)

- **Notification:** nối trang Thông báo của Customer với `GET /v1/notifications`, bỏ dữ liệu minh họa; hỏi thông báo mới định kỳ, không chồng request (BUG-W8-03).
- **Failed:** Driver có nút báo giao thất bại kèm lý do khi đơn `PICKED_UP`, gọi API07 của TV1. Kiểm lại form Admin đã có.
- **Late:** hiện cờ giao trễ trên chi tiết đơn Customer và Admin.
- **Đầu ra:** PR kèm test, ảnh 390px và 1440px.

## TV4: load test script

- Hoàn thiện script k6 trong `infra/load/` nhắm vào `POST /v1/locations`.
- Dry-run nhỏ trên Cloud khi TV5 bật DB, ghi offered/accepted, lỗi, p95, backlog Pub/Sub.

## TV5: CI/CD

- GitHub Actions: build và chạy `npm run check` trên mỗi PR; deploy khi merge (có thể làm bước deploy ở tuần 10 theo sheet).
- **Tồn tuần 8 (làm ngay):**
  - BUG-W8-02: lấy key basemap tại carto.com/basemaps/apikey, giới hạn `int3326e.web.app` và `localhost`, build và deploy lại Hosting. Xóa API Access Token CARTO cũ (có quyền SQL API, đã nằm trong bundle công khai).
  - Ghi revision API, Worker và cấu hình Worker chạy nền vào `docs/features/deploy.md`.
  - Tạo thêm một tài khoản Customer và một tài khoản Driver trên Cloud cho TV6 kiểm phân quyền chéo; gửi qua kênh riêng.
- Sau khi việc của TV1, TV3, TV6 merge: deploy API và Hosting từ một SHA, báo SHA và revision.

## TV6: backend notification, backend Admin cơ bản

- **Notification:** thông báo hiện đã tạo khi tạo đơn, gán, lấy hàng, giao hàng. Bổ sung thông báo khi giao thất bại (cùng transaction với API07 của TV1), kiểm đủ các lần đổi trạng thái và người nhận đúng.
- **Admin cơ bản:** hiện chỉ có API đọc danh sách tài xế và khách hàng. Bổ sung quản lý driver/account ở mức cơ bản (tạo hoặc khóa tài khoản tài xế), có kiểm quyền Admin và test.
- Review PR của TV1, TV3; sau deploy chạy lại AC01–AC08 trên Cloud, thêm ca phân quyền chéo khi có tài khoản thứ hai.
- Chốt tuần: cập nhật file này, mở PR `week/09` → `main`.

## Thứ tự

| Bước | Việc |
| --- | --- |
| Ngay | TV1 API07. TV3 trang Thông báo. TV5 sửa key CARTO, tạo tài khoản thứ hai. TV6 thông báo khi giao thất bại, Admin cơ bản. |
| Khi API07 có PR | TV3 nối nút báo thất bại của Driver. TV6 review. |
| Sau khi merge | TV5 deploy từ một SHA. TV6 chạy AC01–AC08 trên Cloud. |
| Song song | TV2 truy vấn ETA, sửa Worker NACK. TV4 load test. TV5 CI. |

## Thực tế từng người

(Cập nhật trong tuần.)
