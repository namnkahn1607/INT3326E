# Đặc Tả Kỹ Thuật (Specification) — Frontend ParcelFlow

## 1. Vai trò người dùng trong phạm vi của Tuấn

### 1.1. Cổng Khách hàng (Customer Portal)
- **Đường dẫn gốc**: `/customer`
- **Mục đích**: Cho phép khách hàng gửi yêu cầu vận chuyển, theo dõi tiến độ đơn hàng và nhận thông báo trạng thái.
- **Các màn hình & đặc tả**:
  1. `/customer`: Dashboard tổng quan, thẻ thống kê số đơn, mô hình trực quan luồng giao nhận ParcelFlow, danh sách đơn gần nhất.
  2. `/customer/create`: Form tạo đơn vận chuyển mới gồm 3 khối thông tin: Điểm lấy hàng, Điểm giao hàng và Mô tả bưu phẩm. Form tích hợp Geocoding (chuyển đổi địa chỉ sang tọa độ ở Tuần 2).
  3. `/customer/shipments`: Danh sách đơn đang hoạt động của khách hàng, bộ lọc trạng thái (Tất cả, CREATED, ASSIGNED, PICKED_UP), thẻ thông tin đơn hàng và nút mở bản đồ theo dõi (tích hợp Leaflet Map ở Tuần 5).
  4. `/customer/history`: Danh sách các đơn đã kết thúc (DELIVERED hoặc DELIVERY_FAILED).
  5. `/customer/notifications`: Danh sách thông báo biến động trạng thái đơn hàng (sẽ kết nối Polling ở Tuần 6).

### 1.2. Cổng Quản trị & Điều phối (Admin & Dispatcher Portal)
- **Đường dẫn gốc**: `/admin`
- **Mục đích**: Giám sát toàn bộ hoạt động logistics của hệ thống, phân công đơn hàng cho tài xế và quản lý người dùng.
- **Các màn hình & đặc tả**:
  1. `/admin`: Tổng quan hệ thống, giám sát chỉ số đơn hàng theo thời gian thực và theo dõi các chỉ số SLA/NFR của hạ tầng Cloud Run & Pub/Sub.
  2. `/admin/shipments`: Quản lý danh sách toàn bộ đơn hàng trong hệ thống, tìm kiếm theo mã đơn/tên khách và lọc theo trạng thái.
  3. `/admin/assignment`: Màn hình điều phối tài xế (Trọng tâm Tuần 3):
     - Danh sách đơn hàng trạng thái `CREATED` chờ gán xe.
     - Danh sách tài xế đang trực tuyến (Online) và số đơn hiện đang vận chuyển.
     - Tương tác chọn đơn + chọn tài xế và gọi API phân công.
  4. `/admin/drivers`: Quản lý danh sách đội xe, thông tin liên lạc và tần suất gửi GPS (8 giây/lần).
  5. `/admin/accounts`: Quản lý tài khoản và phân quyền người dùng trong hệ sinh thái.

### 1.3. Cổng Tài xế (Driver Portal) — Phạm vi của Thành viên 4
- **Đường dẫn gốc**: `/driver`
- **Đặc tả**: Khung tối thiểu duy nhất gồm header nhận diện và 1 trang placeholder để Thành viên 4 tiếp quản, tuyệt đối không can thiệp sâu vào giao diện và logic chi tiết của tài xế.

---

## 2. Vòng đời đơn hàng (Shipment State Flow)
Hệ thống sử dụng một luồng trạng thái duy nhất, tuần tự và chặt chẽ:
```text
CREATED ──► ASSIGNED ──► PICKED_UP ──► DELIVERED
                                   └──► DELIVERY_FAILED
```

- **CREATED**: Khách hàng tạo đơn thành công, chờ điều phối viên gán tài xế.
- **ASSIGNED**: Admin/Dispatcher đã phân công tài xế phụ trách.
- **PICKED_UP**: Tài xế đã lấy hàng thành công và đang di chuyển trên đường (bắt đầu chu kỳ gửi GPS 8s/lần qua Pub/Sub).
- **DELIVERED**: Giao hàng thành công tới tay người nhận.
- **DELIVERY_FAILED**: Giao hàng thất bại (không liên lạc được, sai địa chỉ, hủy giao).

---

## 3. Đặc tả nhiệm vụ Issue #3 — Frontend Geocoding Responsibility
Được giao trực tiếp cho tài khoản GitHub `dinhtuanz`:
- **Trách nhiệm của Frontend**:
  1. Chọn vị trí lấy hàng và giao hàng (thông qua địa chỉ hoặc ghim điểm trên bản đồ).
  2. **Forward Geocoding**: Chuyển đổi chuỗi văn bản địa chỉ thành tọa độ `(lat, lng)`.
  3. **Reverse Geocoding**: Khi người dùng click/kéo ghim trên bản đồ, chuyển tọa độ `(lat, lng)` ngược lại thành chuỗi địa chỉ dễ đọc.
  4. **Data Integrity**: Đảm bảo chuỗi địa chỉ và tọa độ luôn đồng bộ, nhất quán trước khi gửi payload sang API NestJS (`POST /shipments`).
  5. **Quản lý hạn mức (Rate Limiting / Quota)**: Kiểm soát tần suất gọi dịch vụ geocoding (debounce tìm kiếm địa chỉ) để tránh vượt hạn mức miễn phí.
- **Ràng buộc an toàn**: Không tự ý chọn nhà cung cấp dịch vụ bên ngoài có trả phí hoặc để lộ secret API key trên mã nguồn frontend. Leaflet chỉ đảm nhiệm hiển thị bản đồ, không tự cung cấp dịch vụ geocoding.

---

## 4. Các yêu cầu ngoài phạm vi (Out of Scope - MVP)
Hệ thống ParcelFlow MVP không hỗ trợ:
- Thanh toán khi nhận hàng (COD).
- Hoàn hàng / Giao lại nhiều lần.
- Quản lý đa kho (Multi-warehouse).
- Machine Learning dự đoán ETA (chỉ dùng công thức tính khoảng cách hình học Haversine).
- Đề xuất tuyến đường tối ưu (Routing engine).
- PostGIS phía cơ sở dữ liệu.
