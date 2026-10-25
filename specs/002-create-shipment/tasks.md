# Tasks: Create Shipment

Scope and requirements in [spec.md](spec.md); tests mandatory by constitution V and SC-001–004. No cloud writes or AGENTS edits.

## Phase 1 — Setup

- [x] T001 Record scope/source/base branch and configure isolated SQL tests in `specs/002-create-shipment/research.md` and `apps/api/package.json`/lock; no production dependency.

## Phase 2 — Foundation

- [x] T002 Add empty-schema baseline `packages/database/sql/001-create-shipment.sql` with usr_/sh_ULID PK, tracking unique, sender/driver FK, five states, coordinates finite/range, nullable positive weight, length limits; event/notification/key constraints and pagination indexes per `data-model.md`.
- [x] T003 Add normalization/validation and tests in `apps/api/src/modules/shipments/dto/create-shipment.dto.ts` and `.spec.ts`: trim addresses5–255/name2–100/phone9–15 digits, optional text<=500/weight finite>0/deadline timezone valid calendar UTC ms truncated, unknown fields reject; optional missing/null→null.

## Phase 3 — US1 Create (P1)

Independent test: Customer POST produces exact SC02 and one set of all four rows; identity checks precede writes.

- [x] T004 [P] [US1] Add crypto sh_ULID/PF UTCdate+6Base32 generator and tests in `apps/api/src/modules/shipments/shipment-identifiers.ts` and `.spec.ts`.
- [x] T005 [US1] Implement SC02 DTO, service, POST controller and provider registration in `apps/api/src/modules/shipments/`: CUSTOMER+business identity, no body actor, 201, field-key validation; all nullable SC02 keys explicit.
- [x] T006 [US1] Implement parameterized same-client create transaction in `apps/api/src/modules/shipments/shipments.repository.ts`: CREATED/no driver, event UUID actor CUSTOMER/from null/no driver/reason, notification UUID unique owner/event, snapshot; bounded tracking collision5, errors rollback/masked503.
- [x] T007 [US1] Add Nest HTTP/SQL success/auth/role/linkage/contract tests in `apps/api/src/modules/shipments/shipments.postgres.spec.ts`, reusable isolated PGlite/native PG harness; response compatible existing FE parser.

## Phase 4 — US2 Retry safety (P1)

Independent test: concurrent samekey requests produce one commit and identical201 snapshot; no dynamic deadline validation on replay.

- [x] T008 [US2] Implement canonical SHA256, actor/CREATE_SHIPMENT/key lock+expiry+snapshot in `apps/api/src/modules/shipments/shipments.service.ts` and `shipments.repository.ts`; TTL integer>0 default86400 seconds via provider; clock sampled after row lock.
- [x] T009 [US2] Add retry/lost-response equivalent/changed-state/elapsed-deadline/conflict/TTL/scope and competing-request tests in `apps/api/src/modules/shipments/shipments.postgres.spec.ts`; native PG loopback guard for true multi-connection proof.

## Phase 5 — US3 Failure/validation (P1)

Independent test: injected event/notification/snapshot failures leave zero partial rows; recover with samekey; invalid input writes nothing.

- [x] T010 [US3] Add field error payload limited to safe messages in `apps/api/src/modules/shipments/dto/create-shipment.dto.ts`, reusing ApiProblem/filter with minimal backward-compatible extension if needed.
- [x] T011 [US3] Add invalid fields/key/deadline, rollback/injected commit uncertainty, tracking collision/retry bound and DB outage tests in `apps/api/src/modules/shipments/shipments.postgres.spec.ts` and repository tests.

## Phase 6 — Polish and acceptance

- [x] T012 Update only Create contract/status and related response schemas in `docs/openapi.json`, `docs/api-contract.md`, `packages/database/README.md`, `apps/api/.env.example`; retain other handlers/draft and no GPS rewrite.
- [x] T013 Run API typecheck/test/build, FE consumer tests/lint/build and diff/AGENTS hash; record evidence/TC mapping in `specs/002-create-shipment/acceptance.md` and `quickstart.md`.
- [x] T014 Run native PostgreSQL multi-connection acceptance using `apps/api/src/modules/shipments/shipments.postgres.spec.ts` when isolated loopback DB exists; otherwise explicitly record blocker, no false completion.
- [x] T015 Record owner handoff/shared migration+Firebase/cloud/end-to-end/latency unverified gates in `specs/002-create-shipment/acceptance.md`; do not auto-deploy or claim final production acceptance.

## Dependencies and execution

T001→T002/T003→T004/T005→T006→T007→T008→T009→T010/T011→T012→T013→T014/T015. US2 depends US1, US3 exercises both; final delivery includes all three (US1 alone is not safely shippable without idempotency). T004 test/generator can be prepared independently after foundation; no subagent required. Update task completion only with corresponding evidence, including skipped checks.

Implementation review: T001 package/lock clean-ci; T002 SQL applied on both isolated engines; T003 27 DTO cases; T004 identifier test; T005–T009 HTTP/SQL native+WASM tests including observed lock/replay; T010 safe field errors and existing Auth regressions; T011 SQL constraint rollback, collision bound and COMMIT uncertainty; T012 OpenAPI required keys checked against actual201; T013 266 API/223 FE passes, typecheck/lint/build/diff/hash; T014 native28 cases passed; T015 acceptance handoff lists all unverified shared/cloud/Detail/latency gates. See acceptance.md for limits and exact commands.
