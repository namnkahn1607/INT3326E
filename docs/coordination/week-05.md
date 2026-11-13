# Week 5 (19/10–25/10)

Mục lục: [Điều phối theo tuần](README.md)

**Checkpoint:** Customer đăng nhập, tạo và xem đơn thật lưu trên Cloud SQL.

**Trạng thái sheet:** TRUE cho cả 6 dòng.

## Giao việc theo sheet

| TV | Người | Việc |
| --- | --- | --- |
| TV1 | Nguyễn Thị Lê Nam Khánh | Thiết kế schema Shipment, API tạo đơn thật |
| TV2 | Nguyễn Thị Lê Na | Thiết kế schema `current_locations` / `location_history`, thống nhất convention với TV1 |
| TV3 | Lê Đình Anh Tuấn | Đăng nhập Customer (Firebase Auth), form tạo đơn nối API thật, xem danh sách đơn của mình |
| TV4 | Nguyễn Minh Anh | Tiếp tục test pipeline Pub/Sub; chốt event schema GPS cùng TV2 |
| TV5 | Trần Đại Quang | Kết nối Cloud SQL từ Cloud Run, cấu hình secrets |
| TV6 | Đỗ Đức Đạt | Firebase Auth đầy đủ (custom claims 3 role), auth guard |

## Thực tế từng người

**TV1**
- Không có commit riêng trong tuần. API tạo đơn có transaction (`feat(api): implement transactional shipment creation`, 25/10) do TV3 làm.

**TV2 (`LeNa11-mia`)**
- 10/10: Dockerfile và cấu hình build độc lập cho Worker trên Cloud Run, sửa GCP project ID, bỏ `.env` khỏi Git.
- 18/10: cập nhật hợp đồng sự kiện GPS EVT01.
- Schema GPS bằng Prisma được cập nhật ở tuần sau (25/10).

**TV3 (`Dinh Tuan`)**
- 18/10: sửa UI đăng nhập, chức năng tạo đơn của Customer.
- 19/10: tìm địa chỉ bằng Photon, chọn vùng trên bản đồ.
- 24/10: client cho danh bạ tài xế và API gán tài xế, có contract test; UI gán tài xế cho Admin.
- 25/10: API tạo đơn có transaction, proxy geocoding VIETMAP có xác thực, rút gọn form tạo đơn, chặn response geocoding sai định dạng, xử lý hủy request.

**Phần Driver của TV4 (commit tài khoản `AkaLissandra` của Trần Đại Quang, ghi nhận cho Quang)**
- 16/10: chuẩn hóa hợp đồng telemetry GPS, kiểm việc gửi qua Pub/Sub.
- 21/10: chỉnh GPS emitter theo hợp đồng telemetry mới.

**TV5**
- Kết nối Cloud SQL và secrets làm trên Cloud, không có commit trong repo.

**TV6 (`datdooo`)**
- 10/10: khóa dependency của Worker để build Cloud Run lặp lại được, tài liệu deploy Worker từ source.
- 17/10: hoàn thiện đăng nhập Firebase và RBAC 3 role, bắt buộc liên kết tài khoản Firebase với `users`, xử lý lỗi dependency.
- 18/10: tài liệu cấu hình frontend để bàn giao cho TV3.
- 24/10: API danh sách tài xế và khách hàng (chỉ đọc) cho Admin, bản nháp QA test plan.

## Chốt tuần

- PR #24: `week/05` → `main`, merge commit `510f85d`.
- Lúc chốt, `npm ci` ở ranh giới tuần bị lỗi vì lockfile thiếu `@electric-sql/pglite`. Đã đưa commit sửa lockfile vào `week/05` (`d00ece5`) trước khi merge.

## Ghi chú

- Việc TV1 trong sheet (schema và API tạo đơn) thực tế do TV3 làm phần API. Sheet vẫn giữ nguyên phân công gốc.
