# Customer wire/data model

Nguồn VI.API00/01, SC01–03. Không đổi DB/shared/legacy UI type.

- Coordinates: finite lat -90..90, lng -180..180, required; 0 hợp lệ, trống invalid.
- Create: pickupAddress/dropoffAddress trim 5..255; hai Location; recipientName trim
  2..100; recipientPhone dấu + tùy chọn rồi 9..15 chữ số; notes/packageDescription
  ≤500; packageWeightKg finite >0; expectedDeliveryAt sau lúc tạo, gửi UTC ISO ms.
- SC02: id sh_ULID, trackingNumber PFYYYYMMDD+6 Base32, customerId usr_ULID,
  driverId nullable, năm status; Address/Location pickup/dropoff và recipient.
  notes/packageDescription/weight/deadline/isLate/failureReason/failedByRole/
  failedByUserId/proofOfDeliveryNotes nullable; createdAt/updatedAt bắt buộc.
  Tất cả key hiện diện, không dùng legacy field thay key chuẩn.
- Detail SC02 + statusHistory SC03, không GPS history. Đọc/validate history nhưng
  UI timeline nâng cao để milestone 6; không tự sinh event.
- List data SC02[], pagination {limit integer 1..100, hasMore boolean,
  nextCursor string|null}; cursor opaque và nhất quán với hasMore.
- Intent {key UUIDv4, payload normalized, startedAt epoch ms}; cùng ý định giữ body/key,
  retry tối đa 24h, không kiểm tra lại deadline tương lai của payload retry.
