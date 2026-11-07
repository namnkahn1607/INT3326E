# TV6 frontend handoff to TV5

The frontend builds with Firebase authentication from PR #15. Deploying Hosting
also requires a backend that implements the Auth/Admin routes and CORS below.

## Build configuration

Create `apps/web/.env.production.local` (ignored by Git), or set these variables
in the build environment. Copy `apiKey` and `appId` from the Firebase Web app
configuration supplied by TV5; replace both placeholders before building.

```dotenv
VITE_API_URL=https://backend-service-wcvss3dnxa-as.a.run.app/v1
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=int3326e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=int3326e
VITE_FIREBASE_APP_ID=your-firebase-app-id
```

`apps/web/src/api/client.ts` reads the API URL. The Firebase initializer in
`apps/web/src/features/auth/firebase.ts` reads the other four variables.
Storage, Messaging and Analytics settings are not consumed by the current app.

Vite loads env files from `apps/web`, not the repository root. Shell/CI values
override env files; production-specific files override generic env files.
`VITE_*` values are public and embedded at build time, so rebuild after changing
them. Never put passwords, tokens, ADC or service-account credentials in these
variables. Do not set `VITE_FIREBASE_AUTH_EMULATOR_URL` for Hosting or use a
localhost API URL in the deployed bundle.

## Build and Hosting deployment

Use Node.js >=22.12.0 as required by the root package. From the repository root:

```bash
cd apps/web
npm ci --workspaces=false
npm run lint
npm test
npm run build
npx --yes firebase-tools deploy --only hosting --project int3326e
```

The build script runs `tsc -b && vite build`. The output is `apps/web/dist`.
Run Firebase CLI from `apps/web`: `firebase.json` publishes `dist` and rewrites
SPA routes to `/index.html`; `.firebaserc` selects `int3326e`. TV5 must authenticate
Firebase CLI with Hosting access before running the deployment command.

## Backend requirements and observed blocker

On 2026-10-18, the Cloud Run API confirmed the service URL above without `/v1`.
The serving revision was `backend-service-00012-m54`. Read-only HTTP probes found:

| Request | Observed result |
| --- | --- |
| GET `/healthz/` | 200, API liveness JSON |
| GET `/healthz` | 404 |
| GET `/v1/auth/me`, with or without trailing slash | 404 |
| GET `/v1/admin/me` | 404 |
| OPTIONS `/v1/auth/me` from `https://int3326e.web.app` | 404, no allow-origin header |

Before acceptance, TV5 must deploy a backend with the merged Auth/Admin code and
record the source SHA and serving revision. Follow the backend build/container
instructions in [api-scaffold.md](api-scaffold.md) and TV5's deployment process;
the repository does not specify a fixed backend Cloud Run deployment command.

Check `FIREBASE_PROJECT_ID=int3326e`, `NODE_ENV=production`, Cloud Run's supplied
`PORT`, and runtime ADC with `firebaseauth.users.get` permission. Do not configure
the Firebase Auth emulator. CORS must allow `https://int3326e.web.app`,
`Authorization` and `Content-Type`, with successful OPTIONS handling before auth
guards. If serving the `int3326e.firebaseapp.com` domain too, verify its origin.
Confirm Firebase email/password sign-in and authorized domains; the operator's
Auth project-config read returned 403, so these settings were not inspected.

After deployment, verify no-token `/v1/auth/me` returns 401; real tokens for the
three existing test users return 200 with the expected UID/role; `/v1/admin/me`
returns 200 for ADMIN and 403 for CUSTOMER/DRIVER. Verify Hosting login, role
navigation, reload, logout and direct `/admin` access. Do not assign roles again.

## Verification scope

Local checks on 2026-10-18 passed: production build including typecheck, ESLint,
29 frontend tests across three files, and a browser smoke test showing the login
form and redirecting unauthenticated `/admin` access to `/login`. The built bundle
used the deployed API URL and supplied Firebase config. The build emitted a
non-fatal warning for a JavaScript chunk larger than 500 kB.

Firebase Management and Hosting public configuration matched all seven fields
supplied by TV5. Real-token tests from the earlier TV6 verification used a local
backend; they do not establish Cloud Run or Hosting end-to-end acceptance.
Hosting login, runtime Firebase permissions and post-deploy CORS remain
unverified. No deployment, IAM/account/role change or Cloud SQL operation was
performed while preparing this handoff.
