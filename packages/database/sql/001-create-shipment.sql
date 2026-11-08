BEGIN;

CREATE TABLE users (
  id text PRIMARY KEY CHECK (id ~ '^usr_[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
  "firebaseUid" text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text,
  role text NOT NULL CHECK (role IN ('CUSTOMER', 'DRIVER', 'ADMIN')),
  "createdAt" timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE shipments (
  id text PRIMARY KEY CHECK (id ~ '^sh_[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
  "trackingCode" text UNIQUE NOT NULL CHECK ("trackingCode" ~ '^PF[0-9]{8}[0-9A-HJKMNP-TV-Z]{6}$'),
  "senderId" text NOT NULL REFERENCES users(id),
  "driverId" text REFERENCES users(id),
  status text NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'DELIVERY_FAILED')),
  "pickupAddress" text NOT NULL CHECK (char_length("pickupAddress") BETWEEN 5 AND 255),
  "pickupLat" double precision NOT NULL CHECK ("pickupLat" BETWEEN -90 AND 90),
  "pickupLng" double precision NOT NULL CHECK ("pickupLng" BETWEEN -180 AND 180),
  "deliveryAddress" text NOT NULL CHECK (char_length("deliveryAddress") BETWEEN 5 AND 255),
  "deliveryLat" double precision NOT NULL CHECK ("deliveryLat" BETWEEN -90 AND 90),
  "deliveryLng" double precision NOT NULL CHECK ("deliveryLng" BETWEEN -180 AND 180),
  "recipientName" text NOT NULL CHECK (char_length("recipientName") BETWEEN 2 AND 100),
  "recipientPhone" text NOT NULL CHECK ("recipientPhone" ~ '^\+?[0-9]{9,15}$'),
  notes text CHECK (char_length(notes) <= 500),
  "packageDescription" text CHECK (char_length("packageDescription") <= 500),
  "packageWeightKg" double precision CHECK ("packageWeightKg" > 0 AND "packageWeightKg" < 'Infinity'::double precision),
  "expectedDeliveryAt" timestamptz(3),
  "failureReason" text CHECK (char_length("failureReason") BETWEEN 1 AND 500),
  "failedByUserId" text REFERENCES users(id),
  "failedByRole" text CHECK ("failedByRole" IN ('DRIVER', 'ADMIN')),
  "proofOfDeliveryNotes" text CHECK (char_length("proofOfDeliveryNotes") <= 255),
  "createdAt" timestamptz(3) NOT NULL,
  "updatedAt" timestamptz(3) NOT NULL,
  CHECK ((status = 'CREATED') = ("driverId" IS NULL)),
  CHECK ((status = 'DELIVERY_FAILED' AND "failureReason" IS NOT NULL AND "failedByUserId" IS NOT NULL AND "failedByRole" IS NOT NULL)
      OR (status <> 'DELIVERY_FAILED' AND "failureReason" IS NULL AND "failedByUserId" IS NULL AND "failedByRole" IS NULL)),
  CHECK (status = 'DELIVERED' OR "proofOfDeliveryNotes" IS NULL)
);
CREATE INDEX shipments_sender_page ON shipments ("senderId", "createdAt" DESC, id DESC);
CREATE INDEX shipments_driver_page ON shipments ("driverId", "createdAt" DESC, id DESC);
CREATE INDEX shipments_status_page ON shipments (status, "createdAt" DESC, id DESC);

CREATE TABLE shipment_status_events (
  id uuid PRIMARY KEY,
  "shipmentId" text NOT NULL REFERENCES shipments(id),
  action text NOT NULL CHECK (action IN ('CREATED', 'ASSIGNED', 'REASSIGNED', 'PICKED_UP', 'DELIVERED', 'DELIVERY_FAILED')),
  "fromStatus" text CHECK ("fromStatus" IN ('CREATED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'DELIVERY_FAILED')),
  "toStatus" text NOT NULL CHECK ("toStatus" IN ('CREATED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'DELIVERY_FAILED')),
  "actorUserId" text NOT NULL REFERENCES users(id),
  "actorRole" text NOT NULL CHECK ("actorRole" IN ('CUSTOMER', 'DRIVER', 'ADMIN')),
  "previousDriverId" text REFERENCES users(id),
  "newDriverId" text REFERENCES users(id),
  reason text,
  "occurredAt" timestamptz(3) NOT NULL,
  CHECK ((action = 'CREATED') = ("fromStatus" IS NULL))
);
CREATE INDEX shipment_events_page ON shipment_status_events ("shipmentId", "occurredAt", id);

CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  "customerId" text NOT NULL REFERENCES users(id),
  "shipmentId" text NOT NULL REFERENCES shipments(id),
  "statusEventId" uuid NOT NULL REFERENCES shipment_status_events(id),
  kind text NOT NULL CHECK (kind IN ('CREATED', 'ASSIGNED', 'REASSIGNED', 'PICKED_UP', 'DELIVERED', 'DELIVERY_FAILED')),
  title text NOT NULL,
  body text NOT NULL,
  "createdAt" timestamptz(3) NOT NULL,
  UNIQUE ("customerId", "statusEventId")
);
CREATE INDEX notifications_customer_page ON notifications ("customerId", "createdAt" DESC, id DESC);

CREATE TABLE idempotency_requests (
  "actorUserId" text NOT NULL REFERENCES users(id),
  operation text NOT NULL,
  key uuid NOT NULL,
  "requestHash" text NOT NULL,
  "responseStatus" integer,
  "responseBody" jsonb,
  "createdAt" timestamptz(3) NOT NULL,
  "expiresAt" timestamptz(3) NOT NULL,
  PRIMARY KEY ("actorUserId", operation, key),
  CHECK ("expiresAt" > "createdAt"),
  CHECK (("responseStatus" IS NULL AND "responseBody" IS NULL) OR ("responseStatus" = 201 AND "responseBody" IS NOT NULL))
);

COMMIT;
