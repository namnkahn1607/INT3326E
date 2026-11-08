# Danh Sách Tác Vụ (Tasks) — Lộ Trình Frontend (Customer & Admin)

## 1. Trạng thái hiện tại

### ✅ Tuần 1: Khởi tạo và Dựng khung giao diện (HOÀN THÀNH)
- [x] Tạo `.gitignore` ở root, bảo vệ repo khỏi `node_modules` và `dist/`.
- [x] Khởi tạo React + Vite + TypeScript + React Router.
- [x] Tách cấu trúc thư mục module hóa độc lập theo vai trò.
- [x] Định nghĩa chuẩn 5 trạng thái đơn hàng (`ShipmentStatus`).
- [x] Hoàn thiện 5 trang Customer và 5 trang Admin với dữ liệu mẫu.
- [x] Dựng khung Driver tối thiểu để Thành viên 4 tiếp quản.
- [x] Cấu hình Firebase Hosting SPA rewrites (`firebase.json`, `.firebaserc`).
- [x] Kiểm thử: `npm run lint` và `npm run build` pass 100%.

---

## 2. Lộ trình các tuần tiếp theo

### 🎯 Tuần 2: Xác thực & Kết nối API Tạo đơn (VIỆC TIẾP THEO)
- [ ] Tích hợp Firebase Auth cho Customer (Đăng nhập / Đăng ký).
- [ ] Truyền Bearer Token tới Backend NestJS.
- [ ] Nối Form tạo đơn (`CustomerCreatePage.tsx`) với API `POST /shipments`.
- [ ] Nối Danh sách đơn (`CustomerShipmentsPage.tsx`) với API `GET /shipments`.
- [ ] Khảo sát giải pháp Geocoding cho Issue #3.

### 📅 Tuần 3: Phân công tài xế (Admin)
- [ ] Nối màn hình phân công (`AdminAssignmentPage.tsx`) với API `GET /shipments/unassigned` và `POST /shipments/:id/assign`.

### 📅 Tuần 4: Cập nhật trạng thái theo quyền & Lịch sử
- [ ] Thống nhất quyền cập nhật trạng thái với Backend và Driver.
- [ ] Hoàn thiện trang Lịch sử giao hàng (`CustomerHistoryPage.tsx`).

### 📅 Tuần 5: Bản đồ Leaflet & Tracking thời gian thực (MỐC BẮT BUỘC)
- [ ] Tích hợp Leaflet + OpenStreetMap.
- [ ] REST Polling vị trí tài xế mỗi 5–10 giây từ Backend.

### 📅 Tuần 6–10: Hoàn thiện hệ thống
- [ ] Tuần 6: Xử lý đơn thất bại/trễ, polling thông báo.
- [ ] Tuần 7: Tích hợp ETA (công thức Haversine).
- [ ] Tuần 8: Hoàn thiện UI/UX, sửa lỗi.
- [ ] Tuần 9: Tinh chỉnh Frontend khi chạy load test.
- [ ] Tuần 10: Hoàn tất báo cáo, ADR Frontend và chuẩn bị demo.

---

## 3. Quy tắc cho AI Coding Assistant tiếp theo
1. **Phân định phạm vi**: Chỉ can thiệp vào `pages/customer/`, `pages/admin/`, `layouts/CustomerLayout.tsx`, `layouts/AdminLayout.tsx`. Tuyệt đối không can thiệp sâu vào `driver/` (của Thành viên 4).
2. **Luồng trạng thái**: Luôn tuân theo 5 trạng thái `CREATED → ASSIGNED → PICKED_UP → DELIVERED / DELIVERY_FAILED`.
3. **Thư mục lệnh**: Chạy các lệnh npm trong thư mục `frontend/`.
4. **Issue #3 (Geocoding)**: Không tự ý chọn dịch vụ trả phí hoặc đưa API key vào frontend.
