# TV1 tuần 7 — Nhận hàng, giao hàng và lịch sử vận đơn

Ngày: 08/11/2026. Base: `develop@2ff6d3a`.
Thực hiện theo quy trình spec/clarify/plan/checklist/tasks/analyze/implement/converge trong `AGENTS.md` (repo không có `.specify/memory/constitution.md` hoặc bộ skill Spec Kit cài sẵn; không tạo constitution mới).

## Nguồn yêu cầu và phạm vi

- **Nguồn chính thức:**
  - Đặc tả ParcelFlow v1.4 (PF SPEC 01 — Cập nhật 02/11/2026) và [spec baseline](../../contracts/spec-baseline.md): FR03, FR06, FR08, FR10; quyết định thiết kế D01, D04, D05, D07, D09; API00, API02, API03, API05, API06; SC01, SC02, SC03; DATA02, DATA03, DATA06; tiêu chí nghiệm thu AC03 (`TC03.1–TC03.3`), `TC02.5` (cạnh tranh Assign vs Pickup), AC06 (`TC06.1`).
  - Hợp đồng hiện hành tại [OpenAPI](../../openapi.json), [API contract](../../contracts/api-contract.md) và [TV1 tuần 6](../../history/assignment-api-week6.md).
- **Tài liệu hỗ trợ đối chiếu:**
  - Phân rã công việc `W7-TV1-01`, `W7-TV1-02` tại [week-task-breakdown.md](../../tv6/week-task-breakdown.md) và các mục tồn đọng `#1, #2, #3` giao cho TV1 tại [week-07.md](../../tv6/week-07.md).
  - [Bàn giao TV4](../driver-shipments-handoff.md) xác nhận frontend Driver đã gọi `POST /v1/shipments/{id}/pickup` và `POST /v1/shipments/{id}/deliver`.
- **Giới hạn phạm vi:**
  - Chỉ triển khai công việc của TV1 Tuần 7 (`API05` Pickup, `API06` Deliver, hoàn thiện và kiểm chứng lịch sử/danh sách `API02`/`API03` cho toàn bộ chuỗi `CREATED → ASSIGNED/REASSIGNED → PICKED_UP → DELIVERED`, và đồng bộ `docs/openapi.json` / tài liệu contract).
  - Không triển khai `API07` (`fail` — thuộc Tuần 9), `API09` (`tracking` — thuộc Tuần 8/10), không thay đổi UI của TV3/TV4, không chạy migration lên Cloud SQL hoặc tự commit/push/deploy.

## Yêu cầu kỹ thuật và tiêu chí chấp nhận

- **R1 — Xác thực, phân quyền và thứ tự kiểm tra (`AUTH01`, `D09`, Bảng 2.2):**
  - `POST /v1/shipments/{id}/pickup` và `POST /v1/shipments/{id}/deliver` yêu cầu Firebase ID Token hợp lệ (`401 UNAUTHENTICATED`), custom claim `role = DRIVER` (`403 FORBIDDEN_RESOURCE` cho `CUSTOMER` và `ADMIN`), và liên kết bản ghi `users` khớp `firebaseUid` + `role` (`409 USER_NOT_PROVISIONED` nếu thiếu hoặc lệch).
  - Kiểm tra định dạng `id` (`^sh_[0-7][0-9A-HJKMNP-TV-Z]{25}$`) và từ chối mọi query parameter lạ (`400 VALIDATION_ERROR`) trước khi mở transaction.
  - Trong transaction sau khi khóa dòng đơn (`SELECT ... FOR UPDATE OF s`): nếu đơn không tồn tại trả `404 RESOURCE_NOT_FOUND`; nếu `shipment.driverId !== actor.id` (kể cả khi `CREATED` có `driverId = null` hoặc đơn đã reassign sang tài xế khác) trả `403 FORBIDDEN_RESOURCE` trước khi xét trạng thái No-op hay `409`. Người không phải tài xế hiện hành của đơn không bao giờ nhận `200 No-op`.

- **R2 — API05 Xác nhận lấy hàng (`POST /v1/shipments/{id}/pickup`):**
  - Body: không gửi body hoặc gửi object rỗng `{}`; từ chối mọi trường lạ hoặc kiểu dữ liệu không phải object (`400 VALIDATION_ERROR`).
  - Khi `shipment.status === 'PICKED_UP'` (và `driverId === actor.id`): trả `200 OK` (No-op) với `ShipmentResponse` hiện tại, không đổi `updatedAt`, không ghi thêm `shipment_status_events` hay `notifications`.
  - Khi `shipment.status === 'ASSIGNED'` (và `driverId === actor.id`): lấy `occurredAt = clock_timestamp()` sau khi giữ khóa, cập nhật `status = 'PICKED_UP'`, `updatedAt = occurredAt`; ghi 1 dòng `shipment_status_events` (`action = 'PICKED_UP'`, `fromStatus = 'ASSIGNED'`, `toStatus = 'PICKED_UP'`, `actorUserId = actor.id`, `actorRole = 'DRIVER'`, `previousDriverId = actor.id`, `newDriverId = actor.id`, `reason = null`, `occurredAt`); ghi 1 dòng `notifications` cho `customerId = shipment.senderId` (`kind = 'PICKED_UP'`, không chứa SĐT/địa chỉ đầy đủ) trong cùng một SQL transaction. Trả `200 OK` kèm `Cache-Control: no-store` và `ShipmentResponse` (`SC02`).
  - Khi `shipment.status` ở trạng thái khác (`DELIVERED`, `DELIVERY_FAILED`): trả `409 INVALID_STATE_TRANSITION`.

- **R3 — API06 Xác nhận giao hàng thành công (`POST /v1/shipments/{id}/deliver`):**
  - Body: không gửi body, gửi `{}` hoặc `{ proofOfDeliveryNotes?: string | null }`. Nếu có chuỗi `proofOfDeliveryNotes`, `trim` và kiểm tra độ dài $\le 255$ ký tự Unicode code point (`[...normalized].length <= 255`); chuỗi rỗng sau khi trim hoặc `null`/`undefined` chuẩn hóa thành `null`. Từ chối mọi trường khác trong body (`400 VALIDATION_ERROR`).
  - Khi `shipment.status === 'DELIVERED'` (và `driverId === actor.id`): trả `200 OK` (No-op) với `ShipmentResponse` hiện tại, **giữ nguyên** `proofOfDeliveryNotes` và `updatedAt`/`occurredAt` của lần giao đầu tiên, không sinh thêm event hay notification.
  - Khi `shipment.status === 'PICKED_UP'` (và `driverId === actor.id`): lấy `occurredAt = clock_timestamp()` sau khi giữ khóa, cập nhật `status = 'DELIVERED'`, `proofOfDeliveryNotes`, `updatedAt = occurredAt`; ghi 1 dòng `shipment_status_events` (`action = 'DELIVERED'`, `fromStatus = 'PICKED_UP'`, `toStatus = 'DELIVERED'`, `actorUserId = actor.id`, `actorRole = 'DRIVER'`, `previousDriverId = actor.id`, `newDriverId = actor.id`, `reason = null`, `occurredAt`); ghi 1 dòng `notifications` cho `customerId = shipment.senderId` (`kind = 'DELIVERED'`, không chứa SĐT/địa chỉ đầy đủ) trong cùng một SQL transaction. Trả `200 OK` kèm `Cache-Control: no-store` và `ShipmentResponse` (`SC02`).
  - Khi `shipment.status` ở trạng thái khác (`ASSIGNED`, `DELIVERY_FAILED`): trả `409 INVALID_STATE_TRANSITION`.

- **R4 — Tính nguyên tử, xử lý cạnh tranh và lỗi phụ thuộc (`D04`, `TC02.5`, `TC03.1–TC03.3`):**
  - Lỗi ở bất kỳ bước ghi nào (`UPDATE shipments`, `INSERT INTO shipment_status_events`, `INSERT INTO notifications`) phải `ROLLBACK` toàn bộ giao dịch, trả `503 SERVICE_UNAVAILABLE` theo chuẩn `ProblemDetails` (`D07`) và không làm lộ câu lệnh SQL/thông tin nhạy cảm.
  - Khi Admin gọi `assign` (reassign sang Driver 2) đồng thời với Driver 1 gọi `pickup` trên cùng đơn `ASSIGNED` (`TC02.5`): khóa dòng `FOR UPDATE OF s` tuần tự hóa hai giao dịch — nếu `pickup` giữ khóa trước thì đơn sang `PICKED_UP` và `assign` nhận `409 INVALID_STATE_TRANSITION`; nếu `assign` giữ khóa trước thì `driverId` đổi sang Driver 2 và `pickup` của Driver 1 nhận `403 FORBIDDEN_RESOURCE`.

- **R5 — Đọc danh sách, chi tiết & lịch sử trạng thái (`W7-TV1-02`, `API02`, `API03`, `SC01–SC03`, `TC06.1`):**
  - `GET /v1/shipments` và `GET /v1/shipments/{id}` trả đúng scope (`CUSTOMER` chủ đơn, `DRIVER` hiện hành kể cả đơn đã `DELIVERED`, `ADMIN` toàn bộ), đúng phân trang keyset `createdAt DESC, id DESC`, tính `isLate` của đơn `DELIVERED` theo `occurredAt` của sự kiện `DELIVERED` đối chiếu với `expectedDeliveryAt` (`<=` là `false`, `>` là `true`, không có hạn giao là `null`).
  - `statusHistory` trong `GET /v1/shipments/{id}` đọc trong cùng một câu SQL với `shipments`, sắp xếp `occurredAt ASC, id ASC`, chứa đầy đủ chuỗi sự kiện `CREATED → ASSIGNED/(REASSIGNED) → PICKED_UP → DELIVERED` theo `SC03`, không chứa lịch sử tọa độ GPS.
  - Đồng bộ `docs/openapi.json` và tài liệu bàn giao cho `pickup`, `deliver` và `list`/`detail`.
