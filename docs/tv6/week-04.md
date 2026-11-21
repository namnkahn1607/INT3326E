# Tuần 4 (12/10–18/10)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: TRUE. Checkpoint nhóm: URL chung truy cập được, health check hai Cloud Run service trả 200, Pub/Sub topic/subscription tồn tại.

## Việc của TV6 theo sheet

Scaffold Auth module (Firebase Auth), phác thảo module Admin.

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W4-TV6-01 | Xác thực token Firebase (`TokenVerifier`, service Firebase) | Hợp đồng Auth | Verifier có thể mock | AC10 | Đã có, test mock |
| W4-TV6-02 | Guard xác thực và guard phân quyền, decorator `@Roles` | W4-TV6-01 | `FirebaseAuthGuard`, `RolesGuard` | AC10 | Đã có, test mock |
| W4-TV6-03 | Scaffold `AdminModule` (controller, service) | W4-TV6-02 | Module Admin rỗng, chưa có endpoint | FR10 | Đã có |
| W4-TV6-04 | Gỡ role DISPATCHER, dùng ADMIN cho điều phối | Quyết định 09/10 | Code, test, tài liệu đồng bộ | FR10 | Đã có |

## Đã làm được

- Code Auth: `691ae07`, `649a4f5`, `d82e0b9`, `a409693` (05/10). Scaffold Admin: `1883408`.
- Quyết định ADMIN: `73b998c`, `d266269`, `b09462a` cùng PR #4 và #11 (09/10), gồm cả test từ chối claim DISPATCHER.
- Tất cả đã vào `develop`. Môi trường kiểm: local, mock. Hợp đồng ở [auth-rbac.md](../contracts/auth-rbac.md).

## Còn thiếu và rủi ro

- Code Auth của tuần này làm vào 05–09/10, sớm hơn lịch của sheet khoảng một tuần.
- Chưa có bằng chứng Auth chạy trên Cloud Run ở tuần này.
