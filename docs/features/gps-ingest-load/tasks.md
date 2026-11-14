# Tasks GPS ingest k6

- [x] K801 — L1–L6: spec/clarify/plan, review checklist riêng và analyze.
  Bằng chứng: spec/plan và review LC01–LC04 trước implement, baseline check đạt.
- [x] K802 — L1–L4: script k6, validation và response checks; test module thuần.
  Bằng chứng: gps-ingest-config.spec.ts 44/44; k6 thật xác nhận script chạy.
- [x] K803 — L5/L6: hướng dẫn và chạy thử k6 thật với Nest HTTP local; kiểm
  mapping hai Driver và các đường FAIL, lưu bằng chứng đã bỏ token.
  Bằng chứng: infra/load/README.md, docs/evidence/gps-ingest-load/report.json;
  k6 v2.4.0, 6/6 accepted (2 Driver × 3 mẫu), 4 đường âm thất bại đúng lý do.
  Firebase/lookup/PubSub mock; không Worker/SQL/Cloud; token fixture đã xóa.
- [x] K804 — L1–L6: check toàn repo, review/converge và cập nhật bàn giao/trạng thái.
  Bằng chứng: `npm.cmd run check` exit 0 (Worker/shared/load 166, API 454,
  web 538, health e2e 2; 116 ca PostgreSQL/Firebase emulator bị bỏ qua).
  SHA-256 cả ba source script khớp report, fixture token đã xóa, diff check đạt.
  Review/converge chỉ đọc không còn finding bắt buộc trong L1–L6; không dùng
  local mock đóng checkpoint Cloud. Lượt triển khai chưa commit/push; sau bàn
  giao người dùng yêu cầu commit/push nhánh. Chưa merge hoặc deploy.
