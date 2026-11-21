# Bàn giao Admin directory

| | |
| --- | --- |
| Người phụ trách | Đỗ Đức Đạt (TV6) |
| Ngày | 23/10/2026 |
| Commit | `1063cf1` (PR #19, nhánh `feature/tv6-admin-directory`) |
| Môi trường đã kiểm | Local, mock/HTTP và SQL qua PGlite |
| Chưa kiểm | Cloud SQL, race đa kết nối (ADM12), smoke trên revision đã deploy |

Contract API và điều kiện SQL nằm ở [Admin directory](../features/admin-directory.md). Kế hoạch ca kiểm thử ở [QA test plan](../qa/test-plan.md).

## Kết quả kiểm tra

- API: **179 test pass**, gồm 7 SQL integration qua `pg`/Nest HTTP trên
  PostgreSQL WASM (PGlite 0.5.11); Firebase được mock. **7 Firebase Auth
  Emulator test skip**, không được tính đã chạy. Nếu không cấu hình SQL test,
  bộ mặc định có 172 pass, 7 SQL skip và 7 emulator skip.
- API cài sạch từ lockfile riêng, typecheck và build pass. Root workspace
  `npm ci --ignore-scripts`, typecheck và **74 test GPS/runner** pass.
- Root lint không có error, còn cảnh báo scaffold rỗng/strictNullChecks có sẵn.
  Frontend production build pass, còn cảnh báo bundle lớn có sẵn.
- OpenAPI 3.0.3 validation và `git diff --check` pass.

SQL test sử dụng database in-memory riêng, không phải Cloud SQL; không đo NFR,
không chạy race đa kết nối thực hoặc nghiệm thu runtime production. Database
application, Firebase thật, IAM và deployment không bị thay đổi. Bản code được
bàn giao qua nhánh `feature/tv6-admin-directory`; kết quả này chưa nghiệm thu deploy. TV1/TV2/TV5
cần xác nhận migration/runtime trước khi chạy smoke các endpoint mới trên cloud.

## Kiểm tra lại ngày 07/11/2026

- Truy vấn driver đọc `current_locations` bằng cột camelCase có quote (`"driverId"`, `"clientTimestamp"`, `"receivedAt"`) theo DATA04 của đặc tả v1.4. Ngày 07/11 tôi từng đổi sang snake_case để khớp Worker và Prisma lúc đó, rồi hoàn tác cùng ngày: đặc tả dùng camelCase và Worker của Na (`0626fd0`, chưa merge) đã đổi sang camelCase.
- Chuyển `admin-directory.repository.ts` vào `admin/repositories/`, cùng kiểu với `controllers/`, `services/`, `dto/`.
- Test SQL: chạy với PostgreSQL thật trên máy (loopback, database `parcelflow_admin_test`, cụm tạm đã xóa sau khi chạy), không dùng PGlite. Toàn bộ API: 406 test đạt, 73 skip (SQL của shipments/assignments và Firebase Emulator chưa bật), typecheck đạt. Tăng từ 399 đạt vì 7 ca SQL của Admin chạy thật.
- Sửa test `admin-directory.postgres.spec.ts`: `search_path` được đặt lại mỗi khi pool mở kết nối. Trước đó ca "503 khi thiếu cột GPS" fail trên Postgres thật, cả ở `ea0b74d`, vì `search_path` mất sau khi kết nối bị thay.
- Chưa kiểm: Cloud SQL, race đa kết nối (ADM12), schema thật của `current_locations` trên Cloud. Tên cột camelCase theo đặc tả, chưa đối chiếu với DB đã deploy. Worker trên `develop` vẫn ghi snake_case cho đến khi nhánh của Na được merge.
