# Create Shipment — verification and handoff

Initial checkpoint: 2026-10-24. Test implementation based on `915e5ed` (already includes develop integration at `a2c245f`). At that checkpoint the implementation was uncommitted, with no push, merge to develop, shared migration, seed, IAM or deploy performed. Source: PF SPEC 01 **content v1.3**, read via Drive on this date; the file name still says v1.2. This report records evidence, not additional requirements.

## Follow-up checkpoint — 2026-10-25

Subsequent user requests updated the Customer form/address dialogs and lightweight
CARTO/OSM raster basemap, independently of the original backend-only checkpoint.
The user approved temporary direct VIETMAP calls with a browser-visible demo key;
see `docs/api-contract.md` for the explicit security exception and later proxy path.
No real key values are committed. Existing Auth and AGENTS.md remain unchanged.

Before split commits: API typecheck/build passed; API tests **259 passed, 43 skipped**
(native PostgreSQL and Firebase emulator not configured for this run). Frontend
lint/build passed and **293 tests passed**. Real browser Search/Place/Reverse calls
to VIETMAP and CARTO raster rendering passed; UI race/responsive tests mocked
Firebase and the administrative directory, without creating real shipments.
The older native-PostgreSQL results below remain historical evidence, not a claim
that a shared database, deployed shipment route or real Firebase-to-DB Create works.

## Delivered

- Existing Shipment module now exposes CUSTOMER-only POST `/v1/shipments` using current Firebase/business guards and TV6 pg pool. No auth implementation or frontend code changed.
- Strict normalization/field validation; unknown body/query fields rejected; UUIDv4 key; SHA256 canonical payload; required SC02 keys including nulls and explicit storage mapping.
- Native DB row lock across connections serializes same actor/operation/key. Replay returns original201 snapshot before future-deadline checks; conflict409; default86400s TTL is configurable, expired keys renew safely while locked.
- Same-client transaction writes shipment CREATED, history, minimal Customer notification and idempotency snapshot. No partial commit or automatic create retry on unknown commit outcome. Unique tracking collision retries bounded5.
- Fresh-schema SQL baseline only; Prisma and GPS files remain historical/unmodified, with reconciliation instructions in database README. No automatic startup DDL.
- OpenAPI and current Create contract synchronized, historical draft sections retained. Only dev dependency added: pinned PGlite0.5.11, eight lockfile lines; production dependencies unchanged.

## Verification evidence

Commands executed from `apps/api` after clean install:

| Check | Observed result |
| --- | --- |
| `npm ci --workspaces=false --ignore-scripts --no-audit --no-fund` | Exit0, 328 packages; existing transitive deprecation warnings, no upgrade attempted |
| `npm run typecheck` | Exit0, runtime and test TypeScript configs |
| `npm test` with isolated SHIPMENT_TEST_DATABASE_URL | **266 passed, 15 skipped, 20 files**, exit0 |
| `npm run build` | Exit0 |
| Shipment SQL suite alone, both engines | **55 passed, 1 skipped**; 27 PGlite +28 native; only native-lock case intentionally skipped on PGlite |
| Existing frontend Create client → real local Nest HTTP → SQL | Create and replay accepted without API adapter changes; token reader and Firebase mocked |
| `git diff --check` | Exit0, no whitespace defects; LF→CRLF informational Git warnings |

The full API15 skips: seven existing Firebase emulator cases (emulator not running), seven existing Admin native PostgreSQL cases (separate TV6 database URL not configured), one lock-observation case intentionally not run on PGlite. Native Create28 cases **did run**, not skipped. No claim that Firebase/Cloud SQL worked follows from these tests.

Native engine: `@embedded-postgres/windows-x64@18.4.0-beta.17`, binary reports PostgreSQL18.4. Downloaded to task-owned OS temp, not project dependencies; initialized a new cluster bound only `127.0.0.1:55439`, database `parcelflow_shipments_test`. Suite creates/drops only its random schema, uses a six-connection pool. A barrier holds transaction1 while transaction2 waits; `pg_stat_activity.wait_event_type='Lock'` and at least two pool connections observed before release. After release both requests201/same snapshot and exactly one four-row set. Temporary PostgreSQL was stopped with pg_ctl after verifying the owned PID/path. No other DB/service was stopped or altered.

Frontend checks from `apps/web`: `npm test` **223 passed/20 files**, `npm run lint` exit0, `npm run build` exit0. Existing JS chunk640.74kB warning>500kB persists; no unrelated splitting/UX changes attempted. No interactive browser/Firebase session exercised in this backend task.

## Traceability to authoritative acceptance

| Source | Evidence and boundary |
| --- | --- |
| TC01.1 | HTTP201 exact SC02 and OpenAPI required-key comparison; SQL checks shipment/event/notification/key, trusted actor, mapping, explicit nullable values, optional field persistence |
| TC01.2 | Six simultaneous samekey requests, deep-equal snapshots and exactly one set; native row-lock wait observed, different payload competition one201/one409 |
| TC01.3 | Changed normalized payload409 IDEMPOTENCY_KEY_CONFLICT, no writes; reordered keys/trim/null/offset equivalent replay201 |
| TC01.4 |27 DTO/key normalization cases, HTTP key/field/query/deadline cases and identity denial; zero committed rows |
| TC01.5 | Event/notification/snapshot failure injection and an actual notification CHECK violation; four writes rollback, samekey retry recovers; unknown COMMIT response case stores one set and retries snapshot |
| TC01.6 API01 portion | Fixture changes persisted state to ASSIGNED; repository clock advances past original deadline but within TTL; replay remains CREATED201, a new key with now-past deadline400. SQL proves current state still ASSIGNED. **GET Detail portion not claimed: API03 remains absent and outside Create scope.** |

## Spec Kit review

Specify/clarify: requirements checklist6/6; no unresolved critical requirement questions. Plan follows existing architecture and no shared DB writes. Custom API checklist10/10 reviewed separately before implement, not used as implementation evidence. Analyze: FR-001–008 all mapped to tasks, zero critical/high findings. T001–T015 have the corresponding implementation/test/handoff evidence above. Converge: inspected8 functional requirements,3 user stories,15 tasks,6 design decisions and5 governing principles against present code/tests. Zero actionable missing/partial/contradicting/unrequested findings **within the explicit Create test-branch scope**; no convergence tasks appended and tasks.md left unchanged by converge. This does not certify the external gates listed below. No extension hooks configured and no agent-context updater ran.

`AGENTS.md` unchanged: SHA256 `1FBB04859CFCCDBEAAB94F01755BEAB0443C279044B6A7C609C8C47B27FD65E6`. No changes in apps/web, Auth module, Driver/GPS/Worker, IAM or existing Prisma schema.

## Still open outside this test-branch implementation

1. **TV1 + TV6** inspect the actual shared users/shipments schema and data, reconcile Prisma/draft and own a non-destructive in-place migration/provisioning plan. Do not apply the empty-schema baseline to an existing shared database. Existing UUID business IDs are incompatible with usr_ULID and must not be silently relabeled.
2. **TV5/backend owner** review, deploy the branch only when requested, configure the current runtime DATABASE_URL/Firebase/CORS and TTL; test actual Customer UID linkage and writes on the approved environment. Deploy Hosting alone cannot expose this backend code.
3. **TV1** implements API02/03 and API04 separately; they are still skeletons. The form can POST to the configured local implementation after correct DB/Auth setup, but navigating to order details/list can still fail until read APIs exist.
4. **TV3 + TV1 + TV6** perform real Firebase/browser/Cloud SQL end-to-end Create/retry and TC01.6 Detail acceptance after integration; NF03 p95<500ms must be measured under agreed workload, not inferred from unit/HTTP test runtime.

Rerun instructions: [quickstart.md](quickstart.md). Native DB helper is not a production service or permanent new project dependency; supply your own isolated loopback DB URL when rerunning native tests.
