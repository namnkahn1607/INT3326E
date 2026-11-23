# Week 10 (23/11–29/11): giao việc

Mục lục: [Điều phối theo tuần](README.md)

**Checkpoint:** ETA hoạt động cùng tracking trên Cloud: Customer và Admin thấy thời gian dự kiến tới khi đơn đang giao.

**Tình hình đầu tuần (23/11):**
- Tuần 9 chốt ở PR #60 (`week/09` → `main`, `99db0ae`), chờ duyệt. Đủ 8 use case đã chạy trên Cloud.
- ETA đã có một phần:
  - API09 đã trả `eta` (khoảng cách, số giây, giờ tới dự kiến) khi đơn `PICKED_UP` và GPS còn mới, Haversine với vận tốc 20 km/h.
  - Vận tốc đang viết cứng `DEFAULT_SPEED_KMH = 20` ở hai chỗ: `apps/api/src/modules/shipments/shipment-response.mapper.ts` và `packages/types/src/eta.ts`.
  - Web đã đọc `eta` trong `apps/web/src/api/endpoints/tracking.ts` nhưng **chưa hiển thị** ở đâu.
- Việc tồn tuần 9: CI GitHub Actions (TV5 Minh Anh), ca phân quyền chéo trên Cloud (TV6 Đạt), giới hạn domain key CARTO và quyền publish DLQ của Worker (TV5 Minh Anh). Xem [nợ kỹ thuật](../tech-debt.md).

**Quy ước chung:**
- Mỗi người làm trên nhánh riêng, mở PR vào `develop`, có ít nhất một người review. Không đẩy thẳng vào `develop`, không tự merge PR của mình khi chưa có review.
- Mỗi PR kèm kết quả test của phần mình. Kết quả trên Cloud kèm URL hoặc revision.
- Không đưa mật khẩu, key, token vào Git hay nhóm chat. Không tự sửa secret, IAM, bật/tắt DB; cần thì báo TV5 Minh Anh.

---

## TV2 – Nguyễn Thị Lê Na: hoàn thiện tính ETA (GẤP, chặn checkpoint)

- Gộp về một chỗ tính ETA: API09 dùng hàm trong `packages/types/src/eta.ts`, bỏ bản tính lặp trong `shipment-response.mapper.ts`.
- Vận tốc đọc từ biến môi trường (ví dụ `ETA_SPEED_KMH`), mặc định 20, kiểm giá trị dương khi khởi động. Không đổi hạn giao `expectedDeliveryAt`.
- Giữ đúng điều kiện trả `eta = null`: không ở `PICKED_UP`, không có GPS, hoặc GPS cũ quá 30 giây; kèm lý do `etaUnavailableReason`.
- Test TC09.1–TC09.4 theo [bàn giao ETA](../features/eta-location-handoff.md).
- **Đầu ra:** PR kèm test, báo TV1 Khánh review và TV3 Tuấn biết nếu response đổi.

## TV3 – Lê Đình Anh Tuấn: hiển thị ETA trên tracking

- Panel tracking của Customer và Admin hiện ETA khi có: còn bao nhiêu phút, giờ tới dự kiến, khoảng cách.
- Khi `eta = null`, hiện lý do dễ hiểu theo `etaUnavailableReason` (chưa lấy hàng, GPS cũ, chưa có GPS…).
- Ghi rõ đây là ước lượng đường chim bay, không phải hạn giao.
- **Đầu ra:** PR kèm test, ảnh 390px và 1440px.

## TV1 – Nguyễn Lê Nam Khánh: hỗ trợ tích hợp và sửa lỗi

- Review PR ETA của TV2 Na vì chạm vào API09.
- Sửa lỗi TV6 Đạt báo khi QA ETA và phân quyền.

## TV4 – Trần Đại Quang: load test theo NFR

- Cấu hình script k6 theo LT01 (62,5 event/s, 500 driver, warm up 2 phút, đo 10 phút) và NF05 (p95 nhận GPS dưới 150 ms).
- Chuẩn bị đủ token driver cho lượt chạy, không đưa token vào Git.
- Dry-run ở mức nhỏ trên Cloud cùng TV5 Minh Anh (cần bật DB), ghi offered/accepted, lỗi, p95, backlog.

## TV5 – Nguyễn Minh Anh: CI/CD và rollback

- **Tồn tuần 9:** GitHub Actions chạy `npm run check` trên mỗi PR vào `develop` và `main`.
- Deploy tự động khi merge vào `main` (API, Worker, Hosting), image gắn tag theo SHA.
- Thử rollback API về revision trước, ghi các bước vào `docs/features/deploy.md`.
- **Tồn tuần 9:** giới hạn domain key CARTO (`int3326e.web.app`, `localhost`), xóa hai token `eyJh…` cũ; xác nhận Worker có quyền publish `gps-events-dlq`.
- Sau khi PR ETA của TV2 Na và TV3 Tuấn merge: deploy từ một SHA, báo SHA và revision.

## TV6 – Đỗ Đức Đạt: QA ETA và phân quyền chéo

- **Tồn tuần 9:** trên Cloud, Customer thứ hai mở đơn của Customer khác bị 403; tài xế khác mở đơn bị 403; Admin gán lại tài xế thì tài xế cũ mất quyền, tài xế mới có quyền.
- Sau deploy: QA ETA trên Cloud: đơn `PICKED_UP` có GPS mới thì có ETA, GPS cũ quá 30 giây thì mất ETA, giao xong thì ẩn ETA.
- Review PR của TV2 Na, TV3 Tuấn. Chốt tuần, mở PR `week/10` → `main`.

## Thứ tự

| Bước | Việc |
| --- | --- |
| Ngay | TV2 Na gộp và cấu hình ETA. TV3 Tuấn làm giao diện ETA theo response hiện có. TV5 Minh Anh làm CI. TV6 Đạt chạy phân quyền chéo. TV4 Quang cấu hình LT01. |
| Khi TV2 Na có PR | TV1 Khánh review. TV3 Tuấn khớp lại nếu response đổi. |
| Sau khi merge | TV5 Minh Anh deploy từ một SHA. TV6 Đạt QA ETA trên Cloud. |
| Song song | TV5 Minh Anh auto deploy và rollback. TV4 Quang dry-run cùng TV5 Minh Anh. |

## Thực tế từng người

(Cập nhật trong tuần.)
