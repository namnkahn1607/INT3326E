# Tasks TV1 tuần 7

- [x] W7-TV1-T01 — R1–R5: Soạn bộ spec, clarify, plan, checklist và thực hiện review chất lượng yêu cầu + analyze trước khi viết code.
  Bằng chứng: `spec.md`, `plan.md`, `checklist.md` đã được review riêng ngày 08/11/2026.
- [x] W7-TV1-T02 — R1/R2/R3: Tạo parser DTO `driver-shipment-actions.dto.ts` cho `pickup` và `deliver` (kiểm tra body rỗng, `proofOfDeliveryNotes` trim $\le 255$ ký tự Unicode bằng `Array.from`, từ chối field lạ).
  Bằng chứng: `apps/api/src/modules/shipments/dto/driver-shipment-actions.dto.ts`; kiểm tra qua `npm run typecheck --workspace=@parcelflow/api` và `oxlint` (0 warnings, 0 errors).
- [x] W7-TV1-T03 — R1/R2/R3/R4: Triển khai transaction `pickup` (`API05`) và `deliver` (`API06`) trong `ShipmentsRepository`, `ShipmentsService` và `ShipmentsController` (khóa `FOR UPDATE OF s`, kiểm tra `driverId`, xử lý No-op, ghi `shipment_status_events` và `notifications` nguyên tử với tham số tách biệt cho `shipment_action` và `shipment_status`, rollback trả `503` khi lỗi).
  Bằng chứng: `apps/api/src/modules/shipments/{shipments.repository.ts,shipments.service.ts,shipments.controller.ts}`; build thành công với `npm run build --workspace=@parcelflow/api`.
- [x] W7-TV1-T04 — R1–R5: Bổ sung kiểm thử SQL/HTTP cho `TC03.1`, `TC03.2`, `TC03.3`, `TC02.5` (race condition Assign vs Pickup), `TC06.1` (đầy đủ chuỗi lịch sử `CREATED → ASSIGNED → REASSIGNED → PICKED_UP → DELIVERED` và phân trang keyset), rollback/lost-commit và tương thích adapter frontend.
  Bằng chứng: `npm run test --workspace=@parcelflow/api -- src/modules/assignments/assignments.postgres.spec.ts` đạt 96/96 ca (`pglite` text + `pglite-enums` PostgreSQL ENUMs), 51 ca skip (chờ `SHIPMENT_TEST_DATABASE_URL` cho PostgreSQL nhiều connection). Toàn bộ `npm run test --workspace=@parcelflow/api` đạt 446/446 ca (99 skip).
- [x] W7-TV1-T05 — R5: Cập nhật bài kiểm thử tích hợp `apps/web/integration/shipment-flow.spec.tsx` cho luồng Driver `list → detail → pickup → deliver` với handler thật, và đồng bộ `docs/openapi.json` + `docs/contracts/api-contract.md`.
  Bằng chứng: `npm run test:integration --workspace=@parcelflow/web` đạt 10/10 ca; `npm run test --workspace=@parcelflow/web` đạt 493/493 ca.
- [x] W7-TV1-T06 — R1–R5: Chạy toàn bộ typecheck, lint, build, unit/SQL/integration tests, thực hiện converge và lập báo cáo bàn giao.
  Bằng chứng: `npm run typecheck`, `npm run typecheck --workspace=@parcelflow/api`, `npm run build --workspace=@parcelflow/api`, `npx oxlint --type-aware ...` (0 warnings, 0 errors trên các file sửa), `git diff --check` sạch; tài liệu bàn giao tại `docs/features/shipment-pickup-deliver-handoff.md`.
- [ ] W7-TV1-T07 — Nghiệm thu luồng `Create → Assign → Pickup → Deliver` trên PostgreSQL nhiều connection (`SHIPMENT_TEST_DATABASE_URL`) và trên Cloud Run + Cloud SQL thật với tài khoản Firebase 3 role (chưa chạy trong phiên này vì chưa cấu hình `SHIPMENT_TEST_DATABASE_URL` và người dùng chưa yêu cầu deploy Cloud).
