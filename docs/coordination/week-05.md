# Week 5 (19/10–25/10)

Mục lục: [Điều phối theo tuần](README.md)

**Checkpoint:** Customer đăng nhập, tạo và xem đơn thật lưu trên Cloud SQL.

| TV | Việc theo sheet | Sheet |
| --- | --- | --- |
| TV1 | Schema Shipment, API tạo đơn thật | TRUE |
| TV2 | Schema `current_locations` / `location_history`, thống nhất convention với TV1 | TRUE |
| TV3 | Đăng nhập Customer, form tạo đơn nối API thật, danh sách đơn của mình | TRUE |
| TV4 | Tiếp tục test pipeline Pub/Sub, chốt event schema GPS với TV2 | TRUE |
| TV5 | Kết nối Cloud SQL từ Cloud Run, cấu hình secrets | TRUE |
| TV6 | Firebase Auth đủ 3 role (custom claims), auth guard | TRUE |

## Kết quả

- Chốt bằng PR #24 (`week/05` → `main`, merge commit `510f85d`).
- Lúc chốt, `npm ci` lỗi vì lockfile thiếu `@electric-sql/pglite`; đã sửa trên `week/05` trước khi merge.
