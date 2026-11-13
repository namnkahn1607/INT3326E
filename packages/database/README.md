# @parcelflow/database

SQL tạo bảng PostgreSQL cho API và Worker. Không có ORM, không có migration tự chạy khi khởi động; API và Worker truy vấn bằng `pg`.

| File | Bảng | Đặc tả |
| --- | --- | --- |
| `sql/001-create-shipment.sql` | `users`, `shipments`, `shipment_status_events`, `notifications`, `idempotency_requests` | DATA01/02/03/06/07 |
| `sql/002-create-gps-locations.sql` | `location_history`, `current_locations` | DATA04/05 |

Chạy theo thứ tự số (002 tham chiếu `users` của 001). Mỗi file chỉ tạo bảng mới và **báo lỗi nếu bảng đã tồn tại**, để không che giấu schema lệch hay ghi đè dữ liệu. Với Cloud SQL đang có dữ liệu, kiểm tra bảng nào đã có trước khi chạy; không chạy lại cả file. Bảng hoặc cột mới thì thêm file đánh số tiếp, không sửa file đã chạy trên Cloud.

## Quy ước

- Tên cột camelCase có ngoặc kép (`"driverId"`, `"clientTimestamp"`), đúng tên Worker ghi và API đọc.
- Người dùng và đơn hàng dùng ULID dạng chuỗi có tiền tố (`usr_`, ...); ID sự kiện và thông báo là UUID.
- Lưu trữ `trackingCode/senderId/delivery*` ánh xạ sang JSON `trackingNumber/customerId/dropoff*`.
- GPS: `UNIQUE ("driverId", "clientTimestamp")`, mẫu đầu tiên thắng; `current_locations` chỉ cập nhật khi mẫu mới hơn.

## Kiểm tra

Test API áp dụng 001 lên schema tạm trong PGlite hoặc DB test loopback. Test Worker trên PostgreSQL thật (bỏ qua khi chưa đặt biến):

```sh
WORKER_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/parcelflow_worker_test npm test
```

Bộ test áp dụng 001 và 002 lên schema tạm, kiểm tra giữ bản ghi đầu tiên, không đưa `current_locations` lùi về mẫu cũ, mẫu chỉ lưu lịch sử và rollback transaction.

## Lịch sử

Bản nháp Prisma (cột snake_case) đã bỏ ngày 14/11/2026 vì không app nào dùng và mâu thuẫn với SQL đang chạy; xem lại trong lịch sử git (`git show 0626fd0:packages/database/prisma/schema.prisma`). Bối cảnh merge nhánh GPS: [gps-branch-merge](../../docs/history/gps-branch-merge.md).
