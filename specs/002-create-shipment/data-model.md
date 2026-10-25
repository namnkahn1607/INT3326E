# Create data model

Baseline SQL is limited to DATA01/02/03/06/07; does not replace GPS tables or auto-migrate existing tables.

- users: text usr_ULID PK, firebaseUid/email unique; name, role CUSTOMER/DRIVER/ADMIN, nullable phone, timestamptz(3) created/updated. Provision externally.
- shipments: text sh_ULID PK; trackingCode unique; senderId users FK; driverId nullable users FK; five states. pickupAddress/Lat/Lng, deliveryAddress/Lat/Lng, recipientName/Phone required; notes/packageDescription/packageWeightKg/expectedDeliveryAt nullable; failureReason/failedByUserId/failedByRole/proofOfDeliveryNotes nullable. created/updated UTC ms. Constraints finite/range/positive/length and state/driver consistency. Index owner, driver, status + createdAt/id.
- shipment_status_events: UUID PK, shipmentId FK, action, from/toStatus, actorUserId/actorRole, previous/newDriverId FK nullable, reason nullable, occurredAt. Create CREATED/null/CREATED/CUSTOMER/no driver/no reason. Index shipmentId/occurredAt/id.
- notifications: UUID PK, customerId/shipmentId/statusEventId FKs, kind/title/body, createdAt. unique(customerId,statusEventId), customer pagination index. Content generic, no phone/full address.
- idempotency_requests: PK(actorUserId FK, operation, key UUID), hash, responseStatus/body JSONB (temporarily nullable only in uncommitted transaction), created/expiresAt. Application never commits incomplete response. Expiry handled under same row lock, no cron.

Response mapper is explicit, never SELECT * entity. SC02 all properties present. Storage trackingCode/senderId/delivery fields map to JSON trackingNumber/customerId/dropoff. No serialized FirebaseUid/token. isLate derived at creation, snapshot immutable on replay.
