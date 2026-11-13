# @parcelflow/database

Schema Prisma vẫn là bản nháp lịch sử của ParcelFlow. Các role là `CUSTOMER`, `DRIVER` và `ADMIN`.

## Thiết lập

Chưa đăng ký lệnh database, lệnh sinh Prisma hay script seed ở đây.

## Mốc nền tảng cho test tạo đơn

`sql/001-create-shipment.sql` triển khai PF SPEC 01 v1.3 DATA01/02/03/06/07
**chỉ cho schema rỗng**. File tạo nguyên tử người dùng, đơn hàng, sự kiện trạng thái,
thông báo và bản ghi idempotency. File chủ động báo lỗi khi
tên bảng đã tồn tại, tránh che giấu schema không tương thích hoặc ghi đè dữ liệu.
Không có DDL tự chạy khi khởi động; API dùng pg và pool chung của TV6,
không dùng Prisma được sinh tự động. Mốc nền tảng này không đổi các model và phần ghi GPS.

Ánh xạ lưu trữ vẫn là `trackingCode/senderId/delivery*` sang JSON
`trackingNumber/customerId/dropoff*`. Người dùng và đơn hàng có ULID dạng chuỗi kèm tiền tố;
ID sự kiện/thông báo là UUID. Các trường gói hàng tùy chọn cho phép null. **Không** dùng
giá trị UUID mặc định và các trường gói hàng bắt buộc trong Prisma để sinh migration
xung đột với phần triển khai này. Review/đồng bộ Prisma riêng với TV1/TV2/TV6.

Test API chỉ áp dụng file này cho schema dùng tạm trong PostgreSQL WASM hoặc
DB test loopback được chỉ định rõ. Không áp dụng mốc nền tảng cho schema mới trực tiếp lên database
Cloud SQL đã có dữ liệu hoặc dùng chung. TV1/TV6 phải kiểm tra schema/dữ liệu hiện có và phụ trách
kế hoạch migration/cấp phát tại chỗ trước khi tích hợp; TV5 điều phối triển khai.
Quickstart cũ trong `specs/` chỉ có ở máy cá nhân (thư mục bị `.gitignore`), xem [Tạo đơn hàng](../../docs/features/create-shipment.md).

## Các bảng GPS (DATA04/05)

`sql/002-create-gps-locations.sql` tạo `location_history` và
`current_locations` với các cột camelCase mà Worker ghi và API
đọc. Chạy sau `001-create-shipment.sql` (file có tham chiếu `users`). Tương tự 001,
file báo lỗi khi tên bảng đã tồn tại thay vì sửa chúng.

Kiểm tra Worker với database thật (bỏ qua khi chưa đặt biến):

```sh
WORKER_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/parcelflow_worker_test npm test
```

Bộ kiểm tra áp dụng 001 và 002 lên schema tạm, sau đó kiểm tra việc giữ bản ghi đầu tiên,
không đưa `current_locations` lùi về mẫu cũ hơn, các mẫu chỉ lưu lịch sử và
rollback transaction.

## Nhánh GPS được tích hợp ngày 02/11/2026

Bản nháp Prisma của Na hiện có metadata lịch sử/vị trí GPS hiện tại và
khóa giữ bản ghi đầu tiên. Các ánh xạ snake_case trong đó chưa được duyệt để thay thế
mốc SQL camelCase mà các handler Shipment/Auth đang chạy sử dụng.
Không chạy migration hay sinh Prisma trong lần merge này. Đối chiếu các bảng
GPS và quyền thực tế trước khi bật Worker ghi SQL; xem
[bàn giao merge](../../docs/history/gps-branch-merge.md).
