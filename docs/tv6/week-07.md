# Tuần 7 (02/11–08/11)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: FALSE. Checkpoint nhóm: luồng tạo đơn đến giao hàng hoạt động hoàn chỉnh; vị trí driver ghi được qua Worker.

## Việc của TV6 theo sheet

QA luồng end-to-end create → assign → pickup → deliver.

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W7-TV6-01 | Chuẩn bị tài khoản Customer, Admin, Driver đúng role và đơn test | Auth tuần 5, `set-role` | Fixture trong [qa-test-plan.md](../qa-test-plan.md); không đưa mật khẩu hay token vào Git | AC10 | Chưa làm |
| W7-TV6-02a | Create: tạo đơn, kiểm shipment, history, notification trong SQL | W7-TV6-01 | Bảng kết quả TC01.x | AC01 | Có thể làm trước |
| W7-TV6-02b | Assign và reassign trước pickup | W7-TV6-02a | Kết quả TC02.1–02.4 | AC02 | Có thể làm trước |
| W7-TV6-02c | Pickup và deliver | API pickup/deliver của TV1 | Kết quả TC03.1–03.4 | AC03 | BLOCKED: chưa có handler trên `develop` |
| W7-TV6-02d | Quyền sai (Customer khác, Driver không được gán, Admin) | W7-TV6-01 | Kết quả TC10.x | AC10, NF09 | Có thể làm trước |
| W7-TV6-02e | History theo scope và thứ tự | Endpoint history của TV1 | Kết quả TC06.1 | AC06 | BLOCKED: chưa có endpoint riêng |
| W7-TV6-02f | GPS lưu SQL: một mẫu đi từ queue đến hàng SQL | Worker + SQL thật (TV2, TV5) | `eventId` đối chiếu qua API, Pub/Sub, Worker, SQL | AC04, TC04.8 | Chưa làm; chạy riêng khỏi luồng đơn |
| W7-TV6-03 | Tổng hợp lỗi và bằng chứng, tách mock/local/Cloud | Các bước trên | Bảng PASS/FAIL/BLOCKED theo ca | Mẫu ghi kết quả ở [tv6-weekly.md](tv6-weekly.md) | Chưa làm |

## Đã làm được

- 07/11: sửa lệch cột GPS giữa Admin directory và Worker, để `/v1/drivers` đọc đúng bảng mà Worker ghi (chưa kiểm với dữ liệu Worker thật).
- 07/11: test Admin directory chạy thật trên PostgreSQL local (7 ca SQL); toàn bộ API 406 đạt.
- Có sẵn kịch bản, fixture và ma trận ca trong `qa-test-plan.md`.

## Còn thiếu và rủi ro

- Pickup, deliver, fail và endpoint history chưa có trên `develop` (TV1), nên các ca TC03.x và TC06.1 chỉ ghi BLOCKED.
- Worker có chế độ lưu bộ nhớ; log ACK chưa chứng minh đã ghi SQL. Cần xác nhận runtime dùng PostgreSQL.
- Sheet ghi TV5 triển khai push subscription, code hiện dùng pull; nhóm cần chốt.
- Chưa có bằng chứng Cloud cho bất kỳ ca nào ở tuần này.
