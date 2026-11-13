# Admin assignment — local acceptance and handoff

> B?o c?o l?ch s? theo ng?y v? source ghi b?n d??i. K?t qu? mock/local kh?ng x?c nh?n revision Cloud hi?n t?i; c?c script browser ri?ng kh?ng ???c ph?t h?nh c?ng t?i li?u.

Date: 2026-10-24. Base inspected: a2c245f trên feature/frontend (working changes,
chưa commit). Không thay AGENTS.md hoặc source backend/Worker/Driver/Customer.

Trạng thái mới nhất: xem mục **Tích hợp tuần lịch 6 — 02/11/2026** ở cuối file.
Các nhận định backend còn thiếu bên dưới chỉ áp dụng snapshot lịch sử được ghi ngày.

## Results

| Check | Observed result |
| --- | --- |
| npm run lint tại apps/web | PASS, không error/warning |
| npm run build tại apps/web | PASS TypeScript + Vite; 208 modules; JS640.74kB, còn cảnh báo chunk>500kB sẵn có |
| npm test tại apps/web | 223 PASS / 20 files, gồm 30 contract API tests và 17 assignment UI tests |
| TV6 existing provider tests | 61 PASS / 2 files: admin-directory.spec.ts và admin-list-query.spec.ts; local mock Firebase/SQL, không Cloud SQL thật |
| Browser CDP dev localhost | PASS 375x812,1440x900,812x375 cho Shipments/Drivers/Assignment, không document overflow |
| Browser actions | 5 POST được intercept và trả mock, không gửi backend thật; body chỉ driverId; confirmation,409/503 GET-only recovery đạt |
| Browser accessibility | Review focus/cancel focus/Enter, reduced-motion, text scale200%, CUSTOMER bị access denied theo ProtectedRoute hiện có; 0 runtime exceptions |
| git diff --check | PASS ở lượt kiểm tra |
| AGENTS.md SHA256 | Giữ nguyên 1FBB04859CFCCDBEAAB94F01755BEAB0443C279044B6A7C609C8C47B27FD65E6 |

Browser harness: [t?i li?u chung](../README.md). Auth và responses mock chỉ
được CDP inject vào tab test; production app vẫn dùng Auth/API thật, không fallback.
Ảnh kiểm tra được ghi vào temp, không thêm asset/test dependency vào app.
Hai lần harness đầu cần sửa React CJS import và giả định redirect role; không sửa
Auth/ProtectedRoute để làm test qua. Enter dùng sự kiện keyDown/char/keyUp Chromium.

## External acceptance still open — T017 / SC006

API11 TV6 có handler/test ở code local. API02/03/04 TV1 trong base chưa có handler:
ShipmentsController rỗng, AssignmentsController/Service cũng rỗng. Không có bằng chứng
backend hiện deploy tương ứng bản này hoặc dữ liệu ADMIN/DRIVER/SQL sẵn sàng.

Frontend có thể tiếp tục hoàn thiện/test độc lập; không sửa backend hoặc tự gửi
Assign cloud để thay thành viên khác. Chưa đánh dấu toàn bộ tuần 3 hoàn thành.
Khi TV1/TV5 bàn giao backend, phối hợp TV6/TV4: Admin list→Detail→Assign/reassign,
Driver thấy đúng đơn; kiểm 409/no-op/mất response trên fixture được nhóm cho phép,
ghi source/revision và kết quả thật. Race với Pickup thuộc tuần 4 theo VII.4.

## Re-run

Từ root: npm run lint:web; npm run build:web;
npm run test --workspace=@parcelflow/web.
Từ apps/api: npm test -- --run src/modules/admin/admin-directory.spec.ts src/modules/admin/dto/admin-list-query.spec.ts.
Browser: Vite dev localhost5174 và Edge CDP localhost9232 với profile test riêng;
node --experimental-strip-types specs/001-admin-assignment/verify-browser.mjs.
Harness chỉ nhận localhost và không dùng Firebase/credentials thật.

## Kiểm tra lại sau tích hợp — 2026-10-30

Đã merge `origin/develop` tại `9ee7c10` vào nhánh đang làm việc; merge commit
`6d75d53`, không có xung đột. Phạm vi được xác nhận lại là frontend; không bổ sung
API, migration hoặc deploy. Không có lỗi frontend mới cần sửa trong phạm vi
đã kiểm tra; giữ implementation hiện có, không tạo lại giao diện phân công.

| Kiểm tra | Kết quả / giới hạn |
| --- | --- |
| Test Admin và contract Shipment/Driver | 57/57 đạt, 4 file; API mock |
| Toàn bộ frontend | 351/351 đạt, 27 file; kiểm tra local |
| `npm run lint:web` | Exit 0 |
| `npm run build:web` | Exit 0, gồm TypeScript; bundle chính 495.88 kB |
| Browser local | Shipments/Drivers/Assignment ở 375×812, 1440×900, 812×375 không tràn ngang; 5 POST mock, không gửi phân công thật |
| Recovery và accessibility | 409/503 chỉ GET lại; focus review/cancel/Enter, reduced motion, chữ 200%, chặn CUSTOMER; 0 runtime exceptions |
| File được bảo toàn | SHA256 AGENTS.md và thay đổi local `.env.example` không đổi |

Analyze kiểm tra lại 10 FR và 6 SC với tasks T001–T018: không có mâu thuẫn
nghiêm trọng hoặc yêu cầu frontend thiếu task. Checklist requirements 7/7 và
integration 10/10 giữ nguyên; đây là review chất lượng yêu cầu. Converge không
phát hiện việc frontend còn thiếu cần thêm task, không đổi tasks/checklist.
T017/SC006 tiếp tục mở: backend hiện có POST Create nhưng chưa có handler GET
danh sách/chi tiết hoặc Assign, nên kết quả mock không chứng minh phân công thật.

Lần test đầu trong sandbox bị `spawn EPERM` trước khi chạy; chạy lại với quyền
tạo tiến trình con thì đạt. Lần khởi động Vite qua script lồng không truyền đúng
tham số; chạy trực tiếp script workspace thì browser harness đạt. Không sửa
script, dependency hoặc Auth chỉ để vượt kiểm tra.

## Tích hợp tuần lịch 6 — 02/11/2026

Đã merge develop `4b6c56a` vào frontend tại `11c4b97`, gồm backend List/Detail/Assign
ở `7b5754f` và sửa timeout API client. Xung đột chỉ trong tài liệu; giữ link `docs`
và nội dung mới, không tạo lại `openspec/`. `.env.example`, AGENTS.md và constitution
được giữ nguyên; không thêm dependency, sửa nghiệp vụ backend hoặc giao diện.

| Kiểm tra | Kết quả / mức bằng chứng |
| --- | --- |
| `npm run test:integration --workspace=@parcelflow/web` | 8/8 đạt; build API, typecheck bộ integration, React UI → apiClient → HTTP Nest thật → SQL PGlite cô lập trong RAM |
| Toàn bộ frontend | 438/438 đạt, 34 file; regression local/mock |
| API Assign/Read và Admin directory/query | 95 đạt, 36 bỏ qua; 3 file; PGlite/HTTP và mock. 35 ca PostgreSQL không có URL test local, 1 ca chờ khóa không áp dụng PGlite |
| `npm run typecheck --workspace=@parcelflow/api` | Exit 0; gồm kiểu của test API |
| Build frontend và API | Exit 0; bundle frontend chính 491.79 kB |

Bộ integration ở `apps/web/integration/`, tách khỏi test nhanh và bundle production.
Nest/PGlite chạy trong worker Node riêng; schema mới nằm trong RAM, không kết nối
database nhóm, không đọc `.env`. Firebase provider và hộp chọn địa chỉ là fixture;
panel tracking ngoài phạm vi tuần lịch 6, không dùng bộ này nghiệm thu GPS.

Các luồng đã kiểm tra:

- Customer nhập form, tạo đúng một đơn, dùng link xem lại chi tiết/danh sách;
  Admin mở cùng mã từ danh sách → chi tiết → phân công.
- Admin gán/gán lại, cùng tài xế không gửi thêm POST; lịch sử và thông báo lưu
  đúng. Customer đọc lại thấy cập nhật; backend từ chối Driver cũ/Customer khác.
- Hai lần bấm xác nhận chỉ một POST. Lỗi SQL trả 503 và rollback; mất response
  sau commit chỉ GET để đối chiếu, không tạo thêm sự kiện hoặc gửi lại Assign.
- GET đối chiếu lỗi giữ khóa ghi; nút đọc lại chỉ gửi GET. Trạng thái đã pickup
  trong fixture trả 409 thật, UI cập nhật và khóa phân công. Không có API Pickup
  mới; chỉ test fixture tạo trạng thái cạnh tranh để kiểm tra recovery.
- Cả Customer/Admin dùng cursor server, tìm mã chính xác và về trang đầu khi
  đổi bộ lọc. Không dùng dữ liệu mẫu hoặc sửa parser để chấp nhận response sai.

Chưa đăng nhập Firebase thật, kiểm tra lại browser trực quan hoặc triển khai
Cloud trong lượt này. Không đo p95, kiểm tra khóa PostgreSQL nhiều kết nối hay
pipeline GPS. T017/SC006 và nghiệm thu Cloud tuần lịch 6 còn mở: nhóm cần deploy
backend mới, cấu hình Firebase/CORS/SQL và dùng tài khoản/mapping được cấp để thử
Customer tạo/xem, Admin gán/gán lại, Driver thấy đúng đơn trên cùng revision.
Không chạy file tạo schema rỗng lên database đang có dữ liệu.

Từ gốc repo:

```powershell
npm run test:integration --workspace=@parcelflow/web
npm run test --workspace=@parcelflow/web
npm run lint:web
npm run build:web
npm run typecheck --workspace=@parcelflow/api
npm run test --workspace=@parcelflow/api -- src/modules/assignments/assignments.postgres.spec.ts src/modules/admin/admin-directory.spec.ts src/modules/admin/dto/admin-list-query.spec.ts
```

## Sửa lỗi so sánh enum sau deploy — 02/11/2026

Cloud đã có endpoint nhưng đọc đơn trả 503. Kiểm tra SQL bằng user backend có
SELECT hai bảng cho thấy lỗi `operator does not exist: shipment_action = shipment_status`.
Người dùng cho phép sửa tối thiểu query backend và test, giữ API/nghiệp vụ/database.

Projection chung so sánh action/toStatus/status qua nhãn `::text`; bộ lọc danh
sách cũng so sánh status với tham số text theo cùng kiểu. Không đổi enum, bảng,
quyền hoặc dữ liệu. Hai vị trí này được List/Detail/Assign dùng lại.

Bộ test trước chỉ tạo cột text nên không bắt được khác biệt schema Cloud.
Đã thêm biến thể PGlite dùng hai enum riêng, xác nhận kiểu qua information_schema,
chạy nguyên bộ đọc/phân công/phân quyền/lịch sử/phân trang/giao trễ trên cả hai schema.
Ba ca tập trung thất bại trước sửa; sửa projection giúp Assign/Detail đạt nhưng
hai ca List/filter vẫn thất bại; sau sửa filter toàn matrix đạt.

- Matrix đọc/phân công: 68 đạt, 37 bỏ qua (35 PostgreSQL chưa có URL test riêng,
  2 ca chờ khóa không áp dụng PGlite).
- Toàn API: 364 đạt, 80 bỏ qua; 23 file đạt, 2 file bỏ qua. Các ca có điều kiện
  PostgreSQL/Firebase Emulator không được coi là đã kiểm chứng.
- UI → Nest → SQL cô lập: 8/8 đạt; build API và typecheck bộ integration đạt.
- Typecheck API, lint ba file sửa và diff check đạt.

Chạy lại: `npm run test --workspace=@parcelflow/api -- src/modules/assignments/assignments.postgres.spec.ts`.
Bản sửa chưa deploy trong lượt này. Cần triển khai backend chứa hai thay đổi
query rồi kiểm tra GET List/Detail và Assign với tài khoản thật trên cùng
revision. Không chạy migration hoặc đổi enum để áp dụng bản sửa. Hiệu năng
Cloud chưa được đo lại; gate nghiệm thu thật T017/T026 vẫn mở.
