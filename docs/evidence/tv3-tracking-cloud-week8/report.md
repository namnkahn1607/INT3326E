# TV3 — kiểm tracking Cloud ngày 18/11/2026

**Checkpoint tuần 8 chưa đạt.** Customer đã đọc đúng đơn được gán và hiện GPS
cũ có nhãn; chưa quan sát được marker di chuyển bằng GPS mới, marker Admin
cùng đơn hoặc marker biến mất sau giao. Không nâng AC05 lên Cloud.

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
