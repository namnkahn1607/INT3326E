# Week 6 (26/10–01/11)

Mục lục: [Điều phối theo tuần](README.md)

**Checkpoint:** Dispatcher gán được tài xế; message GPS test thấy trong Pub/Sub console.

| TV | Việc theo sheet | Sheet |
| --- | --- | --- |
| TV1 | API gán tài xế, khóa transaction chống gán trùng | TRUE |
| TV2 | `POST /v1/locations` (chỉ publish, chưa ghi DB) | TRUE |
| TV3 | UI Dispatcher (đơn chưa gán, gán tài xế), khung UI Admin | TRUE |
| TV4 | UI Driver đăng nhập/dashboard, gửi thử GPS (chỉ log) | TRUE |
| TV5 | Kiểm message GPS trong Pub/Sub console, IAM cho service account Worker | TRUE |
| TV6 | Backend Admin (danh sách driver/customer), phác thảo QA test plan | TRUE |

## Kết quả

- Chốt bằng PR #25 (`week/06` → `main`, merge commit `60a8bfa`).
- Nhánh GPS của TV2 được tích hợp vào `develop` trong tuần này (`ea0b74d`).
