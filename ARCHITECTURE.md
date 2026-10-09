# ParcelFlow - Directory Structure Guide

This document defines the directory layout and conventions for **ParcelFlow**. All team members should follow this standard to maintain consistency and enable smooth parallel development.

## Repository Layout

To accommodate the **Frontend (React)**, **Backend API (NestJS)**, and **GPS Worker (Cloud Run Consumer)** sharing common contracts and schemas, the project is structured as a workspace:

```
parcelflow/
├── apps/
│   ├── api/                      # Main NestJS REST API (Cloud Run)
│   ├── worker/                   # Standalone GPS Pub/Sub consumer (Cloud Run)
│   └── web/                      # React + Vite + TypeScript frontend
│
├── packages/                     # Shared packages across apps
│   ├── database/                 # Prisma/TypeORM schema, migrations & seed scripts
│   ├── types/                    # Shared DTOs, interfaces & event schemas
│   └── config/                   # Shared ESLint, Prettier, TypeScript configs
│
├── infra/                        # Infrastructure and local development setup
│   ├── docker-compose.yml        # Local PostgreSQL & Pub/Sub emulator
│   └── pubsub/                   # Topic and subscription bootstrap scripts
│
├── .env.example
├── README.md
├── ARCHITECTURE.md
└── package.json
```

---

## 3. Backend Layout (`apps/api`)

Follows a **Feature Module** pattern. Each feature module contains its own **Controller, Service, Repository, DTOs, and Entities**.

```
apps/api/src/
├── main.ts                       # Application entry point (port, global pipes, Swagger)
├── app.module.ts                 # Root module importing all feature modules
│
├── common/                       # Shared cross-cutting concerns
│   ├── decorators/               # @CurrentUser(), @Roles()
│   ├── filters/                  # HttpExceptionFilter, AllExceptionsFilter
│   ├── guards/                   # FirebaseAuthGuard, RolesGuard
│   ├── interceptors/             # TransformInterceptor, LoggingInterceptor
│   └── pubsub/                   # PubSubPublisherService (Google Cloud Pub/Sub wrapper)
│
├── config/                       # Environment config & validation
│   ├── app.config.ts
│   └── env.validation.ts
│
└── modules/                      # Business Feature Modules
    ├── auth/                     # Firebase Auth token verification & user context
    │   ├── guards/
    │   ├── auth.service.ts
    │   └── auth.module.ts
    │
    ├── users/                    # User accounts & role management
    │   ├── users.controller.ts
    │   ├── users.service.ts
    │   ├── users.repository.ts
    │   ├── dto/
    │   │   ├── create-user.dto.ts
    │   │   └── user-response.dto.ts
    │   ├── entities/
    │   │   └── user.entity.ts
    │   └── users.module.ts
    │
    ├── shipments/                # Core shipment lifecycle
    │   ├── shipments.controller.ts
    │   ├── shipments.service.ts
    │   ├── shipments.repository.ts
    │   ├── dto/
    │   │   ├── create-shipment.dto.ts
    │   │   ├── update-shipment-status.dto.ts
    │   │   └── shipment-response.dto.ts
    │   ├── entities/
    │   │   └── shipment.entity.ts
    │   └── shipments.module.ts
    │
    ├── admin/                    # Admin scaffold; dispatching permissions
    │   ├── admin.module.ts
    │   ├── controllers/admin.controller.ts
    │   └── services/admin.service.ts
    │
    ├── assignments/              # Shipment assignment to drivers
    │   ├── assignments.controller.ts
    │   ├── assignments.service.ts
    │   ├── assignments.repository.ts
    │   ├── dto/
    │   │   └── assign-driver.dto.ts
    │   └── assignments.module.ts
    │
    ├── location/                 # GPS Write-path & Polling Read-path
    │   ├── location.controller.ts  # POST /location (publishes event), GET /tracking/:shipmentId
    │   ├── location.service.ts     # Pub/Sub publisher + location query coordination
    │   ├── location.repository.ts  # Reads from current_location & location_history
    │   ├── dto/
    │   │   ├── ingest-location.dto.ts
    │   │   └── tracking-response.dto.ts
    │   └── location.module.ts
    │
    ├── eta/                      # ETA calculation service
    │   ├── eta.controller.ts     # GET /shipments/:id/eta
    │   ├── eta.service.ts        # Haversine distance & estimation logic
    │   └── eta.module.ts
    │
    └── notifications/            # Customer notifications
        ├── notifications.controller.ts
        ├── notifications.service.ts
        └── notifications.module.ts
```

### Module Component Responsibilities

| Layer | Responsibility | What it Should NOT Do |
|---|---|---|
| **Controller** | Handle HTTP requests, route definitions, parameter validation (`ValidationPipe`), and status codes. | Do not execute business logic or write database queries directly. |
| **Service** | Core business logic, orchestration across repositories, publishing domain events (Pub/Sub). | Do not manipulate raw HTTP request/response objects. |
| **Repository** | Database queries, transactions, raw SQL queries for performance-critical paths. | Do not contain business workflow rules. |
| **DTO (`dto/`)** | Request and response schema validation using `class-validator` / `class-transformer` or `Zod`. | Do not hold database-specific annotations. |
| **Entity (`entities/`)**| Database schema mapping (Prisma model or TypeORM entity). | Do not expose raw entities directly to API responses (use response DTOs). |

---

## 4. GPS Worker Layout (`apps/worker`)

The GPS Worker is an independent service running on **Google Cloud Run**, pulling messages from the `gps-events` subscription.

```
apps/worker/src/
├── main.ts                       # Worker bootstrap script
├── worker.module.ts              # NestJS worker module (or lightweight Node service)
│
├── consumer/
│   ├── gps.subscriber.ts         # Pub/Sub subscriber listener & ACK/NACK handler
│   └── gps-processor.service.ts  # Processing & idempotency logic
│
└── storage/
    └── gps-writer.repository.ts  # Database upserts
```

## 5. Frontend Layout (`apps/web`)

The React frontend uses Vite, Tailwind CSS, and Leaflet + OpenStreetMap.

```
apps/web/src/
├── main.tsx
├── App.tsx
├── api/                          # Axios / Fetch client with Firebase token interceptor
│   ├── client.ts
│   └── endpoints/
│       ├── shipments.ts
│       ├── tracking.ts
│       └── assignments.ts
├── assets/
├── components/                   # Reusable UI components (buttons, modals, tables)
│   ├── ui/
│   └── map/                      # Leaflet map container & marker components
├── features/                     # Feature-specific pages & logic
│   ├── auth/                     # Login / register / Firebase auth state
│   ├── customer/                 # Shipment tracking & history view
│   ├── driver/                   # Driver active order & GPS submission sender
│   └── admin/               # Order dispatching & driver assignment view
├── hooks/                        # Custom hooks (e.g., usePollingTracking, useDriverLocation)
├── types/                        # Frontend TypeScript types
└── utils/
```
