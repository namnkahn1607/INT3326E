# Đặc Tả Kỹ Thuật (Specification) — ParcelFlow Frontend

## 1. Phạm vi vai trò & Màn hình

### 1.1. Cổng Khách hàng (Customer) — `/customer` (Thành viên 3)
- `/customer`: Dashboard tổng quan, KPI đơn hàng, sơ đồ luồng giao nhận.
- `/customer/create`: Form tạo đơn (Điểm lấy, Điểm giao, Bưu kiện), tích hợp Geocoding.
- `/customer/shipments`: Danh sách đơn đang giao, lọc trạng thái, xem tracking.
- `/customer/history`: Lịch sử đơn đã kết thúc (DELIVERED / DELIVERY_FAILED).
- `/customer/notifications`: Danh sách thông báo trạng thái đơn.

### 1.2. Cổng Quản trị (Admin & Dispatcher) — `/admin` (Thành viên 3)
- `/admin`: Giám sát vận hành logistics và chỉ số NFR hệ thống.
- `/admin/shipments`: Quản lý toàn bộ đơn hàng trong hệ thống, tìm kiếm, lọc.
- `/admin/assignment`: Màn hình điều phối gán tài xế cho đơn `CREATED`.
- `/admin/drivers`: Quản lý danh sách đội xe và trạng thái gửi GPS.
- `/admin/accounts`: Quản lý tài khoản và phân quyền người dùng.

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
- **PICKED_UP**: Tài xế đã lấy hàng, bắt đầu gửi GPS định kỳ 8s.
- **DELIVERED**: Giao hàng thành công.
- **DELIVERY_FAILED**: Giao thất bại.

---

## 3. Nhiệm vụ Geocoding phía Client (Issue #3)
- **Forward Geocoding**: Địa chỉ văn bản ➔ Tọa độ `(lat, lng)`.
- **Reverse Geocoding**: Tọa độ `(lat, lng)` ➔ Địa chỉ văn bản.
- **Tính nhất quán**: Địa chỉ và tọa độ phải đồng bộ trước khi gửi lên API NestJS.
- **Quản lý hạn mức**: Debounce tìm kiếm, không tự chọn dịch vụ trả phí hoặc đưa secret key vào frontend.

---

## 4. Ngoài phạm vi MVP (Out of Scope)
COD, hoàn hàng/giao lại nhiều lần, đa kho, ML cho ETA (chỉ dùng Haversine), gợi ý tuyến đường, PostGIS.
