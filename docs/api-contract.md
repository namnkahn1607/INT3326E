# API contract — Week 1 draft

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
- The existing GPS draft's `sessionId/seq` approach is a proposal for later
  idempotency/out-of-order handling, not a working pipeline. In particular,
  blindly accepting a changed session can re-activate a late old session;
  worker rules must be reviewed before implementation.
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
draft designs, not a generated database or a settled GPS event contract.

## Review before later implementation

TV1 owns the API contract and data/shared draft; TV3/TV4 review client fields,
pagination and telemetry; TV6 reviews Auth/RBAC; TV5 confirms actual resource
names. Record any approved changes in OpenAPI and this document in the same PR.
Health tests and the TV6 Auth/Admin tests can be run now without Firebase calls.
