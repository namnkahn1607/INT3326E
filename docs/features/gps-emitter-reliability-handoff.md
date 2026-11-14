# Bàn giao GPS emitter tuần 8

Ngày 15/11/2026; nhánh `feature/gps-emitter-reliability`, base `develop@f28365d`.
Working tree sạch trước triển khai. Lượt triển khai chưa commit/push; sau bàn
giao, người dùng yêu cầu commit và push nhánh này. Chưa merge hoặc deploy.
Nguồn và yêu cầu E1–E6 nằm trong [bộ spec Driver GPS](driver-gps/spec.md).
Lượt này chỉ hoàn thiện emitter; k6 và checkpoint Cloud vẫn là đầu việc riêng.

## Hành vi

- Bỏ riêng mẫu sai tọa độ/thời gian, accuracy không hữu hạn hoặc ngoài 0–100 m,
  mẫu mới lấy quá 30 giây, tương lai quá 60 giây, timestamp trùng/lùi. Không
  tăng seq; báo lý do và tiếp tục lấy mẫu. Permission/timeout vẫn dừng.
- Buffer RAM FIFO tối đa 100 mẫu, gồm mẫu đang gửi; TTL 5 phút theo timestamp
  đo. Khi đầy bỏ mẫu chờ cũ nhất, giữ request đang gửi. Prune trước enqueue/replay.
  Đây là hằng số client được ghi rõ trước implement, không thay API/NFR.
- Offline giữ mẫu; online gửi bù. Network/timeout/429/5xx retry với backoff
  1/2/4/8/16/30 giây. Chỉ một request mỗi lúc; gửi bù giữ nguyên lat/lng/seq/
  clientTimestamp để Worker chống trùng. Không sửa timestamp cho có vẻ mới.
- Lỗi 400/404/422/response sai không retry. 401/403/USER_NOT_PROVISIONED xóa
  buffer và chặn gửi đến khi remount phiên; không thử các mẫu sau bằng quyền cũ.
- Stop tạm dừng phát/replay, cho request đã gửi hoàn tất; Start tiếp tục buffer
  còn hạn. Rời trang/đăng xuất/đổi tài khoản abort và xóa buffer/timer/listener,
  bỏ response muộn. Reload cũng mất buffer; không lưu vị trí vào localStorage.
- Token gắn mount của tài khoản sở hữu buffer; refresh cùng tài khoản cập nhật
  token mà không xóa mẫu. Adapter không lấy nhầm global token của tài khoản mới.
  Payload và quyền backend giữ nguyên; không gửi driverId/accuracy từ client.
- UI tách mẫu chờ, bị bỏ và 202 hợp lệ. Ghi rõ quyền vị trí, HTTPS/localhost,
  tab nền có thể throttle/tạm dừng; nhịp 8 giây không phải bảo đảm background GPS.

## Bằng chứng local

- Bộ chuyên biệt emitter/dashboard/queue/adapter: 113/113 đạt.
- Edge: 47/47 kịch bản đạt, gồm native Geolocation với vị trí giả lập, quyền,
  lọc mẫu sai/cũ/accuracy, offline thật của browser, replay, Stop/Start và đổi
  tài khoản. Auth và HTTP API trong harness được mock; không gửi lên Cloud.
- Layout 320/390/1440 px không tràn ngang; đã xem ảnh 320 px và buffer paused.
- Hồi quy token từng FAIL: adapter dùng token tài khoản toàn cục mới thay vì
  token chủ buffer. Sau sửa, test pin token, null token và refresh đều đạt.
  Stop cùng lượt HTTP resolve cũng được kiểm tra, không cần thay cơ chế React.
- `npm.cmd run check`: exit 0; lint/typecheck/build API/Worker/web đạt. Worker/
  shared 122 đạt, health e2e 2 đạt, API 454 đạt, web 584 đạt. Có 116 ca
  PostgreSQL/Firebase emulator bỏ qua vì chưa cấu hình môi trường, không coi
  là đã kiểm PostgreSQL thật hoặc Cloud trong lượt này.
- Build web cảnh báo chunk chính 502.93 kB; browser harness có cảnh báo
  MODULE_TYPELESS_PACKAGE_JSON của shared type. Các lệnh vẫn exit 0.
- `git diff --check`: exit 0. Review/converge cuối không còn thiếu sót trong
  E1–E6; W707/W713 giữ nguyên để nghiệm thu môi trường thật.

[Báo cáo browser](../evidence/gps-emitter-reliability/report.json) ghi base SHA,
source SHA-256, trạng thái chưa commit và môi trường mock. Ảnh:
[buffer tạm dừng](../evidence/gps-emitter-reliability/buffer-paused.png),
[layout 390 px](../evidence/gps-emitter-reliability/layout-390.png).

## Chạy lại và việc còn mở

Từ gốc repo với Node >=22.12 và dependencies theo lockfile:

```powershell
npm.cmd test --workspace=@parcelflow/web -- src/features/driver/GpsEmitter.spec.tsx src/features/driver/DriverPlaceholderPage.spec.tsx src/features/driver/gps-delivery.spec.ts src/api/endpoints/locations.spec.ts
npm.cmd run check
$env:DRIVER_REVIEW_PLAYWRIGHT = 'C:\Users\_____\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
$env:DRIVER_REVIEW_OUTPUT = 'Z:\INT3326E\.vitest\gps-emitter-reliability-browser'
node --experimental-strip-types apps/web/scripts/verify-driver-dashboard.mjs
git diff --check
```

Harness dùng Edge headless và Vite loopback `127.0.0.1:5179`, không dùng phiên
đăng nhập của người dùng. Nếu có Playwright trong dependency repo thì không
cần biến `DRIVER_REVIEW_PLAYWRIGHT`. Node 26 cần thiết lập NODE_OPTIONS theo
AGENTS.md. Không in token trong báo cáo hoặc ảnh.

W707/W713 giữ mở cho Driver/Cloud thật, cần TV2/5/6 cung cấp deployment/config,
tài khoản liên kết và đối chiếu eventId API → Pub/Sub → Worker → SQL. HTTP 202
và replay local không đóng các mục này. Giới hạn buffer khi reload/rời trang
là chủ ý của E5, không cam kết lưu offline bền vững hoặc GPS khi trình duyệt đóng.
