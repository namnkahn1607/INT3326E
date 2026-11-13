# Week 7 (02/11–08/11)

Mục lục: [Điều phối theo tuần](README.md)

**Checkpoint:** Luồng tạo đơn đến giao hàng hoạt động hoàn chỉnh; vị trí tài xế ghi được qua Worker.

| TV | Việc theo sheet | Tình hình khi chốt |
| --- | --- | --- |
| TV1 | API pickup/deliver, lịch sử giao hàng | Xong trên `develop`, test trên PostgreSQL thật đạt |
| TV2 | Worker consume GPS, ghi `current_locations` | Xong. SQL tạo bảng GPS: `packages/database/sql/002-create-gps-locations.sql` |
| TV3 | UI cập nhật trạng thái cho Admin, lịch sử đơn cho Customer | Xong trên `develop` |
| TV4 | Driver app gửi GPS thật (geolocation hoặc mô phỏng) | Xong trên `develop` |
| TV5 | Deploy Worker, subscription trỏ về Worker | Một phần: API đã lên bản mới; web, Worker, Pub/Sub, bảng GPS trên Cloud SQL chưa xác nhận |
| TV6 | QA end-to-end create → assign → pickup → deliver | Đạt trên local (PostgreSQL thật); chưa chạy trên Cloud |

## Kết quả

- Chốt code bằng PR #26 (`week/07` → `main`, `bbdfe83`), chờ duyệt. Chốt trễ, trước khi Cloud xong, để nhóm sang tuần 8.
- Còn treo sang tuần 8: TV5 hoàn tất deploy (web, Worker có `DATABASE_URL`, Pub/Sub, chạy `002` trên Cloud SQL), sau đó kiểm cả luồng trên Cloud bằng tài khoản thật.
