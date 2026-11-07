# Tuần 5 (19/10–25/10)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: TRUE. Checkpoint nhóm: Customer đăng nhập, tạo và xem đơn thật lưu trên Cloud SQL.

## Việc của TV6 theo sheet

Tích hợp Firebase Auth đầy đủ (custom claims 3 role), auth guard middleware.

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W5-TV6-01 | Role lấy từ Firebase custom claims, kiểm `checkRevoked` và UserRecord hiện tại | W4-TV6-01 | `RoleClaimsService`, verifier cập nhật | AC10, NF09 | Đã có, test mock và Emulator |
| W5-TV6-02 | Công cụ cấp/đổi role cho operator (`auth:set-role`, mặc định chỉ preview) | W5-TV6-01 | `tools/set-role.ts` | AC10 | Đã có, chưa chạy trên project thật |
| W5-TV6-03 | Nối đăng nhập Firebase ở frontend, `/auth/me`, route theo role | W5-TV6-01 | `features/auth` trong `apps/web` | AC10 | Đã có, 29 test frontend |
| W5-TV6-04 | Liên kết user nghiệp vụ: `UsersRepository`, `BusinessUserGuard`, lỗi 409/503 dạng ProblemDetails | W5-TV6-01 | Guard và exception filter | AC10, AC01 | Đã có, SQL mock |
| W5-TV6-05 | Bàn giao cấu hình frontend cho TV5 | W5-TV6-03 | [frontend-config-handoff.md](../frontend-config-handoff.md) | NF12 | Đã có |

## Đã làm được

- Commit `fe0b6e2` và `16f0cb1` (17/10), `87bb551` (18/10, PR #16). Hai commit đầu do Đạt thực hiện bằng Codex nên Git ghi tác giả `Codex`.
- Kết quả local ngày 17/10: 121 kiểm tra local và 7 ca Emulator đạt; follow-up PR #15: 111 test API đạt. Chi tiết ở [bàn giao Auth](auth-rbac-handoff.md).
- Giao diện đăng nhập sau đó được Tuấn làm lại (30/10); logic Firebase là phần của TV6.

## Còn thiếu và rủi ro

- Chưa đăng nhập thật cho cả ba role trên Cloud/Hosting. Lượt thăm dò 18/10 cho thấy revision `backend-service-00012-m54` chưa có route Auth.
- Mỗi request đang tra Firebase hai lần nối tiếp; chưa đo p95 trên Firebase thật nên chưa kết luận NF03/NF04.
- Migration và seed `users` thuộc TV1/TV5; chưa nghiệm thu 409 `USER_NOT_PROVISIONED` trên Cloud SQL.
