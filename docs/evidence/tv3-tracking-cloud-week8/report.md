# Nghiệm thu hai bản sửa tracking Customer/Admin

Ngày 18/11/2026. Bản này thay báo cáo và ảnh nghiệm thu TV3 cũ theo yêu cầu.
Phạm vi: frontend, cấu hình build Hosting và kiểm chứng trước commit.
Nguồn: PF SPEC 01 v1.4, D03/D08, API09/SC05, UI01/UI03; không đổi API hoặc dữ liệu.

## Thay đổi

- Tracking thông báo khi status hoặc driverId thay đổi. Customer/Admin tải lại
  detail đúng quyền để cập nhật badge, lịch sử và ghi chú từ server.
- Trong lúc đối chiếu, detail cũ được thay bằng skeleton; form/action Admin bị
  khóa. Nếu tải lỗi thì hiện lỗi và nút thử lại, không giữ form theo trạng thái cũ.
- Không tải lại detail theo tọa độ GPS; không tự retry liên tục một state mismatch.
  Rời trang/đổi tài khoản hủy request và bỏ kết quả đến muộn.
- Bỏ key phụ thuộc status/driver của tracking để tránh dựng lại map mỗi lần
  đồng bộ detail; đơn terminal dừng tracking và ẩn vị trí như contract hiện có.
- Code đã hỗ trợ CARTO khi có VITE_CARTO_API_KEY. Hosting cũ gọi OSM và gặp
  ERR_CONNECTION_REFUSED; key local hiện có trả tile CARTO HTTP 200.
  Thêm predeploy build trong firebase.json để deploy luôn lấy bản build và
  cấu hình môi trường hiện tại thay vì dùng dist cũ. Không hardcode key.

## Kiểm tra đã chạy

| Kiểm tra | Kết quả và môi trường |
| --- | --- |
| npm run check | Exit 0: 166 Worker/shared/load, 2 health, 465 API, 589 web; lint/typecheck/build đạt. 125 ca PostgreSQL/Firebase emulator bỏ qua vì không có môi trường. |
| Test hồi quy chuyên biệt | 50/50: TrackingJourney, AdminShipmentDetailPage, ShipmentTrackingPanel, OsmBaseLayer. |
| npm run test:integration --workspace=@parcelflow/web | 12/12 UI → Nest → PGlite đạt; Firebase mock. |
| Lệnh predeploy build | npm run build --workspace=@parcelflow/web chạy từ apps/web đạt; không chạy lệnh deploy. |
| Chrome headless 390/1440px | 4/4 view Customer/Admin; Leaflet và tile CARTO thật, auth/API fixture chỉ trong trình duyệt test. Không gọi mutation nghiệp vụ. |
| Bản đồ | Tile tải thành công, attribution OSM/CARTO hiện đủ, không tràn ngang và giữ map instance khi chuyển ASSIGNED → PICKED_UP. |
| Đồng bộ | GPS đổi không tăng detail read; đổi trạng thái tải thêm đúng một detail; header và lịch sử cập nhật từ response, terminal hiện ghi chú giao hàng. |
| Kết thúc đơn | Không còn marker/action cũ; polling không tăng trong 5,5 giây sau terminal ở cả 4 view. |
| Lỗi và cleanup | Test giữ detail refresh pending/503 không cho thao tác cũ; rời route hủy request và bỏ response đến muộn. |

Kết quả trình duyệt: [browser.json](browser.json). Có 0 runtime exceptions.
Main bundle 516,66 kB còn cảnh báo >500 kB; không tăng ngưỡng.
Log check local: `%TEMP%/parcelflow-tracking-fix-check.log`.

## Ảnh bản sửa

| View | Nền bản đồ tải được | Lịch sử và terminal đồng bộ |
| --- | --- | --- |
| Customer 390px | [Ảnh](customer-390-map.webp) | [Ảnh](customer-390-terminal.webp) |
| Customer 1440px | [Ảnh](customer-1440-map.webp) | [Ảnh](customer-1440-terminal.webp) |
| Admin 390px | [Ảnh](admin-390-map.webp) | [Ảnh](admin-390-terminal.webp) |
| Admin 1440px | [Ảnh](admin-1440-map.webp) | [Ảnh](admin-1440-terminal.webp) |

Ảnh chụp viewport 390/1440 × 1000 CSS px, DPR 1. Auth và response shipment
là fixture; nền bản đồ lấy trực tiếp từ CARTO. Không dùng ảnh này làm bằng
chứng mới cho backend Cloud, SQL, Pub/Sub hoặc GPS thiết bị thật.

## Trạng thái bàn giao

Hai bản sửa đạt local trước commit. Người dùng giao deploy cho thành viên khác;
lượt deploy vừa yêu cầu đã hủy, không có tiến trình deploy còn chạy hoặc log
deploy mới tại máy này. Chưa nghiệm thu bản sửa trên Hosting.
Máy build/deploy phải có VITE_CARTO_API_KEY hợp lệ
trong apps/web/.env.local hoặc biến môi trường CI; key này đi vào bundle trình
duyệt, cần giới hạn domain theo nhà cung cấp. Không gửi/commit file môi trường.

Không sửa AGENTS.md, backend, Worker, schema hoặc cấu hình Cloud. Không suy ra
toàn bộ AC04/AC05/AC10 hay tuần 8 của nhóm đạt từ các test local.
