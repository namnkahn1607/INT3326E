# Tuần 13 (14/12–20/12)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: FALSE. Checkpoint nhóm: sản phẩm, tài liệu và số liệu sẵn sàng bàn giao.

## Việc của TV6 theo sheet

Cả nhóm: dự phòng sửa bug, mỗi người hoàn thiện báo cáo và ADR của module mình; chuẩn bị Architecture Defense (câu 6 về tải 5×/10×, câu 11 về chi phí).

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W13-TV6-01 | Báo cáo và ADR Auth/RBAC: quyết định ba role, claims làm nguồn role, tra UserRecord mỗi request | Tài liệu tuần 4–5 | ADR và báo cáo module Auth | FR10, AC10 | Nội dung có sẵn trong [auth-rbac.md](../contracts/auth-rbac.md) và [bàn giao](auth-rbac-handoff.md) |
| W13-TV6-02 | Báo cáo Admin directory và notification | Tuần 6, 9 | Báo cáo module | FR08, FR10 | Admin directory có sẵn; notification chưa |
| W13-TV6-03 | Báo cáo QA tổng hợp | W11-TV6-01c, W12-TV6-01b | Báo cáo QA kèm bằng chứng | AC01–AC10, NFR | Chưa bắt đầu |
| W13-TV6-04 | Chuẩn bị trả lời câu 6 và câu 11 bằng số liệu tuần 12 | W12-TV6-01b | Phần trả lời có số liệu | NF02, NF11 | Chưa bắt đầu |
| W13-TV6-05 | Dự phòng sửa lỗi Auth, Admin | Danh sách lỗi | Lỗi đóng kèm commit | AC10 | Chưa bắt đầu |

## Đã làm được

- Chưa có việc nào của tuần này. Phần ghi nhận về Auth và Admin đã có trong repo.

## Còn thiếu và rủi ro

- Báo cáo phải ghi đúng người có commit (hai commit Auth mang tên tác giả `Codex`, là việc của Đạt) và đúng môi trường kiểm tra.
- Rà lại các đường dẫn, vì tên file tài liệu đã đổi.
