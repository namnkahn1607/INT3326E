# API contract — Week 1 draft

## VIETMAP geocoding integration — 2026-10-25

User-approved replacement for Photon. The active frontend demo calls VIETMAP
Autocomplete/Place/Reverse v4 directly, without the ParcelFlow geocoding proxy.
It uses `VITE_VIETMAP_API_KEY` from ignored local configuration. This exposes the
Services key in the browser by explicit temporary user decision, an exception to
constitution IV's no-secret-in-FE rule. Restrict/rotate the demo key and move calls
back to the proxy before production. Never commit key values or log provider URLs.
Firebase tokens and private driver instructions/contacts are not sent to VIETMAP.
No shipment, auth, database or GPS business changes; nothing automatically deployed.

Customer/Admin retain Leaflet with lightweight raster tiles, using CARTO Voyager
when `VITE_CARTO_API_KEY` is configured, otherwise OSM. CARTO and OSM attribution
remain visible. No Tilemap key or WebGL SDK is needed. Address lookup is independent
of tile loading. Frontend cache lasts five minutes (30 entries), requests are
cancellable with a 12-second timeout and a shared 1.2-second rate window.

The existing proxy below remains implemented for later use, not the current frontend
path. It keeps `VIETMAP_API_KEY` on the server and uses the existing Firebase guard
for all three roles without SQL linkage. The frontend demo does not require local
Firebase Admin credentials or a new Cloud deployment for address lookup.

Read-only `POST` endpoints under `/v1/geocoding` use bodies to keep public address
queries/coordinates out of request URLs. Unknown body/query fields are rejected.

| Endpoint | Body | HTTP 200 |
| --- | --- | --- |
| `/search` | `{ query: string }` (3–255 chars) | Up to five suggestions with `reference`, `label`, `id`, `address`; coordinates optional |
| `/place` | `{ reference: string }` (1–2048 chars) | One resolved match with `point: { lat, lng }` |
| `/reverse` | `{ lat: number, lng: number }` | `{ result: match \| null }` |

`address` contains `street`, `area`, `regions: string[]`. Search calls VIETMAP
Autocomplete v4 with Hanoi focus and `display_type=2`; only selected references
call Place v4, inheriting old-format regions. Reverse v4 also uses
`display_type=2`. Hanoi results only. Vendor IDs are not directory codes: frontend
matches returned names to its existing legacy province/district/ward directory.
Unmatched levels stay empty rather than guessing. Driver instructions and contacts
are not included in provider requests; Firebase tokens go only to ParcelFlow.

Errors: 400 validation, 401 auth, 429 local limit, 503 `GEOCODING_UNAVAILABLE`
(missing/invalid key, provider quota/error, timeout). No raw provider diagnostics.
Limits per API instance: 30 requests/account/minute, 300 total/minute, four active
upstream calls; five-minute cache capped at 300 entries, eight-second upstream
timeout, no automatic provider retries. These are not distributed/cloud-wide
budget controls. Responses use `Cache-Control: no-store`. No automatic key
rotation, billing changes, migration or cloud deployment.

## Create implementation on test branch — 2026-10-24

`POST /v1/shipments` now implements PF SPEC 01 v1.3 FR01/API01/SC02 in
`apps/api/src/modules/shipments`. Only CUSTOMER with Firebase verification and
provisioned `usr_ULID` business identity can create; actor fields never come from body.
Unknown fields/query/type coercion are rejected. JSON keeps `dropoff*`,
`trackingNumber`, `customerId`; storage maps to `delivery*`, `trackingCode`, `senderId`.
Request optional notes/packageDescription/weight/deadline normalize missing/null;
text is trimmed, timestamp timezone/calendar validated then truncated to UTC ms.

`Idempotency-Key` is a single UUID v4, scoped to actor + CREATE_SHIPMENT + key.
Default replay window **24h**, configured by `SHIPMENT_IDEMPOTENCY_TTL_SECONDS`
(integer1..31536000, default86400). Stable normalized payload SHA256 is compared
under a PostgreSQL row lock. Samekey/hash returns original201 body, even if shipment
state/deadline has changed; different payload→409 IDEMPOTENCY_KEY_CONFLICT.
Expiry is processed under that lock; beyond the window a new create is possible.
Invalid/missing key→400 IDEMPOTENCY_KEY_MISSING. New requests alone validate future deadline.

One transaction/client commits shipment CREATED, CREATED event, Customer notification
and immutable201 snapshot. All writes rollback on failure; DB errors→503, no raw SQL
or credentials. Tracking is PFYYYYMMDD+6 Crockford Base32 (UTC date, no hyphens),
unique with at most five generation attempts. No retries around unknown commit outcome;
client retains its key. All SC02 keys are explicit, including nullable fields.

This is **test-branch implementation, not a deployed Cloud SQL acceptance**.
Baseline SQL requires an empty schema; see [DB safety](../packages/database/README.md)
and [Spec Kit/verification](../specs/002-create-shipment/quickstart.md).
GET List/Detail, Assign and GPS remain unimplemented; preserving the frontend does
not activate those routes. Historical draft statements below are retained, not current
Create requirements. No migration, seed, IAM, deploy or auth changes run automatically.

Current Admin read endpoints: `GET /v1/drivers` (API11/SC06) and
`GET /v1/admin/customers` (read-only TV6 scope requested on 23/10/2026).
Both require ADMIN and a provisioned business user. See
[Admin directory](tv6-admin-directory.md) for pagination, database dependencies,
privacy and integration details; see [QA test plan](qa-test-plan.md) for acceptance.
Historical week 1/2 draft statements below do not describe these new handlers.

GPS request/event fields follow PF SPEC 01 v1.3, VI.API00/API08/EVT01. The current
contract is [GPS event contract](gps-event-contract.md); independent review by
the GPS pipeline owner remains pending. The endpoint remains unimplemented.
The remaining week 1 decisions and proposals below are preserved.

## Scope and sources

`docs/openapi.json` is TV1's contract draft for later implementation.
Week 1 runs only `GET /healthz`; the other operations are marked `draft`.
The scope follows the README's single shipment flow and the team's
09/10/2026 decision to retain Admin for dispatch operations.

| Concern | Week 1 baseline / draft |
| --- | --- |
| Roles | `CUSTOMER`, `DRIVER`, `ADMIN`; Admin dispatches and monitors operations |
| Shipment states | `CREATED → ASSIGNED → PICKED_UP → DELIVERED / DELIVERY_FAILED` |
| Business prefix | `/v1`; public liveness remains `/healthz` |
| GPS endpoint draft | `POST /v1/locations`, `202 Accepted`, as in TV1's current OpenAPI |
| Addresses | REST draft uses `dropoffAddress/dropoffLocation`; TV3's UI/shared draft uses `deliveryAddress/deliveryLocation` |
| List response | REST draft returns `data` and `pagination { limit, hasMore, nextCursor }` |
| Identifiers | REST draft uses prefixed IDs and `trackingNumber`; TV3's draft uses UUIDs and `trackingCode` |

The REST draft is the reference for API implementation review, not a completed
integration agreement. TV3/TV4 must confirm it before connecting the UI or GPS
emitter. UI/storage names do not need to match JSON names verbatim: an explicit
mapping is required when implementation begins. No adapters, migrations or
runtime handlers are added in week 1.

## Proposals preserved for team review

- `CANCELLED` and `POST /shipments/{id}/cancel` extend the five-state baseline.
  The original cancellation operation and request schema are preserved under
  `x-proposals.cancellation` in OpenAPI and are not active draft operations.
  Do not introduce that state into the shared or database enum before approval.
- GPS requests require `lat`, `lng`, `clientTimestamp`; `sessionId` (UUID) and
  `seq` are optional diagnostics. The API derives `driverId`
  from authenticated identity and adds `eventId`, `receivedAt`. Sequence is
  diagnostic; freshness uses `clientTimestamp`, and history dedupe uses
  `(driverId, clientTimestamp)`. No runtime endpoint or DB behavior is implied.
- Issue #2 proposes direct database writes instead of Pub/Sub. It still requires
  a group decision before GPS business implementation; it does not remove the
  week 1 Pub/Sub Hello World checkpoint.
- Role storage, error conversion to ProblemDetails, database-field/identifier
  mapping and geocoding (#3) remain integration decisions for later weeks.
  Auth's existing Nest error responses remain unchanged in this scaffold.

## Roles and frontend

OpenAPI role names, the Auth enum, shared `UserRole` and Prisma `Role` all
contain only `CUSTOMER`, `DRIVER`, `ADMIN`. `failedByRole` uses the Admin
name in place of the old Dispatcher name; action authorization remains draft.
The frontend retains `Admin*` and `/admin`; this PR does not change TV3's UI.

The Prisma schema and shared type index retain TV3's existing five-state
domain draft; only the obsolete role is removed. Their other fields are
draft designs, not a generated database. GPS types and validation now follow
the week 2 event contract; the storage schema still needs later alignment.

## Review before later implementation

TV1 owns the API contract and data/shared draft; TV3/TV4 review client fields,
pagination and telemetry; TV6 reviews Auth/RBAC; TV5 confirms actual resource
names. Record any approved changes in OpenAPI and this document in the same PR.
Health tests and the TV6 Auth/Admin tests can be run now without Firebase calls.

## TV6 Auth tuần 2 — 17/10/2026

Bổ sung API đã triển khai `GET /v1/auth/me` (ba role) và `GET /v1/admin/me` (ADMIN). Mọi handler mặc định được guard bảo vệ; health public. API nghiệp vụ còn lại vẫn là draft. Custom claims Firebase là nguồn role, có kiểm tra revocation/account hiện tại; không có role Dispatcher riêng hoặc public API cấp quyền. Xem `docs/auth-rbac.md` mục 12 cho claims CLI, cấu hình frontend/runtime, kiểm thử và trạng thái cloud chưa nghiệm thu.


### Follow-up review Auth tuần 2

API hiện trả ProblemDetails cho lỗi qua ApiExceptionFilter; không còn dùng lỗi Nest mặc định ở runtime AppModule. 401/403 giữ ý nghĩa xác thực/quyền; Firebase/SQL tạm lỗi hoặc chưa cấu hình trả 503. BusinessUserGuard trên vùng Shipment dùng UsersService để nối Firebase UID với user nghiệp vụ; thiếu/lệch linkage trả 409 USER_NOT_PROVISIONED. /auth/me và /admin/me không bắt buộc user SQL. OpenAPI đã ghi nhận các lỗi này, business handlers vẫn chưa triển khai. CORS cho Idempotency-Key. Xem docs/auth-rbac.md mục 12.6 về mapping schema, seed và cloud acceptance còn mở.
