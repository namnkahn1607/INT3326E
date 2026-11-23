# Frontend tuần 9 — thông báo, giao trễ và directory

Ngày kiểm tra: 22/11/2026. Bản frontend được kiểm trên `feature/frontend`,
từ `develop@5e79dcb`; chưa deploy. Nguồn giao việc hiện tại:
[điều phối tuần 9](../coordination/week-09.md) và ảnh người dùng cung cấp
ngày 22/11. Dùng contract API10/SC07, Admin directory và API07 trên nhánh
`tv1/week9@2e68818`; không sửa backend, SQL, Worker, IAM, secret hoặc key.

## Phần đã triển khai

| Màn hình | API / hành vi |
| --- | --- |
| Customer → Thông báo | GET `/v1/notifications?limit=20&cursor=…`; dữ liệu từ server, link chi tiết đơn, polling nối tiếp 10s; phân trang, loading/empty/error/retry |
| Admin → Tài khoản | GET `/v1/admin/customers?limit=20&cursor=…`; tên, email, phone nullable; bỏ ba dòng cứng và banner demo; không CRUD/cấp role/trạng thái giả |
| Customer/Admin → Chi tiết | Nhãn “Giao trễ” khi `isLate === true`; false/null không suy thành đúng giờ. Khi API09 đổi cờ, đọc lại detail một lần; GPS đổi tọa độ không đọc lại detail |
| Driver → Chi tiết PICKED_UP | “Báo giao thất bại”, reason trim 5–500 code point, xem lại/hủy/xác nhận, POST `/v1/shipments/{id}/fail`; chặn gửi lặp, giữ kết quả server/no-op, lỗi chưa rõ chỉ GET đối chiếu |

Adapter kiểm response/pagination trước render; cursor opaque không giải mã.
Scope dữ liệu theo phiên người dùng; đổi account/cursor hoặc rời trang hủy
request, bỏ response cũ. API vẫn quyết định ownership/quyền. SC07 không có
read receipt nên không thêm unread, mark-read hoặc tổng số chưa đọc.

Giữ layout, theme và luồng lấy/giao/GPS của Driver đã có trên develop. Không
tạo màn hình mới hoặc tính lại `isLate` bằng đồng hồ frontend.

## Kiểm chứng đã chạy

| Kiểm tra | Kết quả / mức giả lập |
| --- | --- |
| Test liên quan | 103/103: adapter, notification scope/polling/cursor/retry, directory, late flag, Driver/Admin fail/no-op/recovery và UI hiện có; API mock |
| `npm run test:integration --workspace=@parcelflow/web` | 15/15, UI → client/parser thật → Nest HTTP → PGlite RAM; Firebase mock. Có notifications, Customer khác không thấy, directory Admin/Customer 403 và late/null |
| `npm run check` | Đạt: 181 Worker/shared/load, 2 health, 465 API, 621 web; 125 ca PostgreSQL/Firebase emulator thiếu môi trường bị bỏ qua |
| Chrome headless | 10 lượt: năm màn hình × 390/1440px; có phân trang/retry, link, dark/light Admin, xác nhận Driver; app/layout/router thật, Auth/HTTP fixture qua CDP |

[Kết quả browser](../evidence/week9-frontend/browser.json) không có runtime
exception hoặc tràn ngang. Đã mở ảnh để đối chiếu. Screenshot và dữ liệu đều
là fixture tổng hợp; browser không gửi mutation lên Cloud.

| Màn hình | 390px | 1440px |
| --- | --- | --- |
| Thông báo | [Ảnh](../evidence/week9-frontend/notifications-390.webp) | [Ảnh](../evidence/week9-frontend/notifications-1440.webp) |
| Tài khoản Admin | [Ảnh](../evidence/week9-frontend/accounts-390.webp) | [Ảnh](../evidence/week9-frontend/accounts-1440.webp) |
| Tài khoản Admin sáng | [Ảnh](../evidence/week9-frontend/accounts-light-390.webp) | [Ảnh](../evidence/week9-frontend/accounts-light-1440.webp) |
| Customer giao trễ | [Ảnh](../evidence/week9-frontend/customer-late-390.webp) | [Ảnh](../evidence/week9-frontend/customer-late-1440.webp) |
| Admin giao trễ | [Ảnh](../evidence/week9-frontend/admin-late-390.webp) | [Ảnh](../evidence/week9-frontend/admin-late-1440.webp) |
| Driver xác nhận thất bại | [Ảnh](../evidence/week9-frontend/driver-failure-review-390.webp) | [Ảnh](../evidence/week9-frontend/driver-failure-review-1440.webp) |

## Còn phụ thuộc

API07 chưa nằm trong `develop@5e79dcb`; PR #51 còn chờ tích hợp. Form Driver
và Admin đã kiểm contract/mock nhưng **chưa nghiệm thu fail qua backend thật**.
Sau khi PR merge, chạy lại Driver/Admin fail, no-op, sai Driver, state conflict,
history/notification qua Nest/SQL và Cloud. Không dựng endpoint giả trong API.

Chưa nghiệm thu AC07/AC08 UI trên Hosting mới; TV5 deploy từ SHA chung, sau đó
TV6 chạy regression Cloud và quyền chéo. Key CARTO/billing/DB vẫn thuộc người
phụ trách Cloud. Phần đo tracking local 18/11 được giữ nguyên ở
[tracking-read-load](tracking-read-load.md), không thay checkpoint ưu tiên
AC07/08 hoặc tự kết luận LT04 Cloud. Bundle chính còn cảnh báo trên 500kB.

## Chạy lại

```powershell
npm.cmd test --workspace=@parcelflow/web -- customer-directory-notifications CustomerNotificationsPage AdminAccountsPage DriverShipments ShipmentTrackingJourney AdminShipmentDetailPage AdminUi
npm.cmd run test:integration --workspace=@parcelflow/web
npm.cmd run check
git diff --check
```

Không cần tài khoản Cloud cho các test local trên; fixture Nest dùng PGlite
RAM, không đọc DATABASE_URL thật. Không commit `.env.example` đang có thay
đổi local hoặc file chứa key/token; `AGENTS.md` giữ nguyên.
