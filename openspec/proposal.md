# Đề Xuất (Proposal): Khởi Tạo & Chuẩn Hóa Frontend ParcelFlow (Tuần 1)

## 1. Bối cảnh dự án
- **Dự án**: ParcelFlow — Nền tảng giao nhận và logistics xây dựng theo định hướng Cloud-First.
- **Môn học**: Phát triển ứng dụng Cloud (INT3326E) — Đại học Công nghệ (UET), ĐHQGHN.
- **Quy mô & Thời gian**: Nhóm 6 thành viên, triển khai trong 10 tuần.
- **Trọng tâm kỹ thuật**: Hiệu năng cao (Performance) & Khả năng mở rộng (Scalability), đặc biệt là luồng xử lý dữ liệu GPS tần suất cao của tài xế.

## 2. Phân công trách nhiệm Frontend
Hai thành viên dùng chung một repository frontend (`frontend/`):
- **Tuấn (Thành viên 3 - Tác giả tài liệu này)**: Chịu trách nhiệm toàn bộ Frontend cho vai trò **Customer (Khách hàng)** và **Admin & Dispatcher (Quản trị & Điều phối)**, kèm theo trách nhiệm kỹ thuật về **Geocoding phía client (Issue #3)**.
- **Thành viên 4**: Chịu trách nhiệm Frontend cho vai trò **Driver (Tài xế)**.

> **Nguyên tắc cốt lõi**: Phân lập triệt để không gian mã nguồn giữa hai thành viên. Tuấn chỉ phát triển Customer và Admin, giữ khung Driver ở mức tối thiểu để Thành viên 4 tự do phát triển, ngăn chặn tối đa nguy cơ xung đột Git (Merge Conflict).

## 3. Vấn đề đặt ra tại Tuần 1
1. **Thiếu cấu trúc chuẩn**: Code khởi tạo ban đầu dồn toàn bộ layout, menu và các trang vào một file duy nhất (`App.tsx`), gây khó khăn cho việc bảo trì và chia việc.
2. **Nguy cơ lỗi Git**: Thư mục gốc chưa có file `.gitignore`, nguy cơ đẩy `node_modules` và thư mục `dist/` lên kho lưu trữ chung.
3. **Thách thức điều hướng SPA trên Cloud Hosting**: Ứng dụng điều hướng phía client (React Router) sẽ gặp lỗi **404 Not Found** khi người dùng truy cập trực tiếp URL hoặc nhấn F5 trên Firebase Hosting nếu thiếu cấu hình URL rewrite.

## 4. Giải pháp đề xuất & Phạm vi triển khai
1. **Khởi tạo và module hóa kiến trúc Frontend**:
   - Sử dụng **React 19 + Vite 8 + TypeScript + React Router**.
   - Tách biệt rõ ràng các thư mục: `layouts/`, `pages/customer/`, `pages/admin/`, `pages/driver/`, `components/common/`, `types/`.
2. **Chuẩn hóa luồng trạng thái đơn hàng (Single Flow)**:
   - Thống nhất 5 trạng thái theo kiến trúc hệ thống:
     `CREATED → ASSIGNED → PICKED_UP → DELIVERED / DELIVERY_FAILED`.
3. **Dựng hoàn chỉnh giao diện tạm cho Customer & Admin**:
   - Customer: Header ngang, dashboard tổng quan, form tạo đơn chuẩn bị cho Geocoding (Issue #3), danh sách đơn hàng, lịch sử và thông báo.
   - Admin: Sidebar tối màu, quản lý đơn hàng, khung tương tác phân công tài xế (chuẩn bị cho Tuần 3), quản lý đội xe và tài khoản.
   - Driver: Giữ 1 route và placeholder cơ bản để Thành viên 4 tiếp nhận.
4. **Sẵn sàng triển khai Firebase Hosting**:
   - Cấu hình file `firebase.json` với cơ chế SPA rewrites về `/index.html`.
   - Cập nhật Project ID `int3326e` vào `.firebaserc`.
