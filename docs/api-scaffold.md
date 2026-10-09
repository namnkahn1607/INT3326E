# API scaffold — Week 1

## Run locally

Use Node.js >= 20.12 (the bootstrap uses Node's built-in `loadEnvFile`).
From the repository root:

```bash
cd apps/api
npm ci --workspaces=false
cp .env.example .env
npm run typecheck
npm test
npm run build
npm start
```

`npm start` loads `apps/api/.env` when started from that directory.
Existing runtime environment variables take precedence over the file.
`PORT` takes precedence over `API_PORT`; the local fallback is `3000`.
The HTTP server binds to `0.0.0.0` for Cloud Run.

In another terminal:

```bash
curl -i http://localhost:3000/healthz
```

Expected: HTTP `200`, JSON `{"status":"ok","service":"api"}`, without a token.
This is a liveness check; it does not query Firebase, Cloud SQL or Pub/Sub.

## Week 1 runtime

`AppModule` imports the existing `AuthModule` and `AdminModule` from TV6,
plus `ShipmentsModule`. Shipment and Admin contain controller/service
scaffolds with no business handlers. Only `GET /healthz` is implemented.
Business routes will use the `/v1` prefix; health remains outside that prefix.

Auth uses the existing Firebase Admin SDK provider and three roles:
`CUSTOMER`, `DRIVER`, `ADMIN`. Admin performs dispatch operations and the
frontend keeps `/admin`. No global auth guard protects health.
There is no mock-auth or role-selection mode in the application.

For local liveness, `FIREBASE_PROJECT_ID=int3326e` allows the SDK to initialize;
health does not verify tokens or request credentials. Real token verification
later requires ADC or external credentials. On Cloud Run, TV5 configures
the Firebase project and runtime service account/ADC. Never copy credentials
into source, an environment example, a screenshot or the container image.

The other empty files inherited from TV1 remain placeholders for later weeks;
they are not imported into the running application.

## Container handoff to TV5

From the repository root:

```bash
docker build -t parcelflow-api:week1 apps/api
docker run --rm -p 8080:8080 \
  -e PORT=8080 -e FIREBASE_PROJECT_ID=int3326e parcelflow-api:week1
curl -i http://localhost:8080/healthz
```

The build context must be `apps/api`; the Dockerfile installs from the API
lockfile and excludes local environment files. Cloud Run supplies `PORT`.
The runtime image has no development dependencies and runs as the `node` user.

TV5 deploys this image/source and records the actual Cloud Run URL, revision,
source SHA and public `GET /healthz` result in issue #9. Do not use the example
hostname in old contract drafts as deployment evidence. Worker deployment
remains TV2/TV5's responsibility.

## Contract and integration

See [API contract draft](api-contract.md) for baseline decisions and proposals.
`docs/openapi.json` describes future business APIs, not implemented handlers.
The OpenAPI health operation explicitly overrides the server to `/`.

The API keeps its standalone package/lockfile so it can be installed and built
before FE/worker workspace integration. Root workspace reconciliation belongs
to issue #10; preserve the API's Auth dependencies/scripts during that merge.
The Prisma/shared-type files copied from TV3 are draft references only, with
the removed Dispatcher role excluded. No database migration, Prisma client,
seed script, GPS ingestion or business endpoint is introduced in week 1.

Submit validation output and the source SHA in a comment on issue #5; link the
Cloud Run evidence from #9 when TV5 has deployed it. No separate checkpoint
file is required.
