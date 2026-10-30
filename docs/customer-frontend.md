# Customer frontend

Nguồn: [PF SPEC 01 nội dung v1.3](spec-baseline.md), AUTH01, API01–03 và UI01.
Đây là phạm vi Customer; không định nghĩa lại Auth hoặc API nghiệp vụ.

## Luồng sử dụng

- Customer đăng nhập bằng tài khoản đã provision; không chọn role hoặc tự cấp quyền.
  Phiên và lỗi xác thực tuân theo [Auth/RBAC](auth-rbac.md).
- Tạo đơn gồm địa chỉ/điểm lấy, địa chỉ/điểm giao, tên và điện thoại người nhận;
  thông tin bưu kiện, ghi chú, cân nặng và hạn giao là tùy chọn theo API01.
- Một lần xác nhận là một ý định tạo. Chặn gửi lặp; mất phản hồi giữ payload và
  Idempotency-Key, không tự retry nền hoặc tạo key mới để bỏ qua kết quả chưa rõ.
- Chỉ báo thành công sau response hợp lệ. Hiển thị mã vận đơn server; muốn biết
  trạng thái hiện hành phải đọc Detail, không dùng snapshot Create replay.
- Danh sách dùng filter trạng thái/mã chính xác và cursor của server; số lượng
  chỉ thuộc trang hiện tại. Detail đọc từ ID trong URL, theo quyền Customer.
- Loading, rỗng, lỗi và thử lại được phân biệt; lỗi không biến thành danh sách
  rỗng hoặc dữ liệu mẫu. Hủy đọc cũ khi đổi query, route hoặc tài khoản.

## Địa chỉ và bản đồ

Địa chỉ và tọa độ được gửi cùng nhau; người dùng chọn điểm trên bản đồ thay vì
phải gõ kinh/vĩ độ. Chỉ dẫn riêng cho tài xế được giữ khi thay đổi điểm chọn.
Demo hiện dùng Leaflet/raster và tra cứu VIETMAP theo quyết định bổ sung;
provider, giới hạn và ngoại lệ key demo được ghi tại [API contract](api-contract.md).
Đây là thay đổi sau checkpoint Customer tuần 2, không phải điều kiện tuần 1.

Tên/SĐT bên gửi hiện chỉ là ô nhập giao diện, chưa gửi vào field API riêng và
không tự nhét vào notes. Chờ contract backend bổ sung trước khi nối dữ liệu này.

## Contract và ranh giới

Frontend gọi POST `/v1/shipments`, GET `/v1/shipments`, GET `/v1/shipments/{id}`
theo [API contract](api-contract.md) và [OpenAPI](openapi.json). Create nhận HTTP201;
List/Detail nhận HTTP200, dùng trackingNumber/customerId/dropoff* và data/pagination.
Không gửi customerId, role hoặc trạng thái do client tự xác định.

Không đăng ký/cấp quyền, tính giá, COD hoặc tạo chức năng ngoài yêu cầu.
History, notification, tracking và ETA phải được tích hợp theo từng milestone;
màn hình mẫu không được coi là chức năng đã chạy thật.
Chi tiết đơn đã bổ sung [lịch sử trạng thái cơ bản tuần 4](shipment-lifecycle.md);
phần này không thay thế tab History hoặc triển khai tracking.

## Bàn giao và kiểm tra

[Báo cáo Customer](customer-frontend-handoff.md) giữ kết quả theo từng checkpoint;
các mô tả màu cam và scaffold trong báo cáo là lịch sử, không thay thiết kế tím
hiện hành. Chạy lint/build/test frontend theo [hướng dẫn chung](frontend-guide.md).
Luồng thật phụ thuộc API đã deploy, Firebase và liên kết business user đúng.
