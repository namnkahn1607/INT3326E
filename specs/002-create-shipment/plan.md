# Implementation Plan: Create Shipment

**Development context**: Nhánh thử nghiệm tạo đơn | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

## Summary

Implement POST Create trong module shipment hiện có; DTO parse/normalize, service sinh hash và orchestration, repository PostgreSQL một client/transaction. Dùng Auth/business guard và pool TV6, không thêm frontend hay business endpoint khác.

## Technical Context

- TypeScript ~5.7.3, Node >=20.12, NestJS11, pg8.23.1, Vitest3 theo package/lock của apps/api.
- Storage PostgreSQL; SQL baseline mới trong packages/database chỉ cho schema trống, không auto-run và không tác động DB chung. Giữ Prisma draft/GPS không liên quan, đánh dấu baseline SQL là mapping Create hiện thực.
- Test DTO/service/NestHTTP với Firebase mock; SQL thật bằng PGlite PostgreSQL WASM dev-only nếu Docker chưa chạy, bổ sung cùng suite PostgreSQL nhiều connection opt-in với DB loopback riêng để chứng minh race đa connection.
- Nền tảng Cloud Run giữ nguyên; p95<500ms là target chưa đo cloud. Không log body/token/SQL.
- Config SHIPMENT_IDEMPOTENCY_TTL_SECONDS mặc định86400, integer1..31536000; cấu hình sai fail startup, không âm thầm bỏ chống trùng.

## Constitution Check

- I/II: stack giữ nguyên, chỉ dependency test nếu cần; controller/service/repository/DTO tách rõ. Pass.
- III/IV: API01/SC02/D07/D09 được nguồn mới chốt, mapping DATA02 rõ; không sửa Auth/GPS/frontend/AGENTS. Pass.
- V: unit/HTTP/SQL và consumer regression; phân biệt PGlite, PostgreSQL đa connection, cloud. Pass trước/sau thiết kế.
- Quy trình nhánh: nhánh test từ feature/frontend 915e5ed đã có develop a2c245f để giữ FE tích hợp; ngoại lệ test-only theo yêu cầu user, chưa merge develop/deploy. Không sửa constitution.
- Migration: chỉ viết/test isolated schema, owner TV1/TV6 phải kiểm tra DB dùng chung trước áp; không coi draft Prisma là schema cloud thực tế.

## Project Structure

```text
apps/api/src/modules/shipments/
  shipments.controller.ts / shipments.service.ts / shipments.repository.ts
  dto/create-shipment.dto.ts / shipment-response.dto.ts
  shipment-identifiers.ts / *.spec.ts
packages/database/sql/001-create-shipment.sql
docs/openapi.json / docs/api-contract.md
specs/002-create-shipment/{spec,plan,research,data-model,quickstart,tasks,acceptance}.md
specs/002-create-shipment/contracts/create.md
```

## Design and validation

1. Normalize fixed ordered object; trim all strings, nullable optional missing/null, timezone timestamp truncate to ms; key lower-case UUID v4. Hash SHA256 canonical JSON.
2. BEGIN on pool.connect client; INSERT idempotency row ON CONFLICT DO UPDATE no-op locks scope/key; read returned snapshot. After lock obtain server clock (not transaction-start time); compare expiry and reset expired row while locked.
3. Live samehash snapshot returns original body after commit; hash mismatch409; only new/expired key checks future deadline then calls service factory for IDs/response at locked server time.
4. Shipment INSERT ON CONFLICT(trackingCode) DO NOTHING RETURNING id permits bounded collision retry without aborting transaction; all other write failures rollback, release suspect client on rollback failure.
5. Insert UUID event + UUID notification (minimal text); update key snapshot; COMMIT before returning. SQL errors masked503; business validation/conflict retainscode. No retry around unknown COMMIT outcome: client reuses key.
6. Parameterized queries; no ambient DATABASE_URL used by tests. SQL suite always in-memory PostgreSQL engine; opt-in real server URL must loopback/database parcelflow_shipments_test, unique schema and safe teardown.

## Complexity Tracking

No architectural exception; PGlite is test-only PostgreSQL engine, not alternative production storage. Prisma remains historical draft rather than partially rewriting GPS models owned elsewhere.
