# TV6: công việc theo tuần

Người phụ trách: Đỗ Đức Đạt (GitHub `datdooo`). Soạn ngày 05/11/2026, đối chiếu với `origin/develop`.

Mỗi tuần có một file riêng: việc của TV6 theo sheet, phân rã chi tiết, phần đã làm được và phần còn thiếu. Checkbox trong sheet không thay bằng chứng. Local/mock và Cloud được ghi riêng. Chưa có mục nào được kiểm trực tiếp trên Cloud.

## Các tuần

| Tuần | Thời gian | Trạng thái sheet |
| --- | --- | --- |
| [Tuần 1](week-01.md) | Tài liệu | Sheet: chưa cập nhật |
| [Tuần 2](week-02.md) | Tài liệu | Sheet: chưa cập nhật |
| [Tuần 3](week-03.md) | Tài liệu | Sheet: chưa cập nhật |
| [Tuần 4](week-04.md) | 12/10–18/10 | Sheet: TRUE |
| [Tuần 5](week-05.md) | 19/10–25/10 | Sheet: TRUE |
| [Tuần 6](week-06.md) | 26/10–01/11 | Sheet: TRUE |
| [Tuần 7](week-07.md) | 02/11–08/11 | Sheet: FALSE |
| [Tuần 8](week-08.md) | 09/11–15/11 | Sheet: FALSE |
| [Tuần 9](week-09.md) | 16/11–22/11 | Sheet: FALSE |
| [Tuần 10](week-10.md) | 23/11–29/11 | Sheet: FALSE |
| [Tuần 11](week-11.md) | 30/11–06/12 | Sheet: FALSE |
| [Tuần 12](week-12.md) | 07/12–13/12 | Sheet: FALSE |
| [Tuần 13](week-13.md) | 14/12–20/12 | Sheet: FALSE |

## Lưu ý về mốc ngày

Code của TV6 chạy sớm hơn lịch sheet khoảng một tuần. Ví dụ Firebase Auth đủ ba role nằm ở tuần 5 của sheet (19/10–25/10) nhưng commit ngày 17/10, thuộc tuần 4 theo lịch. Bảng dưới ghi ngày commit thật, không sửa ngược sheet.

## Cách đọc mã việc

- Mã việc theo mẫu của Phần VII: `W<tuần>-TV<người>-<số>`. Tuần 7 chép lại từ ví dụ trong đặc tả.
- Dispatcher là Admin làm điều phối, không có role thứ tư. `POST /location` trong sheet là `POST /v1/locations`.
- "Tiêu chí" dẫn mã FR/AC/NFR/TC/LT/REC của đặc tả. Chỉ tính đạt khi có bằng chứng đúng môi trường (mock, SQL local hay Cloud), ghi riêng từng loại.
- Mỗi việc bàn giao thêm: commit/PR, môi trường hoặc revision, người rà soát, phần chưa đạt.
- Thứ tự tích hợp chung: chốt contract, tài khoản, schema; rồi API và Worker; rồi UI và cấu hình Cloud; rồi QA đầu cuối; cuối cùng sửa lỗi và xác nhận checkpoint. Việc độc lập làm song song, không dồn kiểm thử đến tuần 11.

| TV | Họ tên | Mảng |
| --- | --- | --- |
| TV1 | Nguyễn Lê Nam Khánh | Backend nghiệp vụ (Shipment) |
| TV2 | Nguyễn Lê Na | GPS và Worker |
| TV3 | Lê Đình Anh Tuấn | Frontend Customer/Admin |
| TV4 | Nguyễn Minh Anh | Frontend Driver, GPS emitter, load test |
| TV5 | Trần Đại Quang | Cloud, CI/CD, giám sát |
| TV6 | Đỗ Đức Đạt | Auth, Admin, notification, QA |

## Điểm cần nhóm chốt

1. Danh sách "8 use case bắt buộc" của checkpoint tuần 9.
2. Push hay pull cho Worker (dòng tuần 7 của TV5 so với code hiện tại).
3. Mapping cột GPS giữa Worker (snake_case) và API directory (camelCase có ngoặc kép), chốt theo DB thật.
4. Phân rã trên chưa tính độ lệch người được giao với người làm thực tế.

## Mẫu ghi kết quả mỗi ca

| Case/version | Môi trường, source, revision | Fixture và actor | Expected / actual | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| | | | | PASS / FAIL / BLOCKED / NOT RUN | |

## Mẫu bàn giao mỗi việc

| Mã | Commit/PR | Môi trường/revision | Người rà soát | Kết quả | Phần chưa đạt |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Bàn giao theo chủ đề

- [Chia việc cả nhóm tuần 4–13](week-task-breakdown.md)
- [Bàn giao Auth và RBAC](auth-rbac-handoff.md)
- [Bàn giao Admin directory](admin-directory-handoff.md)
