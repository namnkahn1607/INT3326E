# Tasks: Admin assignment — TV3 tuần 3

Input: [spec](spec.md), [plan](plan.md), [contract](contracts/admin.md).
Không sửa AGENTS.md, không backend writes/deploy; tasks hoàn thành phải có bằng chứng.

## Phase 1 — Setup

- [x] T001 Rà code thành viên/nguồn/phạm vi và ghi dependency trong specs/001-admin-assignment/research.md (FR010).
- [x] T002 Tạo/review artifact và checklist specs/001-admin-assignment/checklists/integration.md trước implement (FR001–010).

## Phase 2 — Foundation

- [x] T003 Viết contract tests API11/Assign trong apps/web/src/api/endpoints/drivers.spec.ts và shipments.spec.ts (FR002–005).
- [x] T004 Thêm DriverResponse/DriverPage và parser/helper trong apps/web/src/types/driver-api.ts, api/endpoints/drivers.ts; activeShipmentCount nguyên không âm, GPS/timestamps/stale cùng null khi missing, 0,0 hợp lệ; metadata không giả online (FR003).
- [x] T005 Thêm assign helper additive trong apps/web/src/api/endpoints/shipments.ts: body chỉ driverId, 200, đúng id/driver và ASSIGNED; không tự retry (FR005).
- [x] T006 Tạo hook cursor/abort/ignore stale và feedback/pager trong apps/web/src/features/admin/useAdminPage.ts và AdminPageFeedback.tsx; limit20/max100, không total (FR002/003/007/008).

## Phase 3 — US1: dữ liệu thật

Independent test: list/empty/error/pagination/filter không dùng mock fallback.

- [x] T007 [US1] Thay mock list/filter bằng server query trong apps/web/src/features/admin/AdminShipmentsPage.tsx; trạng thái/mã exact, links shipmentId (FR002).
- [x] T008 [P] [US1] Nối API11 vào apps/web/src/features/admin/AdminDriversPage.tsx; chỉ đếm trang hiện hành, không giả phone/vehicle/online (FR003).
- [x] T009 [US1] Cập nhật apps/web/src/features/admin/AdminUi.spec.tsx test dữ liệu thật mô phỏng, lỗi, lọc, pagination, cleanup (FR001–003/008/009).

## Phase 4 — US2: phân công

Independent test: select → Detail → review → đúng một POST → server confirmation.

- [x] T010 [US2] Viết test success/reassign/no-op/terminal/double-submit trong apps/web/src/features/admin/AdminAssignmentPage.spec.tsx (FR004–005).
- [x] T011 [US2] Tạo apps/web/src/features/admin/AdminShipmentDetail.tsx hiển thị tracking/state/driver/address/history từ server, không fake actor/name (FR002/004).
- [x] T012 [US2] Nối selectors paginated, deep link và confirmation inline trong apps/web/src/features/admin/AdminAssignmentPage.tsx (FR003–005).

## Phase 5 — US3: recovery

Independent test: lỗi POST chỉ GET lại, GET lỗi giữ khóa, cần xác nhận ý định mới.

- [x] T013 [US3] Bổ sung test 409/timeout/network/5xx/malformed response/GET failure/stale selection trong apps/web/src/features/admin/AdminAssignmentPage.spec.tsx (FR006/008).
- [x] T014 [US3] Implement reconciliation và field locking/no automatic retry trong apps/web/src/features/admin/AdminAssignmentPage.tsx (FR005/006/008).

## Phase 6 — polish and validation

- [x] T015 Giữ DemoNotice theo route trong apps/web/src/layouts/AdminLayout.tsx, thêm responsive/focus/feedback trong features/admin/admin-api.css (FR007/009).
- [x] T016 Chạy lint/build/full frontend tests và targeted API directory tests; browser mock375/1440/direct route/keyboard nếu môi trường có; ghi specs/001-admin-assignment/acceptance.md và so SHA256 AGENTS.md (SC001–005).
- [ ] T017 Nghiệm thu tích hợp Admin→API→DB và Driver thấy đơn với TV1/TV4/TV5/TV6; chỉ ghi kết quả thật trong specs/001-admin-assignment/acceptance.md (SC006, phụ thuộc ngoài FE).

## Dependencies and strategy

T001→T002→T003→T004/T005→T006. US1 T007/T008→T009 (có thể làm độc lập sau foundation).
US2 T010→T011→T012, US3 T013→T014 sau US2; T015→T016→T017.
Parallel opportunities chỉ là các file độc lập (T007/T008), không bắt buộc dùng agent.
MVP US1 read-only trước; tiếp US2/US3 luôn cùng nhau trước bàn giao mutation.
Không triển khai sớm backend để vượt T017.

## Phase 7: Convergence

- [x] T018 Bổ sung regression phản hồi Detail cũ sau đổi đơn và hủy request khi rời editor trong apps/web/src/features/admin/AdminAssignmentPage.spec.tsx; kiểm chứng trạng thái/cleanup đúng FR008 và plan §Design (partial verification).
