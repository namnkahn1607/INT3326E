# Tuần 2: tài liệu

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: Chưa cập nhật. Không tự xác nhận đã được duyệt.

## Việc của TV6 theo sheet

Soạn Auth/RBAC, liên kết người dùng, thông báo và ma trận QA.

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W2-TV6-01 | Soạn Auth/RBAC: xác thực, role, quy tắc 401/403 | W1-TV6-01 | Hợp đồng Auth | FR10, AC10 | Đã có |
| W2-TV6-02 | Soạn liên kết Firebase UID với user nghiệp vụ | Schema `users` | Quy tắc 409 `USER_NOT_PROVISIONED` | AC10 | Đã có (code), tài liệu ở handoff |
| W2-TV6-03 | Soạn đặc tả thông báo | FR08 | Mô tả notification | FR08, AC08 | Đặc tả ở Google Docs v1.4 (Phần III mục 4.8); chưa có file riêng trong repo |
| W2-TV6-04 | Soạn ma trận QA | Hợp đồng API | Ma trận ca kiểm thử | Phần VI.14 | Bản nháp từ 24/10 |

## Đã làm được

- [`../auth-rbac.md`](../contracts/auth-rbac.md): hợp đồng Auth/RBAC, 337 dòng sau khi tách.
- [Bàn giao Auth và RBAC](auth-rbac-handoff.md): tích hợp, cấp claims, kết quả local.
- [`../qa-test-plan.md`](../qa/test-plan.md): bản nháp ma trận ADM01–ADM17 và bảng checkpoint nghiệp vụ.

## Còn thiếu và rủi ro

- Đặc tả thông báo nằm ở FR08/AC08 trong Google Docs v1.4, repo chưa có file riêng; logic notification ở backend thuộc tuần 9.
- Ma trận QA mới phủ Admin directory; các ca vòng đời đã dẫn mã TC của đặc tả nhưng chưa có kết quả chạy.
