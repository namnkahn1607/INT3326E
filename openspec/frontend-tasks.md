# Danh Sách Tác Vụ (Tasks) — Lộ Trình Frontend (Customer & Admin)

## 1. Trạng thái hiện tại

Nguồn hiện hành: [PF SPEC 01 nội dung v1.3](../docs/spec-baseline.md), Phần VII.
Checkbox trong mục tuần 1 dưới đây giữ ghi nhận lịch sử, không tự chứng minh lần kiểm tra mới.
Tasks Spec Kit của lượt tái nghiệm thu nằm ở [week1-reacceptance/tasks.md](week1-reacceptance/tasks.md);
kết quả thực tế nằm ở [acceptance.md](week1-reacceptance/acceptance.md).

### Tuần 1: Khởi tạo và Dựng khung giao diện (ghi nhận lịch sử)
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
- [ ] Tích hợp Firebase Auth cho Customer bằng tài khoản đã provision, custom claim tin cậy; không tự cấp role hoặc thêm quản lý tài khoản.
- [ ] Truyền Bearer Token tới Backend NestJS.
- [ ] Nối form (`CustomerCreatePage.tsx`) với `POST /v1/shipments`, giữ Idempotency-Key cho cùng ý định/retry; có loading/error, validation và trackingNumber.
- [ ] Nối danh sách/đơn vừa tạo (`CustomerShipmentsPage.tsx`) với `GET /v1/shipments` và `GET /v1/shipments/{id}`, theo SC01–03.
- [ ] Đồng bộ JSON/UI/storage mapping với TV1 và user linkage/errors/CORS với TV6/TV5 trước tích hợp.
- [ ] Nhập địa chỉ và chọn/nhập tọa độ hợp lệ theo UI01/API01; không tự thêm geocoding provider từ Issue #3 cũ.

### 📅 Tuần 3: Phân công tài xế (Admin)

Triển khai TV3 tiếp tại [Admin assignment tasks](../specs/001-admin-assignment/tasks.md),
gồm kiểm tra phần TV1/TV6, API client, list/detail/driver, xác nhận và recovery.
Kết quả local/mock và phần nghiệm thu tích hợp còn mở ở
[acceptance](../specs/001-admin-assignment/acceptance.md); không đánh dấu tuần 3 hoàn tất chỉ từ mock.

- [ ] Nối `AdminAssignmentPage.tsx` với `GET /v1/shipments?status=CREATED`, `GET /v1/drivers` và `POST /v1/shipments/{id}/assign`; xử lý 409, timeout thì đọc lại Detail, không tự retry Assign.

### 📅 Tuần 4: Cập nhật trạng thái theo quyền & Lịch sử
- [ ] Thống nhất quyền cập nhật trạng thái với Backend và Driver.
- [ ] Hoàn thiện trang Lịch sử giao hàng (`CustomerHistoryPage.tsx`).

### 📅 Tuần 5: Bản đồ Leaflet & Tracking thời gian thực (MỐC BẮT BUỘC)
- [ ] Nối dữ liệu thật vào bản đồ Leaflet + OpenStreetMap đã có; không tạo app/map stack mới.
- [ ] REST Polling vị trí tài xế mỗi 5–10 giây từ Backend.

### 📅 Tuần 6–10: Hoàn thiện hệ thống
- [ ] Tuần 6: Xử lý đơn thất bại/trễ, polling thông báo.
- [ ] Tuần 7: Tích hợp ETA (công thức Haversine).
- [ ] Tuần 8: Hoàn thiện UI/UX, sửa lỗi.
- [ ] Tuần 9: Tinh chỉnh Frontend khi chạy load test.
- [ ] Tuần 10: Hoàn tất báo cáo, ADR Frontend và chuẩn bị demo.

---

## 3. Quy tắc cho AI Coding Assistant tiếp theo
1. **Phân định phạm vi**: TV3 phụ trách `apps/web/src/features/customer/`, `features/admin/`, `layouts/CustomerLayout.tsx`, `layouts/AdminLayout.tsx`; phối hợp cấu trúc chung với TV4, không tự sửa sâu Driver.
2. **Luồng trạng thái**: Luôn tuân theo 5 trạng thái `CREATED → ASSIGNED → PICKED_UP → DELIVERED / DELIVERY_FAILED`.
3. **Thư mục lệnh**: Trong `apps/web` dùng script package; hoặc root dùng `dev:web`, `lint:web`, `build:web` đã khai báo.
4. **Đặc tả mới**: UI01/API01 có ưu tiên hơn lời hứa geocoding cũ; không thêm provider hoặc secret key. Accounts/Admin dashboard vẫn theo giới hạn UI03, không mở CRUD/KPI mới.
