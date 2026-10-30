# Frontend chung

Nguồn: [PF SPEC 01 nội dung v1.3](spec-baseline.md), UI01–03.
Frontend dùng chung tại `apps/web`; cấu trúc code theo [ARCHITECTURE](../ARCHITECTURE.md).
Không tạo app riêng cho từng role. React/Vite/TypeScript, Firebase Authentication
và Hosting được giữ theo package hiện có. Login, Customer và Admin dùng giao diện
Dark Minimal: nền đen than, bề mặt xám tối và điểm nhấn tím tiết chế. Driver giữ theme riêng.

## Routing và trách nhiệm

| Khu vực | Route | Trách nhiệm |
| --- | --- | --- |
| Phiên đăng nhập | `/login` | Auth dùng chung; điều hướng sau khi xác định role |
| Customer | `/customer`, `/customer/create`, `/customer/shipments`, `/customer/shipments/:id`, `/customer/history`, `/customer/notifications` | [Customer frontend](customer-frontend.md) |
| Admin | `/admin`, `/admin/shipments`, `/admin/shipments/:id`, `/admin/assignment`, `/admin/drivers`, `/admin/live-map`, `/admin/accounts` | [Phân công](admin-assignment.md) và [vòng đời đơn](shipment-lifecycle.md); Admin gồm điều phối |
| Driver | `/driver` | [Driver dashboard/GPS](driver-dashboard-gps.md) |

Roles chỉ gồm CUSTOMER, DRIVER, ADMIN theo [Auth/RBAC](auth-rbac.md).
Route guard là kiểm soát giao diện; backend vẫn kiểm tra quyền từng request.
Client dùng API chung có Bearer token, timeout và abort; không truy cập Cloud SQL
hoặc Pub/Sub trực tiếp, không giả lập phiên thành công trong ứng dụng thật.

## Trạng thái tích hợp

Đối chiếu code tại `6d75d53`: login và form tạo đơn đã dùng luồng thật; Customer
Overview/List/Detail và Admin Shipments/Assignment/Drivers đã có API client.
Backend hiện có Create và Admin directory; danh sách/chi tiết/Assign shipment
vẫn cần được hoàn thiện. Giao diện gọi API không chứng minh endpoint đã deploy.
Admin Overview đọc cùng API danh sách, chỉ đếm trên tối đa 20 đơn vừa tải;
không coi là số liệu toàn hệ thống. Customer History/Notifications và Admin
Accounts/LiveMap còn dữ liệu mẫu; phải phân biệt rõ với dữ liệu tài khoản.
Driver chưa có danh sách đơn thật.

Theme tập trung tại `apps/web/src/dark-dashboard.css`, giới hạn trong `.pf-dark`.
Customer dùng thanh điều hướng ngang phía trên, menu tài khoản và một nút tạo đơn.
Header và nội dung Customer căn cùng khung tối đa 1200px; menu nằm cạnh logo,
tra cứu gọn cạnh lời chào trên desktop và chuyển hàng trên mobile.
Tổng quan Customer dùng banner mở hòa vào nền và một thẻ đơn đang giao,
đọc trên tối đa 20 đơn vừa tải; không thêm danh sách đơn trùng hoặc số liệu mẫu.
Đường giao nhận động nằm trong banner; thông tin dịch vụ được gom vào chân trang.
Admin dùng `DashboardNavigation` với sidebar 240px có thể thu/mở và drawer mobile.
Tên trang chỉ xuất hiện trong nội dung; mục điều hướng active theo route.
Form, bảng, trạng thái, skeleton, hộp thoại và intro đăng nhập cùng bảng màu;
không thay đổi API contract, cơ chế xác thực hoặc quyền thao tác.

Phần bổ sung tuần 4 frontend có [chi tiết/lịch sử cơ bản và báo thất bại Admin](shipment-lifecycle.md).
Backend Detail/Fail vẫn là điều kiện cần để nghiệm thu luồng thật.

Luồng trạng thái dùng chung là CREATED → ASSIGNED → PICKED_UP → DELIVERED hoặc
DELIVERY_FAILED. Không thêm DISPATCHER, CANCELLED hoặc thao tác sửa enum tùy ý.
Tuần 4 phản ánh vòng đời; polling/tracking đầu cuối thuộc tuần 5 theo nguồn.

## Kiểm tra

Từ gốc repo: `npm run lint:web`, `npm run build:web`,
`npm run test --workspace=@parcelflow/web`. Cách chạy và Hosting xem
[README frontend](../apps/web/README.md) và [bàn giao cấu hình](tv6-deploy-handoff.md).
Nghiệm thu tuần 1 được lưu tại [báo cáo frontend](frontend-week1-handoff.md).
