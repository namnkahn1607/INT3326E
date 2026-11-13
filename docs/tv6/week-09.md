# Tuần 9 (16/11–22/11)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: FALSE. Checkpoint nhóm: hoàn thành đầy đủ 8 use case bắt buộc. Đặc tả không liệt kê rõ tám use case nào, nhóm cần chốt.

## Việc của TV6 theo sheet

Backend notification (tạo khi đổi trạng thái), backend Admin cơ bản (quản lý driver/account).

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W9-TV6-01a | Xác định các thay đổi trạng thái thật cần thông báo (create, assign, pickup, deliver, fail) | Máy trạng thái FR | Danh sách event và người nhận | FR08 | Chưa bắt đầu |
| W9-TV6-01b | Tạo đúng một notification mỗi event thật, trong cùng transaction với đổi trạng thái | W9-TV6-01a, API vòng đời (TV1) | Bảng `notifications` có dữ liệu | AC08, TC08.1 | Một phần: create và assign đã ghi notification (code của TV1) |
| W9-TV6-01c | API đọc thông báo theo chủ đơn, Customer khác không đọc được | W9-TV6-01b | `GET /v1/notifications` (API10); không có mark-read theo SC07 và AC08 | AC08, FR10 | Đã có (07/11), test local; chưa chạy Cloud |
| W9-TV6-01d | No-op và rollback không tạo thông báo; lỗi đọc không mất bản ghi | W9-TV6-01b | Test cho TC08.1–08.2, REC07 | AC08 | Chưa bắt đầu |
| W9-TV6-02a | Admin cơ bản: danh sách driver và customer, phân trang | Directory tuần 6 | Dùng lại `/v1/drivers`, `/v1/admin/customers` | FR10 | Đã có phần đọc |
| W9-TV6-02b | Giữ phạm vi: không CRUD tài khoản, không cấp role qua HTTP | Phần VII | Test ADM15 vẫn đạt | FR10, AC10 | Đã có (không có handler) |

## Đã làm được

- Danh sách tài xế và khách hàng chỉ đọc đã có từ tuần 6, kèm test.
- Create và assign hiện đã ghi notification trong transaction (code của TV1).
- 07/11: `GET /v1/notifications` (API10): chỉ CUSTOMER, scope theo chủ đơn lấy từ token, sắp xếp `createdAt`/`id` giảm dần, keyset cursor gắn với từng Customer, limit mặc định 20 tối đa 100, 503 không lộ SQL, `Cache-Control: no-store`. Có 16 test HTTP với mock Firebase/SQL và 5 test SQL trên PostgreSQL thật trên máy (cùng bảng `notifications` của file SQL 001). Đã thêm vào `docs/openapi.json`. TV3 dùng hợp đồng này cho UI thông báo (W9-TV3-02).

## Còn thiếu và rủi ro

- Notification cho pickup, deliver, fail phụ thuộc API vòng đời của TV1 (chưa có trên `develop`).
- Hạng mục quản lý tài khoản dễ mở rộng ngoài phạm vi; chỉ làm phần đã chốt, đổi phạm vi phải qua nhóm.
