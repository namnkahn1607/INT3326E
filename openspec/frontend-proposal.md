# Đề Xuất (Proposal) — ParcelFlow Frontend

## 1. Bối cảnh

Nguồn hiện hành là [PF SPEC 01 nội dung v1.3](../docs/spec-baseline.md), thay đặc tả cũ.
Tài liệu này giữ bối cảnh frontend; nghiệm thu tuần 1 theo VII.2 và
[hồ sơ audit](week1-reacceptance/spec.md), không triển khai tuần 2 trong lần audit.
- **Dự án**: ParcelFlow (Nền tảng giao nhận và logistics Cloud-First).
- **Môn học**: Phát triển ứng dụng Cloud (INT3326E) — UET.
- **Quy mô**: 6 thành viên, 10 tuần. Trọng tâm: Performance & Scalability (xử lý dữ liệu GPS cao tải).

## 2. Phân công Frontend
Dùng chung app `apps/web`, chia theo `src/features/`:
- **Thành viên 3**: Frontend Customer & Admin; địa chỉ/tọa độ theo UI01. Issue #3 là bối cảnh cũ, không tự thêm geocoding provider.
- **Thành viên 4**: Frontend Driver.
- **Nguyên tắc**: Tách độc lập thư mục theo vai trò để tránh xung đột Git.

## 3. Mục tiêu Tuần 1
- Khởi tạo dự án React + Vite + TypeScript.
- Dựng khung routing và layout riêng biệt cho 3 vai trò.
- Thống nhất luồng 5 trạng thái đơn hàng dùng chung.
- Cấu hình Firebase Hosting SPA rewrites.
