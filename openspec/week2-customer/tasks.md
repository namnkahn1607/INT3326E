# Tasks: Customer tuần 2

Input: spec/plan/research/data-model/contracts; tests bắt buộc theo FR-009.

## Phase 1: Setup
- [x] T001 Cài ba skill cá nhân, bảo toàn index và ci theo apps/web/package-lock.json; ghi kết quả ở acceptance.md (FR-008/009).
- [x] T002 Rà nguồn và Auth/backend hiện có trong research.md; xác nhận không trùng Auth (FR-001/009).

## Phase 2: Foundation
- [x] T003 Viết test token/headers/status/code/body/abort ở apps/web/src/api/client.spec.ts trước code (FR-004/007).
- [x] T004 Thêm structured error/timeout/abort giữ signature Auth ở apps/web/src/api/client.ts (FR-004/007).
- [x] T005 Viết test SC01/02/03/Idempotency-Key ở apps/web/src/api/endpoints/shipments.spec.ts trước code (FR-002/003/005/006).
- [x] T006 Thêm canonical wire/parser apps/web/src/types/shipment-api.ts và API01–03 apps/web/src/api/endpoints/shipments.ts; giữ legacy UI type (FR-002/003/005/006).

## Phase 3: US1 — Login (P1)
Independent: Auth/ProtectedRoute tests ba role, signed-out và refresh.
- [x] T007 [US1] Chạy regression apps/web/src/features/auth/*.spec.ts(x), polish LoginPage.tsx/auth.css không thay Auth nghiệp vụ (FR-001/008, SC-001).

## Phase 4: US2 — Create (P1)
Independent: submit/retry/success/error với contract mock, không cloud claim.
- [x] T008 [US2] Viết test form validation/zero/trim và intent retry/deadline/double-submit trong apps/web/src/features/customer/CustomerCreatePage.spec.tsx và shipment-form.spec.ts trước code (FR-002/003/004).
- [x] T009 [US2] Triển khai apps/web/src/features/customer/shipment-form.ts: address 5..255, name 2..100, phone +?9..15 digits, finite lat -90..90/lng -180..180, notes/description≤500, weight>0, deadline future; retry giữ payload/key≤24h (FR-002/003).
- [x] T010 [US2] Nối form Create/loading/error/trackingNumber/focus lỗi và RAM intent trong apps/web/src/features/customer/CustomerCreatePage.tsx (FR-002/003/004/007/008, SC-002).

## Phase 5: US3 — List/Detail (P2)
Independent: direct detail/refresh, empty/error/pagination, stale-result cleanup.
- [x] T011 [US3] Viết test state/query/cleanup trong apps/web/src/features/customer/CustomerShipmentsPage.spec.tsx trước code (FR-005/006/007).
- [x] T012 [US3] Nối list/filters/cursor ở CustomerShipmentsPage.tsx, detail ở CustomerShipmentDetailPage.tsx và route trong apps/web/src/App.tsx (FR-005/006/007, SC-003).

## Phase 6: Polish/Verification
- [x] T013 CSS scoped apps/web/src/features/customer/customer-api.css; UI review/keyboard/responsive/reduced motion theo FR-008; ghi evidence acceptance.md (SC-004).
- [x] T014 Chạy lint/build/test web, đối chiếu quickstart.md và ghi mock/local/cloud riêng ở acceptance.md (FR-009).
- [x] T015 Cập nhật tuần 2 trong openspec/frontend-tasks.md và docs bàn giao acceptance.md; giữ ghi nhận tuần 1 (FR-009).
- [ ] T016 Nghiệm thu cloud TC01.1/4/6, AC10 với TV1/5/6 và ghi SHA/revision/SQL/account evidence tại acceptance.md; không deploy/cấp quyền tự động (FR-009, SC-001/002).

## Dependencies / strategy
T001–002 → T003–006 → US1 → US2 → US3 → T013–016.
Tests trước code; Auth reuse là MVP đầu, rồi Create, List/Detail. T016 phụ thuộc bên ngoài,
không chặn xây client/test mock nhưng chặn tuyên bố tuần 2 hoàn thành.
Không task [P] triển khai cùng file. Có thể chạy lint/build và test độc lập sau code.
Không commit/push/deploy theo mặc định template; tuân theo AGENTS.

## Phase 7: Convergence

- [ ] T017 Xác nhận bàn giao API01–03 đã chạy từ TV1, Firebase/API config từ TV5 và tài khoản đã provision/linkage từ TV6; ghi readiness tại openspec/week2-customer/acceptance.md trước T016 theo FR-009/SC-001/SC-002 và plan: Verification (partial — HIGH, thiếu đầu vào môi trường thật; không tự cấp quyền/deploy).

## Phase 8: Home visual update theo prompt JSON

- [x] T018 [US3] Thiết kế Home cam/trắng theo FR-010 trong apps/web/src/features/customer/CustomerOverviewPage.tsx, CustomerHomeHeader.tsx, CustomerHomeIcon.tsx, customer-home.css và apps/web/src/layouts/CustomerLayout.tsx; giữ layout route khác.
- [x] T019 [US3] Nối tìm mã exact vào API02 qua apps/web/src/api/endpoints/shipments.ts và CustomerShipmentsPage.tsx; Active card đọc dữ liệu thật có cleanup/empty/error, không thêm state/provider (FR-010).
- [x] T020 [US3] Thêm apps/web/src/features/customer/CustomerOverviewPage.spec.tsx và regression search, kiểm tra browser mock/visual 390/768/1280/1440px bằng openspec/week2-customer/verify-browser.mjs (FR-010).
