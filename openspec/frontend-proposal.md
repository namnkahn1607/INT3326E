# Đề Xuất (Proposal) — ParcelFlow Frontend

## 1. Bối cảnh
- **Dự án**: ParcelFlow (Nền tảng giao nhận và logistics Cloud-First).
- **Môn học**: Phát triển ứng dụng Cloud (INT3326E) — UET.
- **Quy mô**: 6 thành viên, 10 tuần. Trọng tâm: Performance & Scalability (xử lý dữ liệu GPS cao tải).

## 2. Phân công Frontend
Dùng chung thư mục `frontend/`, chia theo vai trò:
- **Thành viên 3**: Frontend Customer & Admin, phụ trách Issue #3 (Geocoding client).
- **Thành viên 4**: Frontend Driver.
- **Nguyên tắc**: Tách độc lập thư mục theo vai trò để tránh xung đột Git.

## 3. Mục tiêu Tuần 1
- Khởi tạo dự án React + Vite + TypeScript.
- Dựng khung routing và layout riêng biệt cho 3 vai trò.
- Thống nhất luồng 5 trạng thái đơn hàng dùng chung.
- Cấu hình Firebase Hosting SPA rewrites.
