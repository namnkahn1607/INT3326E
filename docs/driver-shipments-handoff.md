# Bàn giao TV4 — danh sách đơn và nhận/giao

Ngày 08/11/2026. Nhánh `feature/driver-shipments` tạo từ
`origin/develop@cbec8fb93765fb12e78b01fac3f09778e7ed94de` sau fetch.
Working tree đầu lượt sạch. Các kết quả bên dưới được thu trước commit.
Sau bàn giao, người dùng cho phép commit/push và merge trực tiếp vào develop,
không cần PR. Không deploy; nghiệm thu backend thật và GPS Cloud vẫn còn mở.
Phạm vi do người dùng yêu cầu trực tiếp; [spec, D1–D5](driver-gps-week7/spec.md),
[plan](driver-gps-week7/plan.md), [checklist](driver-gps-week7/checklist.md)
và [tasks W709–W713](driver-gps-week7/tasks.md) bổ sung bộ TV4 hiện có.

## Đã làm

- `/driver`: danh sách đơn từ API hiện có, lọc trạng thái và phân trang cursor,
  loading/rỗng/lỗi/thử đọc lại. Scope do backend lấy từ phiên Driver; Firebase UID
  không bị dùng làm business driverId trong query hoặc để tự lọc kết quả.
- `/driver/shipments/:id`: trạng thái, địa chỉ lấy/giao, thông tin người nhận,
  ghi chú và history từ Detail. Tái sử dụng StatusBadge/ShipmentLifecycleDetails.
- ASSIGNED: xem lại rồi xác nhận đã lấy hàng. PICKED_UP: ghi chú tùy chọn tối đa
  255 Unicode code point, xem lại rồi xác nhận giao. Có hủy và khóa gửi lặp.
- Adapter theo OpenAPI: POST pickup không body; POST deliver chỉ có ghi chú tùy
  chọn; Bearer từ client chung, không actor/role/idempotency field trong body.
  Chỉ HTTP 200 với đúng shipment ID và trạng thái đích được xác nhận thành công.
- Không tự retry POST. Thành công hoặc kết quả chưa rõ đều đọc lại Detail;
  GET không được gọi là bằng chứng POST thành công. Đọc lỗi khóa thao tác;
  chỉ giữ snapshot POST đã được xác nhận. Mất quyền 401/403/404 xóa cả snapshot
  đã xác nhận, tránh giữ thông tin liên hệ sau phân công lại. Ý định cũ bị xóa.
- Rời route/đổi tài khoản/đăng xuất hủy request và bỏ response muộn. GPS/Auth
  hiện có được giữ; không sửa backend, schema, dependency hoặc contract.

## Kiểm chứng

| Kiểm tra | Kết quả | Mức bằng chứng |
| --- | --- | --- |
| Toàn bộ frontend | 493/493, 36 file, exit 0 | jsdom/API mock, gồm 31 test bổ sung |
| Shipment integration | 10/10, exit 0 | UI → Nest HTTP → PGlite SQL; Firebase fixture, không phải Cloud |
| `npm.cmd run lint:web` | Exit 0 | ESLint |
| `npm.cmd run build:web` | Exit 0 | TypeScript + Vite; chưa deploy |
| Microsoft Edge 157.0.4341.42 | 39/39, exit 0 | Browser local, Auth/API mock; gồm 26 kịch bản GPS cũ |
| 320/390/1440 px | Không tràn ngang | Đã kiểm tra ảnh danh sách/chi tiết màn 320 và xác nhận giao |
| `git diff --check` | Exit 0 | Diff code/docs |

[Báo cáo browser](evidence/driver-shipments/report.json) có source SHA-256,
base SHA và trạng thái chưa commit. Các hash source đã đối chiếu khớp.
Không có runtime error hoặc HTTP request ngoài origin thử. Ảnh tiêu biểu:
[danh sách 320 px](evidence/driver-shipments/shipments-320.png),
[chi tiết 320 px](evidence/driver-shipments/shipment-detail-320.png),
[xác nhận giao](evidence/driver-shipments/delivery-confirmation.png).

Integration kiểm tra hai đơn gán hai Driver: mỗi Driver chỉ thấy đúng đơn;
Detail đọc đúng SQL/history; phân công lại làm Driver cũ mất quyền và UI xóa
thông tin đơn. POST pickup thật trả 404 vì base chưa có handler; UI chỉ đọc lại,
không báo đã lấy hàng và SQL vẫn ASSIGNED. Đây là bằng chứng xử lý thiếu API,
không phải bằng chứng nghiệp vụ pickup/deliver đã thành công.

Review/converge cuối đối chiếu D1–D5: không còn thiếu sót bắt buộc local.
Trong implement, test hồi quy từng FAIL vì còn giữ liên hệ sau GET 403 dù POST
đã thành công; đã sửa xóa snapshot khi mất quyền và suite frontend đạt như trên.
W713 và W707 còn mở; không dùng checklist yêu cầu để thay bằng chứng thực thi.

## Còn phụ thuộc

- TV1 cung cấp handler pickup/deliver đúng OpenAPI, quyền Driver được gán,
  transaction/history/notification, idempotency tự nhiên và bàn giao test SQL.
- TV5/TV6 bàn giao revision/config và tài khoản Driver thật có linkage. TV4
  chạy lại list → pickup → deliver, đối chiếu Detail/history và dữ liệu SQL.
- GPS Cloud W707 vẫn cần TV2/5/6 đối chiếu API → Pub/Sub → Worker → SQL.
  Lượt này không thao tác Cloud hoặc gửi dữ liệu thật.

## Chạy lại

Từ gốc repo, Node >=22.12 và dependency đã cài theo lockfile:

```powershell
npm.cmd run test --workspace=@parcelflow/web
npm.cmd run test:integration --workspace=@parcelflow/web
npm.cmd run lint:web
npm.cmd run build:web
$env:DRIVER_REVIEW_PLAYWRIGHT = 'C:\Users\_____\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
$env:DRIVER_REVIEW_OUTPUT = 'Z:\INT3326E\.vitest\driver-shipments-review'
node --experimental-strip-types apps/web/scripts/verify-driver-dashboard.mjs
git diff --check
```

Harness dùng Edge headless, loopback 127.0.0.1:5179, fixture Auth/API riêng;
không truy cập phiên trình duyệt của người dùng. Harness vẫn có cảnh báo
MODULE_TYPELESS_PACKAGE_JSON của shared GPS type; exit 0. Dùng `npm.cmd` khi
PowerShell chặn npm.ps1; không cần thay ExecutionPolicy. Mở ứng dụng thật bằng
`npm.cmd run dev:web`, cấu hình Firebase/API như hướng dẫn frontend hiện có;
không có mock hoặc tài khoản demo được thêm vào runtime app.
