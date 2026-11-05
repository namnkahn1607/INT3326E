# Bàn giao Admin directory

| | |
| --- | --- |
| Người phụ trách | Đỗ Đức Đạt (TV6) |
| Ngày | 23/10/2026 |
| Commit | `1063cf1` (PR #19, nhánh `feature/tv6-admin-directory`) |
| Môi trường đã kiểm | Local, mock/HTTP và SQL qua PGlite |
| Chưa kiểm | Cloud SQL, race đa kết nối (ADM12), smoke trên revision đã deploy |

Contract API và điều kiện SQL nằm ở [Admin directory](admin-directory.md). Kế hoạch ca kiểm thử ở [QA test plan](qa-test-plan.md).

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
