# @parcelflow/database

Prisma schema remains a historical draft for ParcelFlow. Roles are `CUSTOMER`, `DRIVER`, and `ADMIN`.

## Setup

No database commands, Prisma generation or seed scripts are registered here.

## Create Shipment test baseline

`sql/001-create-shipment.sql` implements PF SPEC 01 v1.3 DATA01/02/03/06/07
for an **empty schema only**. It creates users, shipments, status events,
notifications and idempotency records atomically. It intentionally fails on
existing table names rather than hiding an incompatible schema or overwriting data.
There is no automatic startup DDL; the API uses pg and the shared TV6 pool,
not generated Prisma. GPS models and writers are unchanged by this baseline.

Storage mapping remains `trackingCode/senderId/delivery*` to JSON
`trackingNumber/customerId/dropoff*`. Users and shipments have text prefixed ULIDs;
event/notification IDs are UUIDs. Optional package fields are nullable. The Prisma
UUID defaults and required package fields must **not** be used to generate a competing
migration for this implementation. Review/reconcile Prisma separately with TV1/TV2/TV6.

API tests apply this file only to a disposable schema in PostgreSQL WASM or an
explicit loopback test DB. Never apply the fresh baseline directly to a populated
or shared Cloud SQL database. TV1/TV6 must inspect the existing schema/data and own
an in-place migration/provisioning plan before integration; TV5 coordinates rollout.
See [Create quickstart](../../specs/002-create-shipment/quickstart.md).
