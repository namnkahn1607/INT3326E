# Week 6 (26/10–01/11)

Mục lục: [Điều phối theo tuần](README.md)

**Checkpoint:** Dispatcher (Admin) gán được tài xế; message GPS test thấy được trong Pub/Sub console.

**Trạng thái sheet:** TRUE cho cả 6 dòng.

## Giao việc theo sheet

| TV | Người | Việc |
| --- | --- | --- |
| TV1 | Nguyễn Lê Nam Khánh (nhóm trưởng) | API gán tài xế, khóa transaction chống gán trùng |
| TV2 | Nguyễn Thị Lê Na | `POST /v1/locations` (chỉ publish, chưa ghi DB) |
| TV3 | Lê Đình Anh Tuấn | UI Dispatcher (xem đơn chưa gán, gán tài xế), khung UI Admin |
| TV4 | Trần Đại Quang | UI Driver đăng nhập/dashboard; gửi thử GPS (chỉ log) |
| TV5 | Nguyễn Minh Anh | Kiểm message GPS thấy trong Pub/Sub console; chỉnh IAM cho service account của Worker |
| TV6 | Đỗ Đức Đạt | Backend Admin (danh sách driver/customer), phác thảo QA test plan |

## Thực tế từng người

**TV1**
- Không có commit trong tuần. API gán tài xế do TV6 làm thay (xem dưới).

**TV2 (`LeNa11-mia`)**
- 23/10: kiểm tra sự kiện theo EVT01, log phân biệt, khung repository GPS cho Worker.
- 25/10: cập nhật schema Prisma.
- 30/10: pipeline GPS trong Worker có transaction, snapshot tracking, bộ test tích hợp.
- 02/11: `POST /v1/locations` publish lên Pub/Sub.
- Nhánh của TV2 được tích hợp vào `develop` ở commit `ea0b74d` (02/11).

**TV3 (`Dinh Tuan`)**
- 26/10: log chẩn đoán an toàn khi tạo đơn lỗi.
- 30/10: lịch sử vòng đời đơn và báo giao thất bại cho Admin; polling tracking, bản đồ tài xế có phân trang; thiết kế lại UI Customer và Admin (dark dashboard), nút chuyển sáng tối.
- 02/11: hỗ trợ enum trạng thái khác nhau khi đọc đơn; kiểm luồng web tuần 6 trên Nest và SQL.

**TV4 (`AkaLissandra`, Trần Đại Quang)**
- 24/10: dashboard Driver, gửi GPS qua API.
- 01/11: bắt buộc timeout request khi làm mới token.
- 02/11: kiểm thử trên trình duyệt với bản `develop` đã tích hợp, kèm bằng chứng và tài liệu bàn giao GPS.

**TV5**
- Kiểm Pub/Sub console và IAM làm trên Cloud, không có commit trong repo.

**TV6 (`datdooo`)**
- 26/10: sửa lockfile PGlite.
- 01/11: API đọc đơn và gán tài xế có transaction (làm thay TV1), Việt hóa chú thích và thông báo lỗi của API.

## Chốt tuần

- PR #25: `week/06` → `main`, merge commit `60a8bfa`. Ranh giới tuần là `ea0b74d` (merge nhánh GPS của TV2).

## Ghi chú

- API gán tài xế của TV1 do TV6 làm. Sheet giữ nguyên phân công gốc.
- Worker lúc này vẫn ghi cột GPS dạng snake_case. Việc thống nhất sang camelCase theo đặc tả DATA04/05 chuyển sang tuần 7.
