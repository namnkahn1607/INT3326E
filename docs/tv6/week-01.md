# Tuần 1: tài liệu

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: Chưa cập nhật. Không tự xác nhận đã được duyệt.

## Việc của TV6 theo sheet

Tổng hợp vai trò, quyền, tiêu chí nghiệm thu, danh mục tài liệu.

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W1-TV6-01 | Liệt kê vai trò và quyền (CUSTOMER, DRIVER, ADMIN) | Nguồn đề tài | Bảng role và quyền | FR10 | Có bản nháp (05/10) |
| W1-TV6-02 | Lập danh mục tài liệu và tiêu chí nghiệm thu | Nguồn đề tài | Danh mục tài liệu, tiêu chí | Phần I, III | Chưa tìm thấy file riêng trong develop |

## Đã làm được

- `docs/auth-rbac.md` (commit `bf93103`, 05/10): định nghĩa hợp đồng Firebase Auth và RBAC, 345 dòng ở bản đầu.
- Quyết định 09/10: giữ ba role, gộp điều phối vào ADMIN, không có role Dispatcher riêng.

## Còn thiếu và rủi ro

- Danh mục tài liệu và tiêu chí nghiệm thu chưa thấy file riêng trong `develop`; phần này có thể nằm trong Google Docs của nhóm, chưa đối chiếu.
- Trạng thái sheet vẫn là Chưa cập nhật.
