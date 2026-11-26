# ETA frontend — TV3 tuần 10

Ngày kiểm tra: 25/11/2026. Nhánh `feature/frontend`, nền `develop@f88f263`.
Nguồn: [giao việc tuần 10](../coordination/week-10.md), API09/SC05 và
[bàn giao ETA](eta-location-handoff.md). Bàn giao code và bằng chứng local
qua PR vào `develop`; chưa deploy hoặc nghiệm thu ETA trên Cloud.

## Phần đã triển khai

`ShipmentEta.tsx` dùng chung trong panel tracking Customer/Admin, hiển thị
phút còn lại, khoảng cách và giờ tới từ response đã parse. Phút làm tròn
lên; mét/km chỉ là định dạng. Giá trị 0 không bị coi là thiếu dữ liệu và không
suy thành giao thành công. ETA không phải `expectedDeliveryAt`.

Đủ bốn lý do khi `eta=null`, ghi bằng tiếng Việt. GPS quá 30s trong khi chờ
response mới cũng ẩn số ước tính; lỗi đọc, đổi account/route, terminal không
giữ ETA cũ. Không có timer/request riêng hoặc tính Haversine phía frontend.
Giữ map instance, polling, auth, quyền và hạn giao hiện có. Sáng/tối dùng
semantic tokens; mobile hai cột, desktop ba cột; không thêm dependency.

Đã bỏ một import `failShipment` thừa trong test integration nhận từ develop:
gate đầu phiên đỏ ở lint vì import không dùng. Không đổi nghiệp vụ/backend.

## Kiểm chứng

| Kiểm tra | Kết quả / môi trường |
| --- | --- |
| Test ETA/panel/journey | 43/43, gồm 14 test ETA mới. Trước implementation có 11 test mới đỏ vì chưa render ETA |
| Integration web | 17/17; hai ca mới dùng panel/parser thật → Nest HTTP → PGlite RAM, Firebase và map mock |
| Browser | Customer/Admin × 390/1440px, dark/light, Leaflet/CARTO thật; Auth/HTTP fixture qua CDP; không ghi dữ liệu Cloud |
| `npm run check` | Đạt: lint, typecheck, test và build; 198 Worker/shared/load, 2 health, 487 API, 635 web; 137 test cần môi trường riêng bị bỏ qua |

Integration kiểm trước/sau pickup, ETA từ response, stale >30s, missing,
distance/seconds=0, giữ deadline, deliver/fail ẩn ETA và Customer khác 403.
`CONFIG_INVALID` kiểm bằng mock vì backend hiện chưa có config tốc độ để đổi
trong fixture. Unit kiểm mốc 30s và 31s trong lúc request chưa xong.

Gate đầu phiên sau sửa import đã đạt (198 Worker/shared/load, 2 health,
487 API, 621 web; 137 test cần môi trường riêng bị bỏ qua). Lượt gate sau
implementation chạy cùng browser bị timeout 5s ở GPS HTTP và ECONNRESET ở ca
kế tiếp; bộ GPS HTTP chạy riêng đạt 33/33, không thay code/ngưỡng backend.
Gate cuối chạy tuần tự sau khi đóng browser đã đạt toàn repo với số lượng ở
bảng trên. Các test PostgreSQL thật/Firebase emulator bị bỏ qua do chưa có
môi trường tương ứng; không coi đây là nghiệm thu Cloud.

[Kết quả browser](../evidence/tracking-eta-week10/browser.json): bốn lượt
đạt, không runtime exception/tràn ngang, số liệu và null reasons đúng, map
không remount khi stale và polling dừng khi terminal. Đã mở ảnh đối chiếu.

| Màn hình | Dark | Light |
| --- | --- | --- |
| Customer 390px | [Ảnh](../evidence/tracking-eta-week10/customer-390-eta.webp) | [Ảnh](../evidence/tracking-eta-week10/customer-390-light.webp) |
| Customer 1440px | [Ảnh](../evidence/tracking-eta-week10/customer-1440-eta.webp) | [Ảnh](../evidence/tracking-eta-week10/customer-1440-light.webp) |
| Admin 390px | [Ảnh](../evidence/tracking-eta-week10/admin-390-eta.webp) | [Ảnh](../evidence/tracking-eta-week10/admin-390-light.webp) |
| Admin 1440px | [Ảnh](../evidence/tracking-eta-week10/admin-1440-eta.webp) | [Ảnh](../evidence/tracking-eta-week10/admin-1440-light.webp) |

[GPS cũ](../evidence/tracking-eta-week10/customer-390-stale.webp) ·
[Thiếu GPS](../evidence/tracking-eta-week10/admin-1440-missing.webp).

## Còn mở

Chưa nghiệm thu ETA trên Hosting/Cloud thật. Sau khi TV2 hoàn thiện gom hàm
ETA và config vận tốc, khớp response nếu có thay đổi; TV5 deploy từ một SHA,
TV6 kiểm fresh/stale/null/terminal và quyền chéo, ghi revision. Không dùng
mock hoặc PGlite thay kết quả checkpoint Cloud.

Không sửa API contract, shared formula, Worker, Driver, SQL, Cloud, key,
AGENTS hoặc thay đổi env local đang có. Bundle chính vẫn cần theo dõi cảnh
báo kích thước hiện có, không tăng ngưỡng để che cảnh báo.

```powershell
npm.cmd test --workspace=@parcelflow/web -- ShipmentEta ShipmentTrackingPanel ShipmentTrackingJourney
npm.cmd run test:integration --workspace=@parcelflow/web
npm.cmd run check
git diff --check
```
