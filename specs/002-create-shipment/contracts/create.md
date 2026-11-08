# API01 — POST /v1/shipments

Source PF SPEC 01 v1.3 VI.API00/API01/SC02 and D07/D09. Authorization Bearer Firebase ID token + CUSTOMER claim and provisioned business user. Idempotency-Key UUID v4 required (case-insensitive UUID text normalized lower-case). No query fields supported.

Required body: pickupAddress/dropoffAddress trim5–255; pickupLocation/dropoffLocation exact{lat,lng} finite/range; recipientName trim2–100; recipientPhone trim /^\+?\d{9,15}$/.
Optional notes/packageDescription max500 trim; packageWeightKg finite>0; expectedDeliveryAt ISO8601 timezone valid calendar, normalize UTC by truncating below milliseconds. Missing/null optional→null. Unknown fields and type coercion rejected.

201 body exact SC02; no envelope, all nullable keys present. Idempotency scope business actor + operation CREATE_SHIPMENT + key; SHA256 fixed normalized object. Default TTL86400 seconds via SHIPMENT_IDEMPOTENCY_TTL_SECONDS. Samekey/hash replays snapshot201; differenthash409 IDEMPOTENCY_KEY_CONFLICT; expiredkey permits a new create. Replay before deadline revalidation, no rebuilding response from mutated shipment.

Errors ProblemDetails existing filter: 400 VALIDATION_ERROR (field/errors when available); missing/invalid/duplicate key400 IDEMPOTENCY_KEY_MISSING; 401 UNAUTHENTICATED; 403 FORBIDDEN_RESOURCE; linkage409 USER_NOT_PROVISIONED; DB503 SERVICE_UNAVAILABLE; unexpected500 INTERNAL_SERVER_ERROR. No raw errors, secrets or payload echoed. SQL writes strictly bound parameters.

Not implemented here: GET List/Detail, Assign, GPS, inbox read. Successful POST does not prove those routes work or cloud schema is deployed.
