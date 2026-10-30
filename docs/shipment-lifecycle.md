# Customer/Admin — vòng đời đơn hàng

Nguồn: [PF SPEC 01 nội dung v1.3](spec-baseline.md), VII.5 phần Customer/Admin,
FR03/FR07, API03/07, SC02/03 và UI01/03. Phạm vi là frontend tuần 4; backend,
Driver pickup/deliver/fail và Worker thuộc phần triển khai tương ứng của nhóm.

## Trạng thái và lịch sử

Customer Detail và Admin Detail hiển thị trạng thái hiện hành từ server theo
CREATED → ASSIGNED → PICKED_UP → DELIVERED hoặc DELIVERY_FAILED.
Lịch sử dùng nguyên statusHistory của API03: action, trạng thái trước/sau,
thời gian, actor và tài xế trước/sau nếu có. REASSIGNED là sự kiện gán lại,
không phải trạng thái mới. Không tự sinh event hoặc suy ra tên người thực hiện.

Thất bại hiển thị reason và người ghi nhận gốc. Giao thành công hiển thị ghi chú
giao hàng nếu server có trả về. History trống không được thay bằng mốc mẫu.
Đây là lịch sử cơ bản trong Detail; tab History Customer, late và inbox chưa
được hoàn thiện trong phạm vi tuần 4 này. Polling/GPS tracking thuộc tuần 5.

## Thao tác Admin

- Chi tiết tại `/admin/shipments/:id`, mở từ danh sách đơn, chỉ ADMIN được truy cập.
- Chỉ PICKED_UP hiển thị form báo giao thất bại. CREATED/ASSIGNED vẫn đi qua
  phân công; terminal không cho tạo thao tác mới. Admin không pickup/deliver.
- Lý do được trim và dài 5–500 ký tự Unicode; xem lại đơn/lý do rồi xác nhận riêng.
  Một lần xác nhận gửi tối đa một POST, khóa form trong khi gửi.
- Chỉ response thành công hợp lệ xác nhận Fail. Sau đó đọc Detail để tải history;
  nếu đọc lỗi, giữ kết quả POST đã xác nhận và báo chưa đọc được dữ liệu bổ sung.
- 409 state conflict, timeout, lỗi mạng, 5xx hoặc response sai: chỉ GET lại Detail,
  không tự gửi lại Fail. Kết quả GET không được coi là bằng chứng POST đã thành
  công. Đọc lại lỗi thì khóa ghi; đọc thành công xóa ý định cũ trước xác nhận mới.
- No-op Fail có thể trả reason/actor của lần khai báo trước. Frontend giữ dữ liệu
  đó, không ghi đè bằng lý do hiện nhập hoặc ép người ghi nhận thành ADMIN.

## Contract và điều kiện kết nối

| Request | Kết quả |
| --- | --- |
| GET `/v1/shipments/{id}` | HTTP200 ShipmentDetail, statusHistory theo SC03 |
| POST `/v1/shipments/{id}/fail` | Body chỉ `{reason}`, HTTP200 ShipmentResponse DELIVERY_FAILED đúng ID |

Bearer do client chung cung cấp; không gửi actor, role, timestamp hoặc
Idempotency-Key của Create. Không PATCH trực tiếp enum. Backend vẫn kiểm tra
quyền, state, transaction và audit theo [API contract](api-contract.md)/[OpenAPI](openapi.json).

Frontend có loading/error/retry đọc, abort khi rời route/đổi tài khoản và bỏ qua
response cũ. Không bổ sung dependency hoặc chế độ giả lập đăng nhập trong app.
Kết quả kiểm tra và phần backend còn chờ xem [bàn giao vòng đời](shipment-lifecycle-handoff.md).
