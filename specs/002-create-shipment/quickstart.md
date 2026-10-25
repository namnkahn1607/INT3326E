# Validate Create on the test branch

Do not run SQL against shared/cloud DB. No automatic migration/seed/startup DDL. Review `packages/database/sql/001-create-shipment.sql` with TV1/TV6 before adapting any existing schema; fresh baseline is not an in-place upgrade.

```powershell
# From the repository root:
cd apps/api
npm ci --workspaces=false
npm run typecheck
npm test
npm run build
```

SQL tests use in-memory PGlite by default, real PostgreSQL engine but not multi-connection proof. For an existing disposable loopback database named parcelflow_shipments_test, set SHIPMENT_TEST_DATABASE_URL locally then `npm test -- src/modules/shipments/shipments.postgres.spec.ts`. Harness creates/drops only its random schema. Never use production DATABASE_URL as test URL.

```powershell
# Only after creating your own disposable local PostgreSQL database (no cloud URL):
$env:SHIPMENT_TEST_DATABASE_URL='postgresql://TEST_USER:TEST_PASSWORD@127.0.0.1:5432/parcelflow_shipments_test?sslmode=disable'
npm test -- src/modules/shipments/shipments.postgres.spec.ts
Remove-Item Env:SHIPMENT_TEST_DATABASE_URL
```

Expected: SQL success/auth/validation, concurrent same/different payload, snapshot after deadline/state change,
tracking collision, expiry renewal, rollback on injected write and actual SQL constraint failure,
lost COMMIT response, and existing frontend Create client over real Nest HTTP. A native-only barrier test
observes a second connection waiting for the idempotency lock. PGlite intentionally skips that case;
native suite skips entirely unless the isolated URL is supplied. Firebase remains mocked in both.
To rerun FE regression: from `apps/web`, `npm test`, `npm run lint`, `npm run build`.

Manual local API: supply own DATABASE_URL pointing to reviewed isolated schema and Firebase config/ADC outside repo. Provision test user matching Firebase UID and CUSTOMER claim (no accounts/tokens committed). Build/start API as current docs, send valid Customer POST with a UUIDv4 key. Repeat exact payload/key, compare201 body and row counts. Change payload with samekey→409. Invalid coordinate→400; no token→401; driver/admin→403. After first commit mutate state/deadline via isolated fixture and replay→original snapshot. Full cloud/login/browser integration and latency measurement remain separate owner acceptance.
