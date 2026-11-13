# Customer/Admin — theo dõi GPS

Nguồn hiện hành: [PF SPEC 01 v1.4](https://docs.google.com/document/d/1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8/edit),
FR05/AC05, UI01/03, API09/11 và SC05/06. Phạm vi TV3 tuần 8 theo lịch hiện hành;
nền tảng tracking được làm trước theo lịch kỹ thuật cũ. Không thay API/Driver/Worker/SQL.

## Theo dõi đơn

Chi tiết Customer/Admin có bản đồ Leaflet dùng cấu hình tile hiện có, hai điểm
lấy/giao và marker tài xế từ GET `/v1/shipments/{id}/tracking`.
Đọc ngay khi mở, rồi 5 giây sau request trước hoàn tất; chỉ một request đang chạy.
Rời trang, đổi đơn/tài khoản hoặc xác nhận đơn terminal hủy request/timer.
Terminal từ tracking dừng tự đọc; người dùng vẫn có thể đọc lại thủ công.
Terminal đã được Detail/action xác nhận ẩn panel GPS ngay, không chờ chu kỳ sau.

Response kiểm tra đúng ID, đủ key, enum/tọa độ/timestamp và nullable theo SC05.
CREATED/terminal không được trả vị trí/timestamp driver; thiếu GPS không giả 0,0.
Tọa độ 0,0 hợp lệ vẫn được vẽ. Reassign thay marker theo driver của snapshot mới.

Nhãn mới/cũ dùng isLocationStale và tuổi locationClientTimestamp trong [0,30] giây.
GPS cũ là vị trí ghi nhận gần nhất, không gọi là vị trí trực tiếp. Đồng hồ UI
cập nhật khi chờ request; thời điểm đọc thành công tránh nhầm mẫu mới nhận là future
chỉ vì tick giao diện chưa chạy. receivedAt không thay thế thời điểm mẫu.

Lỗi đọc xóa marker/tọa độ GPS cũ khỏi view. Khi đã đọc được Detail đúng quyền,
loading, tải lại thủ công hoặc lỗi transient giữ cùng map instance và hai điểm
giao nhận của đơn, giúp tránh tải lại tile. Không lưu snapshot GPS để dự phòng.
Vùng thông báo có chiều cao tối thiểu để bản đồ không bị đẩy khi đổi trạng thái.
Mỗi mẫu GPS mới không tự căn lại viewport; driver mới hoặc đơn khác căn lại khung.
Lỗi transient tiếp tục thử đọc sau 5 giây;
401/403/404, tài khoản chưa liên kết hoặc response sai ẩn bản đồ và dừng tự đọc,
có nút thử lại.
Không tự ghi lại trạng thái hoặc suy kết quả mutation từ marker.
Không tính ETA, deadline, late hoặc tuyến đường trong frontend.

## Bản đồ tài xế Admin

`/admin/live-map` dùng GET `/v1/drivers?limit=20&cursor=...`, giữ trang hiện tại
khi polling. API11 parser dùng SC06; không quét các trang khác hoặc tự thêm query.
Chuyển trang/tài khoản hủy read cũ. Thống kê và bộ lọc mới/cũ/thiếu GPS chỉ áp dụng
trong trang đang hiển thị. Có số trang, số tài xế đã tải và thời điểm cập nhật.

activeShipmentCount không phải onlineFlag; không hiển thị điện thoại/biển số/đơn
đang giao do tự suy đoán. Marker chỉ cho vị trí API trả về; missing không sinh điểm.
Hết dữ liệu hoặc lỗi hiển thị rõ, không khôi phục danh sách minh họa cũ.
Tên/tọa độ có bản chữ, marker nhận focus bàn phím; giữ reduced motion và theme Customer.

API đọc đúng quyền/snapshot, lưu GPS SQL và chống trùng thuộc backend/Worker.
Kết quả kiểm tra và điều kiện nối xem [bàn giao tracking](live-tracking-handoff.md).
