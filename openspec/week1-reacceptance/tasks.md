# Tasks: Nghiệm thu lại frontend tuần 1

**Input**: spec.md, plan.md và các artifact trong folder này.
**Tests**: Người dùng yêu cầu nghiệm thu; chạy kiểm tra thực tế và ghi bằng chứng.
Các tick cũ ở frontend-tasks.md là lịch sử, không tự hoàn thành tasks lần này.

## Phase 1: Setup

- [x] T001 Ghi nguồn PF SPEC 01 v1.3 và thứ tự ưu tiên vào docs/spec-baseline.md theo FR-001; không sao chép spec thành nguồn mới.

## Phase 2: Foundational

- [x] T002 Đối chiếu app/package/role/state và source SHA của apps/web/src/App.tsx, package.json; ghi ranh giới bảo toàn vào openspec/week1-reacceptance/acceptance.md theo FR-002/FR-005.

## Phase 3: US1 — Ba cổng và Hosting (P1)

**Independent test**: Một app lint/build được; ba cổng mở trực tiếp/tải lại trên Hosting,
asset được đối chiếu; mobile/desktop và control chính có thể thao tác bằng bàn phím.

- [x] T003 [US1] Chạy lint/build từ apps/web/package.json và ghi actual vào openspec/week1-reacceptance/acceptance.md theo FR-002/FR-003.
- [x] T004 [US1] Kiểm tra HTTP/asset/hash, browser direct/refresh, 390x844/1280x900 và keyboard theo apps/web/firebase.json; ghi vào openspec/week1-reacceptance/acceptance.md theo FR-003/FR-006, SC-001.

## Phase 4: US2 — Emitter mẫu phối hợp TV4 (P2)

**Independent test**: Hai mẫu liên tiếp, Stop/Restart, không timer trùng hoặc GPS request/quyền;
rời trang trong SPA dọn timer. Không sửa payload tuần 1 thành EVT01 production.

- [x] T005 [US2] Thực thi hành vi apps/web/src/features/driver/GpsEmitter.tsx trên bản công khai, ghi expected/actual vào openspec/week1-reacceptance/acceptance.md theo FR-004, SC-002.

## Phase 5: US3 — Hồ sơ, regression và ranh giới (P2)

**Independent test**: Báo cáo truy vết nguồn/FR/environment/actual; task tài liệu không được
coi là Auth/Create/GPS đã live hoặc nhận thay implementation của thành viên khác.

- [x] T006 [P] [US3] Chạy typecheck/build/test của apps/api/package.json và root package.json cho Worker; ghi actual vào openspec/week1-reacceptance/acceptance.md theo FR-005/FR-007.
- [x] T007 [US3] Kiểm tra public local liveness từ apps/api/src/health/health.controller.ts và apps/worker/src/health/health.controller.ts với cổng tạm; ghi vào openspec/week1-reacceptance/acceptance.md theo FR-007; không gọi API mutation.
- [x] T008 [P] [US3] Đối chiếu issue #8/#9/#10, GET cloud health có/không slash và ghi nguồn lịch sử/quan sát vào openspec/week1-reacceptance/acceptance.md theo FR-007; không chạy lại Hello World.
- [x] T009 [US3] Đồng bộ nguồn/path/phạm vi trong openspec/frontend-proposal.md, frontend-spec.md, frontend-design.md, frontend-tasks.md và driver-gps-emitter-draft.md; dẫn từ README.md, sửa contract thành /v1/locations theo FR-008/SC-004.
- [x] T010 [US3] Lập ma trận FR-001–008, SC-001–005 và kết luận TV3/checkpoint chung trong openspec/week1-reacceptance/acceptance.md theo FR-007, SC-003.
- [x] T011 [US3] Ghi phụ thuộc TV1/2/4/5/6 và readiness tuần 2 trong openspec/week1-reacceptance/acceptance.md theo SC-005; không thực thi Auth/Create/migration hoặc auto merge.

## Phase 6: Polish

- [x] T012 Kiểm tra diff/Markdown links/checklist/task coverage của openspec/week1-reacceptance/ và tài liệu cập nhật; xác nhận không đổi runtime/lockfile/constitution, không commit/push/deploy theo FR-005/FR-008.

## Dependencies & Execution Order

T001 → T002 → T003/T004; T005 dùng build/bản công khai của US1.
T006 và T008 có thể kiểm tra song song khác component nhưng chỉ một người ghi acceptance.md;
T007 sau build; T009 sau đối chiếu nguồn; T010 sau kết quả kiểm tra và T009;
T011 sau source review; T012 cuối cùng. T003 và T006 được chạy lệnh song song nếu đủ tài nguyên,
không suy ra cần phân công thêm agent.

## Implementation Strategy

MVP là US1. Bổ sung US2 và US3 bằng kiểm tra/bằng chứng, chỉ sửa gap trong phạm vi tuần 1.
Không tạo app, feature nghiệp vụ hoặc resource mới để nghiệm thu. Nếu cần việc ngoài quyền,
ghi giới hạn/owner; không đánh dấu sản phẩm đủ nghiệp vụ. Converge chỉ bổ sung task audit còn thiếu.
