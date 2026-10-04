# Danh Sách Tác Vụ (Tasks) — Lộ Trình 10 Tuần của Tuấn

## 1. Trạng thái công việc hiện tại

### ✅ Tuần 1: Khởi tạo và Dựng khung giao diện chuẩn (ĐÃ HOÀN THÀNH)
- [x] Khảo sát hiện trạng repo, cấu hình `.gitignore` ở thư mục gốc để bảo vệ mã nguồn.
- [x] Khởi tạo React 19 + TypeScript + Vite 8 + React Router trong `frontend/`.
- [x] Tách cấu trúc thư mục module hóa sạch sẽ: `layouts/`, `pages/customer/`, `pages/admin/`, `pages/driver/`, `components/common/`, `types/`.
- [x] Chuẩn hóa kiểu dữ liệu `ShipmentStatus` với 5 trạng thái: `CREATED`, `ASSIGNED`, `PICKED_UP`, `DELIVERED`, `DELIVERY_FAILED`.
- [x] Xây dựng trọn vẹn 5 màn hình Khách hàng (Customer) với đầy đủ bố cục, dữ liệu mẫu trực quan và lưu ý Geocoding (Issue #3).
- [x] Xây dựng trọn vẹn 5 màn hình Quản trị & Điều phối (Admin/Dispatcher) với màn hình phân công tài xế 2 cột (sẵn sàng cho Tuần 3).
- [x] Thu gọn Cổng Tài xế (Driver) thành khung route placeholder tối thiểu duy nhất để Thành viên 4 tự phát triển.
- [x] Thiết lập cấu hình Firebase Hosting (`firebase.json`, `.firebaserc` với project `int3326e`).
- [x] Chạy kiểm thử chất lượng: `npm run lint` pass sạch, `npm run build` thành công.
- [x] Chạy thử nghiệm thành công trên máy cục bộ (`npm run dev` tại `http://localhost:5173/`).

---

## 2. Kế hoạch các tuần tiếp theo (Dành cho Tuấn)

### 🎯 Tuần 2: Xác thực Khách hàng & Kết nối API Tạo đơn (NHIỆM VỤ TIẾP THEO)
- [ ] Tích hợp **Firebase Authentication** cho phía Customer:
  - Màn hình đăng nhập/đăng ký bằng Email & Mật khẩu (hoặc Google Sign-In).
  - Lấy JWT ID Token gửi kèm Header `Authorization: Bearer <token>` sang Backend NestJS.
- [ ] Kết nối Form Tạo đơn (`CustomerCreatePage.tsx`) với API thật của Backend:
  - Gọi `POST /shipments` lưu dữ liệu vào PostgreSQL Cloud SQL.
- [ ] Kết nối Danh sách đơn của Khách hàng (`CustomerShipmentsPage.tsx`):
  - Gọi `GET /shipments` để lấy danh sách đơn của tài khoản đang đăng nhập.
- [ ] Bắt đầu nghiên cứu giải pháp Geocoding cho Issue #3 (Forward Geocoding: Địa chỉ ➔ Tọa độ `lat, lng`).

### 📅 Tuần 3: Giao diện Phân công tài xế (Admin) & Khung điều phối
- [ ] Màn hình Phân công tài xế (`AdminAssignmentPage.tsx`):
  - Gọi API `GET /shipments/unassigned` lấy danh sách đơn `CREATED`.
  - Gọi API lấy danh sách tài xế đang online.
  - Gọi API `POST /shipments/:id/assign` để phân công tài xế và chuyển trạng thái sang `ASSIGNED`.

### 📅 Tuần 4: Cập nhật trạng thái theo quyền & Lịch sử giao hàng
- [ ] Phối hợp với Backend và Thành viên 4 chốt ma trận quyền cập nhật từng trạng thái đơn hàng.
- [ ] Hoàn thiện trang Lịch sử giao hàng (`CustomerHistoryPage.tsx`) với phân trang và lọc theo ngày.

### 📅 Tuần 5: Tích hợp Bản đồ Leaflet & Polling vị trí thời gian thực (MỐC BẮT BUỘC)
- [ ] Cài đặt thư viện Leaflet (`leaflet`, `react-leaflet`, `@types/leaflet`).
- [ ] Hiển thị bản đồ OpenStreetMap với marker của điểm lấy, điểm giao và vị trí tài xế.
- [ ] Thiết lập cơ chế REST Polling (5–10 giây/lần) gọi API Backend để cập nhật tọa độ tài xế thời gian thực từ bảng `current_location`.

### 📅 Tuần 6: Xử lý Đơn thất bại/trễ & Polling Thông báo
- [ ] Hiển thị danh sách đơn giao thất bại (`DELIVERY_FAILED`) trên Dashboard Admin và hướng xử lý ngoại lệ.
- [ ] Kết nối Polling thông báo đơn hàng cho Customer (`CustomerNotificationsPage.tsx`).

### 📅 Tuần 7: Hiển thị thời gian dự kiến (ETA)
- [ ] Tích hợp hiển thị ETA tính theo công thức hình học Haversine từ tọa độ tài xế tới điểm giao hàng.

### 📅 Tuần 8: Hoàn thiện UI/UX và Rà soát lỗi
- [ ] Đồng bộ hóa thiết kế, tối ưu giao diện trên thiết bị di động cho Customer.
- [ ] Sửa lỗi UI và kiểm thử luồng tương tác người dùng.

### 📅 Tuần 9: Tinh chỉnh Frontend khi chạy Load Test
- [ ] Hỗ trợ nhóm theo dõi phản hồi giao diện khi tải hệ thống đạt mức 60–300 sự kiện GPS/giây.
- [ ] Tối ưu hóa hiệu năng render bản đồ và tần suất polling.

### 📅 Tuần 10: Hoàn tất Báo cáo, ADR Frontend & Chuẩn bị Demo
- [ ] Viết tài liệu quyết định kiến trúc (ADR) cho Frontend.
- [ ] Chuẩn bị kịch bản demo bảo vệ dự án trước hội đồng UET.

---

## 3. Hướng dẫn dành cho AI Coding Assistant tiếp theo

Nếu bạn là một AI Agent tiếp tục phiên làm việc với Tuấn:
1. **Tuyệt đối không làm thay phần Driver**: Driver thuộc quyền quản lý của Thành viên 4. Chỉ duy trì khung route `/driver` tối thiểu.
2. **Tuân thủ đúng luồng trạng thái 5 bước**: `CREATED → ASSIGNED → PICKED_UP → DELIVERED / DELIVERY_FAILED`.
3. **Thực thi lệnh đúng thư mục**: Mọi lệnh npm (`npm install`, `npm run dev`, `npm run build`, `npm run lint`) phải chạy bên trong thư mục `D:\Cloud\INT3326E\frontend`.
4. **Issue #3 (Geocoding)**: Khi Tuấn yêu cầu làm Geocoding, không được tự ý chọn dịch vụ trả phí hoặc đưa API key bí mật vào frontend. Cần hỏi ý kiến Tuấn về nhà cung cấp geocoding được nhóm thống nhất.
5. **Giữ nguyên cấu trúc module**: Không dồn lại code vào `App.tsx`. Viết thêm component/page vào đúng thư mục `pages/customer/` hoặc `pages/admin/`.
