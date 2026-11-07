# Đặc Tả Kỹ Thuật (Specification) — ParcelFlow Frontend

## 1. Phạm vi vai trò & Màn hình

Nguồn yêu cầu hiện hành: [PF SPEC 01 nội dung v1.3](../docs/spec-baseline.md), đặc biệt
VI.UI01–03 và VII.2–3. Các màn hình hiện có là scaffold/mock; danh mục không chứng minh
nghiệp vụ đã chạy. Tuần 1 chỉ yêu cầu một app, ba cổng stub và Hosting; xem
[nghiệm thu](week1-reacceptance/acceptance.md). Không tạo frontend mới.

### 1.1. Cổng Khách hàng (Customer) — `/customer` (Thành viên 3)
- `/customer`: Tổng quan trong tập dữ liệu đã tải; các chỉ số tuần 1 là mẫu, không KPI toàn hệ thống.
- `/customer/create`: Form tạo đơn (điểm lấy/giao, người nhận, bưu kiện); nhập địa chỉ và chọn/nhập tọa độ theo UI01/API01 khi tích hợp từ tuần 2.
- `/customer/shipments`: Danh sách đơn đang giao, lọc trạng thái, xem tracking.
- `/customer/history`: Lịch sử đơn đã kết thúc (DELIVERED / DELIVERY_FAILED).
- `/customer/notifications`: Danh sách thông báo trạng thái đơn.

### 1.2. Cổng Quản trị và Điều phối (Admin) — `/admin` (Thành viên 3)
- `/admin`: Tổng quan trên dữ liệu đã tải, có nhãn phạm vi; Cloud Monitoring giữ số liệu NFR/hạ tầng.
- `/admin/shipments`: Quản lý toàn bộ đơn hàng trong hệ thống, tìm kiếm, lọc.
- `/admin/assignment`: Màn hình điều phối gán tài xế cho đơn `CREATED`.
- `/admin/drivers`: Tra cứu tài xế phục vụ phân công theo API11 khi tích hợp; không entity online-status mới.
- `/admin/live-map`: Bản đồ các tài xế trong trang đã tải; tuần 1 là dữ liệu mô phỏng, không live tracking thật.
- `/admin/accounts`: Giữ scaffold; không CRUD tài khoản hoặc cấp quyền/custom claim trong MVP.

### 1.3. Cổng Tài xế (Driver) — `/driver` (Thành viên 4)
- Khung route và layout tối thiểu để Thành viên 4 tự phát triển.

---

## 2. Luồng trạng thái đơn hàng (Single Flow)
```text
CREATED ──► ASSIGNED ──► PICKED_UP ──► DELIVERED
                                   └──► DELIVERY_FAILED
```
- **CREATED**: Khách tạo đơn, chờ điều phối.
- **ASSIGNED**: Đã gán tài xế.
- **PICKED_UP**: Tài xế đã lấy hàng; ETA chỉ tính khi đủ điều kiện GPS theo FR09.
- **DELIVERED**: Giao hàng thành công.
- **DELIVERY_FAILED**: Giao thất bại.

---

## 3. Địa chỉ, tọa độ và ranh giới tuần 2

Issue #3 trước đây đề cập geocoding client. Nguồn mới UI01 quy định Customer nhập địa chỉ
và chọn/nhập tọa độ hợp lệ; không tự thêm provider mới hoặc coi geocoding tự động là gate tuần 1.
Địa chỉ và tọa độ gửi cùng payload theo API01; tên JSON chuẩn là `pickup*`, `dropoff*`.
Nếu dùng tên UI/storage `delivery*` phải có mapper rõ. Không đưa secret key vào frontend.

Tuần 2 theo VII.3: Firebase login bằng tài khoản đã provision, Bearer token, API client,
form Create với Idempotency-Key giữ nguyên khi retry cùng ý định, loading/error và mã tracking;
xem lại đơn theo API02/03. Chưa triển khai các phần này trong audit tuần 1.

---

## 4. Ngoài phạm vi MVP (Out of Scope)
COD, hoàn hàng/giao lại nhiều lần, đa kho, ML cho ETA (chỉ dùng Haversine), gợi ý tuyến đường, PostGIS.
Không cancellation, CRUD/cấp role tài khoản, notification provider bên ngoài, KPI toàn cục mới
hoặc frontend truy cập trực tiếp Pub/Sub/Cloud SQL. Bản đồ và GPS mẫu không là bằng chứng tracking thật.
