# Bàn giao frontend Customer tuần 2 — 2026-10-18

> B?o c?o l?ch s? theo ng?y v? source ghi b?n d??i. K?t qu? mock/local kh?ng x?c nh?n revision Cloud hi?n t?i; c?c script browser ri?ng kh?ng ???c ph?t h?nh c?ng t?i li?u.

Branch `nh?nh tri?n khai Customer`, base `d38c598`; implementation hiện trong
working tree, chưa commit/push/deploy. Hồ sơ này không thay nguồn yêu cầu chính thức.

## Trạng thái

Đã triển khai **consumer frontend**, kiểm chứng local/mock. **Chưa hoàn thành nghiệm
thu tuần 2 trên cloud**. Backend shipment controller/service/DTO còn scaffold rỗng;
không dùng mock chứng minh Auth/SQL/transaction/idempotency server đã chạy.

## Đã làm

- Cài cá nhân ui-ux-pro-max, web-design-guidelines, design-motion-principles từ repo
  gốc bằng skill-installer; không đưa skill vào repo hoặc thêm runtime dependency.
- Reuse AuthProvider/ProtectedRoute/token reader của TV6. Chỉ polish Login UI,
  giữ ba role và route Admin; không đăng ký/cấp claim hoặc bypass Auth production.
- Client có ApiError status/code, lỗi validation, timeout 15s, abort, Headers chuẩn;
  giữ explicit token/null và profile JSON trực tiếp cho Auth. Không log raw errors/token.
- Customer Create canonical JSON, validation tọa độ/địa chỉ/người nhận/bưu kiện,
  key UUIDv4 và payload giữ nguyên khi retry; double-submit guard, khóa ý định khi
  kết quả chưa xác định, chặn retry quá window 24h. 400 cho sửa input, không auto retry.
- List có filter/cursor và empty/loading/error/retry, Detail tại
  /customer/shipments/:id lấy snapshot hiện hành. Runtime kiểm tra response,
  không fallback dữ liệu mẫu. GET cleanup/query/user isolation.
- UI tím, label/fieldset rõ, error summary/inline, focus lỗi, input 16px, control
  44px, skip link; reduced-motion. Không tự động geocode hoặc tracking/ETA giả.

## Bằng chứng kiểm chứng

| Kiểm tra | Kết quả / giới hạn |
| --- | --- |
| npm ci --workspaces=false (apps/web) | PASS, 313 packages; không đổi lockfile. npm báo 2 install scripts chưa approve (@firebase/util, protobufjs); không tự approve. |
| Test RED trước implementation | Client/contract 11 fail; form missing validator + 4 UI fail; list/detail missing module. Sau code kiểm tra lại GREEN. |
| Web Vitest | 78 tests / 8 files PASS ở lượt chốt; mock SDK/API, không Firebase thật. |
| npm run lint (apps/web) | PASS, không lỗi. |
| npm run build (apps/web) | PASS TypeScript/Vite; có cảnh báo chunk >500kB (~591kB JS), không phải lỗi build hoặc số đo NFR. |
| Browser Edge headless local | Harness verify-browser.mjs exit 0, 12 tổ hợp route/viewport 390/768/1280; direct/refresh đúng màn hình, scrollWidth≤viewport, input16px. |
| Browser keyboard/retry | Tab đến field tiếp theo; Enter submit invalid focus summary và không POST; 503→retry giữ key/body; thành công hiển thị mã; detail mới ASSIGNED khác create CREATED; Customer bị chặn Admin; reduced-motion và không JS exceptions. |
| Visual review | Đã xem screenshot Login desktop/Create mobile từ profile tạm, không ảnh/PII thật. |
| Git | Giữ nguyên 18 file đã stage; thay đổi tuần 2 chưa stage. Không sửa API/Worker/DB/package/lockfile/constitution. |

Browser mock intercept chỉ tồn tại trong harness CDP; không thêm cờ demo/bypass
vào ứng dụng. Lần đầu harness lỗi import React CJS, đã sửa harness; siết điều kiện
đợi đúng route/content sau reload rồi chạy lại toàn bộ. Không coi lượt lỗi là PASS.

## Phần còn mở / phối hợp

- **T016 — chưa đạt cloud**: TV1 cung cấp API01–03/DTO/mapping, transaction Create,
  snapshot idempotency/SQL; TV6 user linkage/claims/errors và notification nguyên tử;
  TV5 Firebase config, SQL/CORS/runtime và account đã provision. Không tự làm phần này.
- **T017 — readiness còn chặn**: cần nhóm bàn giao URL API có handler, Firebase Web
  config và xác nhận account/claim/business linkage. Không yêu cầu gửi password,
  ID token hoặc service-account key vào chat/repo.
- Cần test Firebase thật và TC01.1/01.4/01.6 với source SHA, revision, seed/migration
  và dữ liệu thử được phép; TV1/6 đối chiếu SQL không nhân đôi. Chưa yêu cầu deploy.
- NFR latency và chunk splitting chưa đo/tối ưu; build warning được giữ công khai,
  không tăng threshold để che cảnh báo.
- Các trang Overview/History/Notifications/Admin/Driver ngoài lát cắt vẫn có scaffold/
  dữ liệu mẫu; không tuyên bố toàn frontend đã nối thật.
- Draft/intent ở RAM màn hình; rời route/reload mất. Sau kết quả không rõ phải đối
  chiếu trước tạo ý định khác, không tự retry sau 24h.

## Chạy lại

Theo [quickstart.md](customer-frontend.md). Dùng npm run dev:web để xem; không có Firebase
config thì Login báo thiếu cấu hình, không có demo login thay thế.
Browser mock cần Node24, Edge headless profile tạm/cổng CDP9232 và Vite local5174,
chạy node specs/week2-customer/verify-browser.mjs; không trỏ vào Hosting/cloud.

## Home bổ sung theo prompt JSON

Xem [home-design.md](customer-frontend.md) cho yêu cầu/giới hạn và prompt asset.
Home đổi sang cam/trắng riêng theo yêu cầu mới, không đổi Auth/Admin/Driver hoặc
theme những màn hình Customer khác. Thêm T018–020; T016/017 giữ mở như cũ.
Lượt kiểm chứng Home: **85 tests / 9 files PASS**, lint/build PASS; WebP 138.51kB
thay PNG1.71MB trong bundle. Browser local/mock **5 route × 4 viewport**
(390/768/1280/1440), direct/refresh/search exact/Tab/Enter/retry/cleanup/reduced motion
đạt, không JS exception. Đã xem screenshot1440/390 và sửa các màu chữ muted có
contrast thấp, tăng input tra cứu lên16px. Không suy ra Firebase/SQL/cloud đã chạy.
Asset PNG gốc và WebP giữ trong repo, ảnh preview chỉ ở temp. Không thay lockfile.
