# Week 7 (02/11–08/11)

Mục lục: [Điều phối theo tuần](README.md)

**Checkpoint:** Luồng tạo đơn đến giao hàng hoạt động hoàn chỉnh; vị trí tài xế ghi được vào SQL qua Worker.

**Trạng thái sheet:** FALSE (chưa đánh dấu).

## Giao việc theo sheet

| TV | Người | Việc |
| --- | --- | --- |
| TV1 | Nguyễn Thị Lê Nam Khánh | API cập nhật trạng thái pickup/delivery, endpoint lịch sử giao hàng |
| TV2 | Nguyễn Thị Lê Na | Worker consume topic GPS, upsert `current_locations` (chưa cần dedupe/ordering) |
| TV3 | Lê Đình Anh Tuấn | UI cập nhật trạng thái cho Admin, UI lịch sử giao hàng cho Customer |
| TV4 | Nguyễn Minh Anh | Driver app gửi GPS thật (geolocation trình duyệt hoặc simulator có nhãn) |
| TV5 | Trần Đại Quang | Deploy Worker, subscription trỏ về Worker |
| TV6 | Đỗ Đức Đạt | QA luồng end-to-end create → assign → pickup → deliver |

## Thực tế từng người

**TV1 (`namnkahn1607`)**
- 08/11: kế hoạch, spec, checklist cho pickup/deliver; API pickup và deliver cho Driver (kiểm tài xế được gán, đúng trạng thái, transaction, ghi lịch sử và thông báo); hàm parse request; cập nhật OpenAPI; nối luồng nhận hàng và giao hàng thật cho Driver; tài liệu `tv1-shipment-week7-handoff.md`.
- `statusHistory` trả trong chi tiết đơn.

**TV2 (`LeNa11-mia`)**
- 05/11: Worker ghi `location_history` và `current_locations` theo cột camelCase của đặc tả, có chống trùng (ON CONFLICT), không cho vị trí hiện tại lùi về mẫu cũ, ACK sau commit, bộ test phục hồi, phần ETA01.
- Thiếu file SQL tạo hai bảng GPS. TV6 viết bổ sung `packages/database/sql/002-create-gps-locations.sql` (12/11), kèm test Worker trên PostgreSQL thật (127/127 đạt).

**TV3 (`Dinh Tuan`)**
- 12/11: hoàn thiện lịch sử đơn của Customer và khu làm việc của Admin, tài liệu bàn giao frontend tuần 7 và kết quả kiểm tích hợp.

**Phần Driver của TV4 (commit tài khoản `AkaLissandra` của Trần Đại Quang, ghi nhận cho Quang)**
- 08/11: GPS từ trình duyệt và simulator có nhãn; danh sách đơn được gán, UI nhận hàng và giao hàng cho Driver.

**TV5**
- Nguyễn Minh Anh (`minhanhltnc`) sửa Dockerfile (11/11), đã merge vào `develop` (`730a84c`).
- Deploy: API đã lên bản mới trên Cloud Run. Web Hosting vẫn là bản 11/10. Worker, Pub/Sub và bảng GPS trên Cloud SQL chưa xác nhận.

**TV6 (`datdooo`)**
- 05/11–07/11: chuẩn hóa tài liệu, `GET /v1/notifications` (API10), sửa Admin đọc cột GPS camelCase, ghi log lỗi không phải HTTP.
- 09/11: sửa build sau khi nhập nhánh của TV2.
- 11/11: QA tuần 7 trên PostgreSQL thật: TC03.x (pickup/deliver), TC06.1 (lịch sử), TC10.1–10.3 (ma trận quyền) đều đạt. Toàn bộ API: 540 đạt, 0 lỗi.
- 12/11: SQL bảng GPS và test Worker (xem TV2).

## Đánh giá checkpoint

| Hạng mục | Local (PostgreSQL thật) | Cloud |
| --- | --- | --- |
| Tạo đơn → gán → nhận → giao | Đạt | Chưa chạy (web chưa deploy) |
| Lịch sử trạng thái, thông báo | Đạt | Chưa chạy |
| Phân quyền | Đạt | API trả 401 đúng khi không có token |
| GPS ghi vào SQL qua Worker | Đạt (Worker trên PostgreSQL thật) | Chưa xác nhận |

## Chốt tuần

- Chốt code bằng PR #26 (`week/07` → `main`, `bbdfe83`), mở ngày 13/11, chờ duyệt.
- Chốt trễ và chốt trước khi Cloud xong, để nhóm chuyển sang tuần 8. Mô tả PR ghi rõ phần Cloud còn thiếu.

## Chuyển sang tuần 8

- TV5 hoàn tất deploy: chạy `002` trên Cloud SQL, Worker có `DATABASE_URL`, subscription Pub/Sub, deploy web Hosting.
- Sau khi deploy: chạy lại cả luồng trên Cloud bằng tài khoản thật, kèm một `eventId` GPS đi từ API tới SQL.
