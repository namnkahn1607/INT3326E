# Tạo đơn giao hàng

Nguồn: [PF SPEC 01 nội dung v1.3](spec-baseline.md), FR01/AC01,
API01, SC02 và DATA02/03/06/07. Chi tiết wire contract được duy trì tại
[API contract](api-contract.md) và [OpenAPI](openapi.json).

## Hành vi và quyền

Chỉ CUSTOMER đã xác thực và có business identity hợp lệ được tạo qua
POST `/v1/shipments`. Backend lấy actor từ phiên đã xác minh; không nhận owner,
role, driver hoặc state do client gửi. Kết quả HTTP201 là shipment CREATED cùng
trackingNumber do server sinh; không phải thông tin trạng thái mới nhất về sau.

Địa chỉ, tọa độ, người nhận và trường tùy chọn phải đúng validation API01.
Tên JSON trackingNumber/customerId/dropoff* được ánh xạ sang
trackingCode/senderId/delivery* trong SQL, không đổi wire name theo schema.

## Chống trùng và dữ liệu

- Idempotency-Key là UUIDv4; scope theo actor, operation và key. Cùng ý định trong
  window mặc định 24 giờ giữ cùng payload đã chuẩn hóa và key.
- Cùng key/payload trả snapshot201 ban đầu; khác payload trả409. Key hết hạn có
  thể tạo đơn mới, không hứa chống trùng vĩnh viễn.
- Một transaction ghi shipment, CREATED event, notification và snapshot chống
  trùng. Bất kỳ bước ghi nào lỗi phải rollback toàn bộ; không retry mù khi mất
  phản hồi commit.
- Deadline được kiểm tra cho lần tạo mới; replay hợp lệ trả snapshot trước khi
  xét điều kiện deadline động. Tracking unique, prefixed ULID và nullable fields
  phải thống nhất giữa API, database và frontend.

## Dữ liệu và triển khai

[Database README](../packages/database/README.md) mô tả baseline SQL và giới hạn
áp dụng. Không coi Prisma draft là migration đã chạy hoặc áp baseline schema
trống vào database dùng chung đang có dữ liệu. Tài khoản Firebase và business
user phải liên kết đúng; API không tự provision tài khoản hoặc cấp role.

[Bàn giao Create](create-shipment-handoff.md) lưu bằng chứng HTTP/SQL local,
rollback và replay theo checkpoint 24–25/10/2026. Không suy từ kết quả đó rằng
revision Cloud hiện tại đã được nghiệm thu. Danh sách/Detail/Assign là các API
khác; tạo thành công không chứng minh các đường đọc đã tồn tại.

## Chạy kiểm tra

Từ root: `npm run typecheck --workspace=@parcelflow/api`,
`npm run test --workspace=@parcelflow/api`, `npm run build --workspace=@parcelflow/api`.
SQL test mặc định dùng môi trường test theo suite; native PostgreSQL chỉ chạy
khi có database local riêng đúng điều kiện của test, không dùng DSN Cloud.
