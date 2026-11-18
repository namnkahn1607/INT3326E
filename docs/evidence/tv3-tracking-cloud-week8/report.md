# TV3 — kiểm tracking Cloud ngày 18/11/2026

**Cập nhật buổi tối:** đã kiểm chứng GPS mới và marker di chuyển trên Customer
và Admin, ẩn marker và dừng polling khi Driver giao thành công. Chưa đóng toàn
bộ nghiệm thu UI/AC05: nền OpenStreetMap lỗi kết nối và phần detail chưa tự
đồng bộ trạng thái với panel tracking. Xem lượt buổi tối ở cuối tài liệu.

**Kết luận lượt buổi sáng:** Customer đọc được đơn ASSIGNED và GPS cũ có nhãn;
chưa quan sát marker di chuyển hoặc terminal. Các mục dưới đây, tới phần
"Tiếp tục", giữ nguyên bằng chứng lịch sử của lượt buổi sáng.

## Nhánh và kiểm tra local

Nhánh TV3 là `feature/frontend` (commit frontend ban đầu `f270154`). Đã pull
`develop` và fast-forward nhánh TV3 tới `2fd3ec8`; không thay code runtime.

- `NODE_OPTIONS=--no-experimental-webstorage npm.cmd run check`: exit 0,
  Worker/shared/load 166, health e2e 2, API 465, web 584 đạt; 125 ca phụ thuộc
  PostgreSQL/Firebase emulator bỏ qua. Log `.vitest/tv3-week8-check-verified.log`.
- `npm run test:integration --workspace=@parcelflow/web`: 12/12 đạt, exit 0;
  Nest/PGlite và Firebase mock, không phải PostgreSQL/Cloud thật.
- Một lượt check trước timeout 5 giây ở ca API08 `location.http.spec.ts`.
  Chạy riêng đạt 33/33 rồi check toàn repo đạt; không đổi timeout hoặc bỏ test.
  Main bundle còn cảnh báo 502,93 kB có từ trước.

## Cloud quan sát trực tiếp

Mốc giờ là giờ Việt Nam, 18/11/2026. Web `https://int3326e.web.app`, API
`https://backend-service-wcvss3dnxa-as.a.run.app`. Chưa xác minh SHA Hosting
hoặc revision API/Worker trong lượt này; không suy ra từ HEAD local.

| Bước | Kết quả và giới hạn |
| --- | --- |
| Ban đầu | SQL `int3326esql` Stopped, lần dừng 08:28:35. Customer list và detail trả 503; list trả `SERVICE_UNAVAILABLE`. Admin detail cũng 503; `/v1/auth/me` vẫn 200. |
| Khôi phục SQL được người dùng cho phép | Start khoảng 08:50; Console ghi Started 08:54:11. Không đổi IAM, secret, schema hoặc dữ liệu bằng SQL trực tiếp. |
| Worker tạm | Diff chỉ Billing Request-based → Instance-based và min instances 0 → 1; max 20, timeout 300s, concurrency 80 giữ nguyên. Gửi triển khai khoảng 08:54, có giới hạn tối đa 20 phút. |
| Đơn kiểm thử riêng | Customer tạo `PF2026111812SYSK` lúc 09:02; shipment `sh_01M7P68J2ESQ4HRA7WVVBSN4XD`. Admin gán cho Nguyen Van B (`usr_01M5SW7617KAKAMEE4G0W50HRX`). Dữ liệu ghi rõ mô phỏng, không giao hàng thực tế. |
| Customer tracking | Detail hiển thị Đã gán tài xế, đúng driver trên lịch sử. Tracking hiển thị `GPS cũ · Vị trí ghi nhận gần nhất`, mẫu 21:52 ngày 17/11, tọa độ `21.029111, 105.805417`. Chưa có bằng chứng mẫu mới xuất hiện trên map. |
| Driver simulator | Bật Mô phỏng khoảng 09:06, dừng khoảng 09:08. Bộ đếm mẫu tăng từ 17 tới 28, nhưng accepted vẫn 17 và pending 0; eventId hiển thị vẫn của lượt 17/11. Không dùng bộ đếm này làm bằng chứng POST 202 mới hoặc persistence mới. Chưa xác định nguyên nhân. |
| Admin tracking | Đọc được detail đơn mới ở CREATED và thực hiện phân công. Chưa kiểm lại marker sau phân công. |
| Kết thúc đơn | Không pickup/deliver đơn mô phỏng; đơn còn ASSIGNED để tiếp tục kiểm. Không đổi trạng thái các đơn có sẵn. |

Điều khiển UI nhiều lần bị gián đoạn: browser access host không sẵn sàng,
công cụ không xác định chắc URL khi mở tab mới, đổi tiêu điểm và báo user input.
Không coi thao tác đã thử là kết quả thành công; các mục chưa quan sát vẫn mở.

## Ảnh 390px và 1440px

Ảnh chụp thật từ DevTools Responsive trước khi bật SQL, của đơn lịch sử
`sh_01M7MCZ70H77SVH0AFY0B1PXN4`, ghi nhận **trạng thái bị chặn 503**:

- [Customer 390 CSS px](customer-blocked-390.png): PNG 780 × 1800, DPR 2.
- [Customer 1440 CSS px](customer-blocked-1440.png): PNG 2880 × 1800, DPR 2.

Hai ảnh này không chứng minh marker di chuyển, đơn mới, Admin hay terminal.
Ảnh nghiệm thu các trạng thái đó ở cả hai kích thước vẫn cần bổ sung.

## Dọn tài nguyên đã xác nhận

GPS đã dừng. Đã gửi hoàn nguyên Worker khoảng 09:09; đọc lại Console trước
09:13 thấy service healthy, `No changes made`, min 0 và Request-based được chọn.
Diff hoàn nguyên chỉ hai trường nói trên; giữ max 20/timeout 300s/concurrency 80.
Hoàn nguyên trong giới hạn 20 phút của Worker.

SQL Stop được xác nhận; operations drawer ghi **Stopped 09:12:30**.
Không để DB hoặc Worker Instance-based tiếp tục chạy sau lượt kiểm.

## Tiếp tục

1. Kiểm nguyên nhân simulator tạo mẫu nhưng accepted không tăng trong phiên
   Driver; đối chiếu Network của POST `/v1/locations`, không kết luận từ UI cũ.
2. Với runtime/chi phí được duyệt, dùng chính đơn mô phỏng trên; xác nhận GPS
   mới qua API → Worker → SQL rồi theo dõi ít nhất hai tọa độ khác nhau trên
   Customer và Admin, ghi timestamp/eventId/revision.
3. Pickup/deliver đơn mô phỏng, xác nhận marker bị xóa và polling dừng ở cả hai
   role; lưu ảnh thật 390/1440px rồi mới chốt AC05/checkpoint.

## Kiểm lại buổi tối — GPS mới và terminal

Nguồn yêu cầu đã đọc trực tiếp: PF SPEC 01 **v1.4**, cập nhật 02/11/2026,
D03/D08, V.SD03/SD09, API08/API09, VI.15 và FR05/AC05. Bản chỉ dẫn
`docs/contracts/spec-baseline.md` vẫn ghi v1.3; không dùng dòng cũ để phủ định
bản gốc. Source local `develop@f60de90`, báo cáo ở nhánh
`test/frontend-week8-cloud-tracking`; không thay code runtime hoặc deploy.

### Điều kiện và phạm vi

- Đăng nhập ba phiên Driver, Customer và Admin trên trình duyệt Chrome.
- Lúc 20:04, Auth 200 nhưng detail 503; người dùng xác nhận DB chưa bật và tự
  bật lại. Sau đó detail và API09 trả 200. Trước khi sửa runtime, API09 chỉ trả
  mẫu ngày 17/11, trong khi Driver có POST GPS 202 mới.
- Ảnh người dùng gửi lúc 20:19 cho thấy Worker min 0, max 20, Request-based.
  Người dùng sau đó báo đã chỉnh Cloud theo yêu cầu. TV3 không đổi Cloud,
  IAM, secret, SQL hoặc subscription; chưa đọc lại đầy đủ revision/config sau
  thay đổi, không suy ra SHA deploy từ HEAD local.
- Cùng đơn mô phỏng `PF2026111812SYSK`, ID
  `sh_01M7P68J2ESQ4HRA7WVVBSN4XD`; dữ liệu và tuyến GPS là mô phỏng,
  HTTP tới Firebase/Cloud Run là thật. Không phải một ca giao hàng thực địa.

### Kết quả trực tiếp

| Tiêu chí | Quan sát Cloud |
| --- | --- |
| Driver gửi GPS | POST `/v1/locations` trả 202; mẫu cuối được lưu bằng chứng có `eventId=evt_0f656e20-e238-477f-9f9a-8577d11e638c`, `receivedAt=2026-11-18T13:38:31.790Z`. |
| Customer nhận GPS mới | API09 200, PICKED_UP, `isLocationStale=false`. Các mẫu UTC 13:34:38.228, 13:34:46.226, 13:34:54.224 lần lượt có tọa độ `21.029111,105.805417`, `21.028811,105.805117`, `21.028511,105.804817`. |
| Admin cùng đơn | API09 trả cùng driver và các mẫu mới tương ứng; nhãn GPS mới và tọa độ cập nhật trên UI. |
| Marker thực sự đổi vị trí | Ở cùng viewport 1440px, Customer từ `translate3d(717px,246px,0px)` lúc 20:37:53 sang `(710px,254px,0px)` lúc 20:38:11; Admin từ `(705px,239px,0px)` lúc 20:37:56 sang `(691px,254px,0px)` lúc 20:38:14. Không kéo/zoom map giữa hai lần đọc. |
| Polling nối tiếp | Resource Timing trước terminal: 21 request Customer, 17 Admin; không có request tracking chồng nhau trong chuỗi quan sát, khoảng nghỉ sau hoàn tất xấp xỉ 5 giây. |
| Worker nhận mẫu | Ảnh log do người dùng cung cấp hiển thị `EVT01 GPS Event` liên tục khoảng 8 giây từ 20:35 tới 20:38. Log này nằm trước thao tác ghi SQL trong source, nên riêng ảnh không chứng minh commit/ACK. |
| Driver giao xong | Người dùng tự xác nhận giao thành công đúng đơn mô phỏng; TV3 không thao tác thay Driver. API09 ở cả hai role trả DELIVERED, tọa độ/timestamp/stale/ETA đều null như SC05. |
| Ẩn marker, dừng polling | Cả hai panel tự đổi sang terminal và còn hai pin lấy/giao, không còn pin Driver. Customer giữ 21 request từ 20:39:20 tới 20:39:49; Admin giữ 17 từ 20:39:23 tới 20:39:55. Không reload hoặc đổi viewport trong khoảng đo này. |
| Responsive | Quan sát panel ở viewport 390 và 1440 CSS px, DPR 1; mobile documentWidth 390, không tràn ngang. Các ảnh dưới là ảnh cắt panel trong viewport tương ứng. |

[Response API, vị trí DOM và số request đã lọc bỏ request headers](evening-observations.json).
Không lưu Authorization, token, cookie hoặc credentials. Không đọc SQL trực tiếp
trong lượt này; không dùng API09 làm bằng chứng đầy đủ về history/dedupe/recovery AC04.

### Ảnh buổi tối

| Trạng thái | Customer 390px | Customer 1440px | Admin 390px | Admin 1440px |
| --- | --- | --- | --- | --- |
| GPS cũ trước sửa runtime | [Ảnh](customer-stale-evening-390.webp) | [Ảnh](customer-stale-evening-1440.webp) | [Ảnh](admin-stale-evening-390.webp) | [Ảnh](admin-stale-evening-1440.webp) |
| GPS mới sau sửa runtime | [Ảnh](customer-fresh-evening-390.webp) | [Ảnh](customer-fresh-evening-1440.webp) | [Ảnh](admin-fresh-evening-390.webp) | [Ảnh](admin-fresh-evening-1440.webp) |
| Đơn kết thúc | [Ảnh](customer-terminal-evening-390.webp) | [Ảnh](customer-terminal-evening-1440.webp) | [Ảnh](admin-terminal-evening-390.webp) | [Ảnh](admin-terminal-evening-1440.webp) |

Ảnh terminal desktop ghi panel tự kết thúc trong trang đang mở. Đổi chế độ
mobile khiến trình duyệt tải lại và detail đọc DELIVERED, vì vậy ảnh mobile
hiển thị nhánh "Đơn đã kết thúc" không dựng bản đồ; không dùng ảnh mobile để
chứng minh tự dừng polling (đã đo riêng trước khi đổi viewport).

### Kiểm tra local trong lượt tiếp tục

- `npm.cmd run check` trên `f60de90`: exit 0; Worker/shared/load 166, health
  e2e 2, API 465, web 584 đạt; 125 ca PostgreSQL/Firebase emulator bỏ qua.
  Lượt đầu timeout Worker health; chạy riêng 1/1 rồi toàn repo đạt, không sửa test.
  Log tại `%TEMP%/parcelflow-tv3-week8-20261118-check-retry.log`.
- Integration web → Nest → PGlite: 12/12 đạt, exit 0. Lượt đầu timeout
  khởi tạo fixture 30 giây; chạy lại đạt, không nới timeout hoặc bỏ test.
  Firebase mock; kết quả này không phải kiểm tra PostgreSQL/Cloud thật.
- Chỉ thêm tài liệu và ảnh sau kiểm tra, không đổi runtime. Giữ nguyên
  `.env.example` local, không đưa dữ liệu bí mật vào báo cáo.

### Việc còn mở

1. Tile `https://tile.openstreetmap.org/...png` trả `net::ERR_CONNECTION_REFUSED`
   trong trình duyệt nghiệm thu. Marker và tọa độ cập nhật nhưng nền trống;
   chưa xác định lỗi mạng hay chính sách chặn dịch vụ, không kết luận do API GPS.
2. Khi API09 tự thấy DELIVERED, header/detail/history vẫn giữ snapshot PICKED_UP
   cho tới khi đọc lại detail; Admin còn form báo thất bại cũ. Chưa kiểm thao tác
   submit form đó, không suy ra backend cho phép thay đổi đơn terminal.
3. Chưa chạy lại Cloud negative cases (owner/driver khác), reassign, failed;
   chưa có deployment record đầy đủ hoặc kiểm chi phí. Không nâng toàn bộ
   AC04/AC05/AC09/AC10 hay toàn nhóm tuần 8 lên đạt từ ca mô phỏng này.

Kết luận: **chuyển động marker và terminal/polling của TV3 đã có bằng chứng
Cloud**. Nghiệm thu giao diện đầy đủ vẫn mở cho hai lỗi trên. Tài nguyên Cloud
do người dùng quản lý trong lượt này; TV3 không bật/tắt hoặc hoàn nguyên.
