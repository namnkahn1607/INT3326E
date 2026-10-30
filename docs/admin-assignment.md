# Admin phân công tài xế

Nguồn: [PF SPEC 01 nội dung v1.3](spec-baseline.md), FR02/AC02,
API02/03/04/11 và UI03. Dispatcher đã gộp vào ADMIN, giữ route `/admin`.
Phạm vi tài liệu là frontend phân công; backend transaction do phần API cung cấp.
Trang chi tiết riêng `/admin/shipments/:id` và báo thất bại sau pickup được mô tả
tại [vòng đời đơn](shipment-lifecycle.md); không ghép chúng vào thao tác Assign.

## Hành vi

- `/admin/shipments` tra cứu theo trạng thái/mã vận đơn chính xác, có phân trang.
- `/admin/assignment` hiển thị đơn CREATED hoặc ASSIGNED và danh sách tài xế.
  Đọc Detail hiện hành trước khi xác nhận; tài xế có nhiều đơn vẫn được chọn.
- CREATED cho phân công; ASSIGNED cho gán lại trước pickup. Cùng tài xế hiện hành
  không cần gửi lại. PICKED_UP và terminal không cho phân công/gán lại.
- Chọn đơn, chọn tài xế, xem lại rồi xác nhận riêng. Chặn bấm lặp và khóa lựa chọn
  khi đang gửi. Chỉ báo thành công sau response server hợp lệ.
- 409 do state thay đổi, timeout, lỗi mạng, 5xx hoặc response sai cần GET Detail
  để đối chiếu; không tự phát lại Assign. Đọc lại không thành công thì giữ khóa
  ghi, chỉ cho đọc lại. Nếu vẫn muốn phân công, chọn và xác nhận một ý định mới.
- `USER_NOT_PROVISIONED` là lỗi liên kết tài khoản, không phải conflict pickup.
- Chuyển trang xóa lựa chọn cũ; phân trang đơn và tài xế độc lập. Hủy request đọc
  khi đổi query/đơn/route và bỏ qua response đã cũ.

## Contract sử dụng

| Method/path | Mục đích |
| --- | --- |
| GET `/v1/shipments` | Danh sách theo limit/cursor, tùy chọn status/trackingNumber |
| GET `/v1/shipments/{id}` | Detail và statusHistory |
| GET `/v1/drivers` | Chọn tài xế theo limit/cursor |
| POST `/v1/shipments/{id}/assign` | Body chỉ `{driverId}`, HTTP200 ShipmentResponse |

ID dùng sh_/usr_ + ULID theo [API contract](api-contract.md). Bearer do client
chung cung cấp; không gửi actor, role hoặc Idempotency-Key của Create cho Assign.
Response phải khớp đơn/tài xế và trạng thái ASSIGNED.
DriverResponse và điều kiện GPS dùng đúng [Admin directory](tv6-admin-directory.md),
không chép lại schema hoặc suy ra online/offline từ số đơn active.

## Tích hợp và nghiệm thu

Frontend đã được kiểm tra local/mock; xem [bàn giao Admin](admin-assignment-handoff.md).
Backend danh sách/chi tiết/Assign còn thiếu tại snapshot kiểm tra 30/10/2026;
mock không thay bằng chứng phân công thật hoặc Driver thấy đúng đơn.
Giữ nguyên backend, Driver, GPS và database trong nhiệm vụ frontend này.
