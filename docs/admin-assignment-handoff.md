# Admin assignment — local acceptance and handoff

> B?o c?o l?ch s? theo ng?y v? source ghi b?n d??i. K?t qu? mock/local kh?ng x?c nh?n revision Cloud hi?n t?i; c?c script browser ri?ng kh?ng ???c ph?t h?nh c?ng t?i li?u.

Date: 2026-10-24. Base inspected: a2c245f trên feature/frontend (working changes,
chưa commit). Không thay AGENTS.md hoặc source backend/Worker/Driver/Customer.

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

Browser harness: [t?i li?u chung](README.md). Auth và responses mock chỉ
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
