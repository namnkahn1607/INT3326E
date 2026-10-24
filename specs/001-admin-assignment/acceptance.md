# Admin assignment — local acceptance and handoff

Date: 2026-10-24. Base inspected: a2c245f trên feature/frontend (working changes,
chưa commit). Không thay AGENTS.md hoặc source backend/Worker/Driver/Customer.

## Spec Kit review

- Specify: tạo bộ riêng sau khi tìm các spec cũ, không ghi đè week1/week2.
- Clarify: 0 câu hỏi quan trọng còn thiếu; nguồn FR02/API04/UI03 đã giải quyết
  reassign, no-op, actor và mất response. Không giả lập quyết định người dùng.
- Plan: reuse một app, Auth/apiClient/Shipment parser và shell; không thêm deps.
- Checklist: tạo unchecked, sau đó review riêng theo AGENTS.md. Requirements7/7
  và integration10/10 đạt về chất lượng yêu cầu, không phải chứng minh code hoàn thành.
  Bằng chứng từng item đã trỏ tại checklist: scope/source, US1–3, FR001–010,
  SC001–006, plan/contracts. Implement không đổi marker checklist.
- Tasks: 17 task T001–T017, US1/US2/US3 và dependency rõ.
- Analyze read-only: 10 FR có task, SC001–006 có coverage T003–T017; không orphan
  task, không CRITICAL/HIGH về requirement, không thay constitution. SC006 là gate
  ngoài frontend. Không chạy extension hooks vì .specify/extensions.yml không có.
- Implement: test contract đỏ trước helper; 15 test Assign đỏ trước thay mock UI.

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

Browser harness: [verify-browser.mjs](verify-browser.mjs). Auth và responses mock chỉ
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

## Convergence review

Lượt 1 đối chiếu 10 FR, 6 SC, các acceptance scenario và 6 quyết định thiết kế:
không tìm gap behavior mới trong code đã implement; thấy thiếu regression cụ thể
cho Detail đến muộn/rời editor (FR008), thêm duy nhất T018 ở cuối tasks.md.
SC006 vẫn partial với task T017 đã có, không thêm task duplicate hoặc mở scope backend.

Implement tiếp T018: thêm 2 regression, full suite tăng từ221 lên223 pass;
lint/build chạy lại PASS. Code bỏ qua response cũ và abort request khi rời editor,
không phát lại POST hoặc cập nhật success trên editor đã unmount. Không đổi checklist
markers trong implement. Không có bằng chứng cloud để đóng T017.
