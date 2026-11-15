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
- Desktop hiển thị hai danh sách cạnh nhau ngay khi mở trang; chọn đơn sẽ mở
  rộng chính thẻ đó để xem chi tiết và xác nhận. Bấm lại hoặc thu gọn để đóng;
  không có panel riêng dưới hai cột. Mobile xếp một cột. Thẻ đơn tóm tắt mã,
  người nhận, trạng thái và hai địa chỉ; lịch sử đầy đủ có thể mở trong chi tiết.
- Không hiện các dòng đếm theo trang; vẫn giữ phân trang và số đơn tài xế đang xử lý.
- CREATED cho phân công; ASSIGNED cho gán lại trước pickup. Cùng tài xế hiện hành
  không cần gửi lại. PICKED_UP và terminal không cho phân công/gán lại.
- Chọn đơn, chọn tài xế, xem lại rồi xác nhận riêng. Chặn bấm lặp và khóa lựa chọn
  khi đang gửi. Chỉ báo thành công sau response server hợp lệ.
- 409 do state thay đổi, timeout, lỗi mạng, 5xx hoặc response sai cần GET Detail
  để đối chiếu; không tự phát lại Assign. Đọc lại không thành công thì giữ khóa
  ghi, chỉ cho đọc lại. Nếu vẫn muốn phân công, chọn và xác nhận một ý định mới.
- `USER_NOT_PROVISIONED` là lỗi liên kết tài khoản, không phải conflict pickup.
- Chuyển trang xóa lựa chọn cũ; phân trang đơn và tài xế độc lập. Đổi đơn giữ
  trang tài xế đang xem. Chưa sắp xếp tài xế theo khoảng cách. Hủy request đọc
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
DriverResponse và điều kiện GPS dùng đúng [Admin directory](admin-directory.md),
không chép lại schema hoặc suy ra online/offline từ số đơn active.

## Tích hợp và nghiệm thu

Backend danh sách/chi tiết/Assign được bổ sung ở develop `7b5754f`, đã merge
cùng `4b6c56a` vào nhánh frontend ngày 02/11/2026. UI/client hiện có tương thích
với handler mới, giữ thiết kế và contract; xem [bàn giao Admin](admin-assignment-handoff.md).
Đã kiểm tra UI với Nest thật và SQL PGlite cô lập: tạo/xem lại, gán/gán lại,
phân trang và phục hồi lỗi. Firebase và chọn địa chỉ là fixture; GPS ngoài scope.
Chạy từ gốc repo: `npm run test:integration --workspace=@parcelflow/web`.
Không dùng kết quả này thay nghiệm thu Firebase/Cloud SQL thật hoặc khóa
PostgreSQL đa connection. Sau deploy phát hiện hai enum SQL không so sánh trực
tiếp được; người dùng đã duyệt sửa tối thiểu projection/filter backend và test.
Xem kết quả hồi quy text/enum tại bàn giao. Không đổi API/nghiệp vụ, Driver,
GPS hoặc database nhóm; cần deploy bản sửa query để xác nhận lại trên Cloud.
