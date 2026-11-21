# Kế hoạch triển khai TV1 tuần 7

## 1. Các điểm đã làm rõ (Clarify)

1. **Xử lý request body của `POST /v1/shipments/{id}/pickup`:**
   - Theo `API05` và adapter frontend (`pickupShipment` gửi POST không có body và không gửi `Content-Type`), Express body-parser có thể để `req.body === undefined` hoặc `{}`.
   - Parser `parsePickupBody(body)` chấp nhận `undefined` hoặc object rỗng `{}` (`!Array.isArray(body) && Object.keys(body).length === 0`); từ chối `null`, mảng, kiểu nguyên thủy hoặc object có bất kỳ key nào (`400 VALIDATION_ERROR`).
2. **Xử lý request body của `POST /v1/shipments/{id}/deliver`:**
   - Theo `API06` và adapter frontend (`deliverShipment` gửi `{}` khi không có ghi chú hoặc `{ proofOfDeliveryNotes }` đã trim), parser `parseDeliverBody(body)` chấp nhận `undefined`, `{}` hoặc `{ proofOfDeliveryNotes?: string | null }`.
   - Nếu `proofOfDeliveryNotes` là chuỗi: `trim()`, kiểm tra `[...normalized].length <= 255` (đếm theo Unicode code point khớp với `characterCount` của frontend); nếu sau khi trim là chuỗi rỗng `""` thì chuẩn hóa thành `null`. Nếu `proofOfDeliveryNotes` khác `undefined | null | string` hoặc có key lạ trong body thì trả `400 VALIDATION_ERROR`.
3. **Thứ tự kiểm tra trong transaction `pickup` và `deliver`:**
   - Khóa dòng đơn: `SELECT ${SHIPMENT_PROJECTION} FROM shipments s WHERE s.id = $1 FOR UPDATE OF s`.
   - Không có dòng $\rightarrow$ `404 RESOURCE_NOT_FOUND`.
   - `current.driverId !== actor.id` $\rightarrow$ `403 FORBIDDEN_RESOURCE` (áp dụng cả khi `status = CREATED` có `driverId = null`, hoặc đơn đã bị reassign sang tài xế khác, hoặc đơn đã `PICKED_UP`/`DELIVERED` bởi tài xế khác).
   - Kiểm tra trạng thái:
     - Với `pickup`: nếu `current.status === 'PICKED_UP'` $\rightarrow$ `COMMIT` và trả `shipmentResponse(current)` (No-op); nếu `current.status !== 'ASSIGNED'` $\rightarrow$ `409 INVALID_STATE_TRANSITION`.
     - Với `deliver`: nếu `current.status === 'DELIVERED'` $\rightarrow$ `COMMIT` và trả `shipmentResponse(current)` (No-op, giữ nguyên `proofOfDeliveryNotes` và thời gian ban đầu); nếu `current.status !== 'PICKED_UP'` $\rightarrow$ `409 INVALID_STATE_TRANSITION`.
4. **Cấu trúc module và tái sử dụng:**
   - Đặt route `:id/pickup` và `:id/deliver` trong `ShipmentsController` (`@Roles(UserRole.DRIVER)`), logic điều phối trong `ShipmentsService` và giao dịch SQL trong `ShipmentsRepository` (hoặc phương thức chuyển trạng thái dùng chung trong `ShipmentsRepository`), dùng chung `USER_DATABASE`, `SHIPMENT_PROJECTION`, `shipmentResponse` và cơ chế đóng/mở transaction + `ROLLBACK` an toàn đã được kiểm chứng ở Tuần 5–6.
5. **Tương thích với bộ test hiện hành:**
   - Trong `assignments.postgres.spec.ts` dòng 307 có kiểm tra cũ của Tuần 6: `expect((await fetch(\`${base}/shipments/${s.id}/pickup\`, ...)).status).toBe(404)` (khi đơn `s` vừa tạo ở trạng thái `CREATED`, `driver1` gọi `pickup`). Khi `API05` đã được triển khai ở Tuần 7, `driver1` gọi `pickup` trên đơn `CREATED` (`driverId = null !== driver1.id`) phải nhận `403 FORBIDDEN_RESOURCE` theo đúng mục 4.6 (`API05`), và gọi trên đơn không tồn tại nhận `404`. Tương tự, bài test integration `shipment-flow.spec.tsx` của `apps/web` cần được cập nhật để phản ánh handler `pickup`/`deliver` đã hoạt động thật thay vì trả `404`.

## 2. Thiết kế chi tiết theo file

1. **`apps/api/src/modules/shipments/dto/driver-shipment-actions.dto.ts` (mới):**
   - `parsePickupShipment(body: unknown): void`
   - `parseDeliverShipment(body: unknown): string | null`
2. **`apps/api/src/modules/shipments/shipments.controller.ts`:**
   - Thêm `@Post(':id/pickup')` (`@Roles(UserRole.DRIVER)`, `@HttpCode(200)`, `@Header('Cache-Control', 'no-store')`).
   - Thêm `@Post(':id/deliver')` (`@Roles(UserRole.DRIVER)`, `@HttpCode(200)`, `@Header('Cache-Control', 'no-store')`).
3. **`apps/api/src/modules/shipments/shipments.service.ts`:**
   - Thêm `pickup(actor: BusinessUser, id: string, body: unknown, query: Record<string, unknown>): Promise<ShipmentResponseDto>`
   - Thêm `deliver(actor: BusinessUser, id: string, body: unknown, query: Record<string, unknown>): Promise<ShipmentResponseDto>`
4. **`apps/api/src/modules/shipments/shipments.repository.ts`:**
   - Thêm thực thi SQL transaction cho `pickup` và `deliver` với `SELECT ... FOR UPDATE OF s`, cập nhật `shipments`, chèn `shipment_status_events` (`previousDriverId = actor.id`, `newDriverId = actor.id`), chèn `notifications` (`kind = 'PICKED_UP'` / `'DELIVERED'`, tiêu đề và nội dung chuẩn không lộ SĐT), đọc lại bằng `SHIPMENT_PROJECTION` trong cùng transaction trước khi `COMMIT`.
5. **Kiểm thử & Tài liệu:**
   - Mở rộng `apps/api/src/modules/assignments/assignments.postgres.spec.ts` (hoặc spec tích hợp SQL của shipments/assignments) để kiểm chứng đầy đủ `TC03.1`, `TC03.2`, `TC03.3`, `TC02.5` (race condition giữa `assign` và `pickup`), `TC06.1` (đầy đủ chuỗi lịch sử `CREATED → ASSIGNED → REASSIGNED → PICKED_UP → DELIVERED` và phân trang keyset), rollback khi lỗi ghi SQL, và tích hợp với client frontend (`pickupShipment`, `deliverShipment`).
   - Cập nhật `apps/web/integration/shipment-flow.spec.tsx` để kiểm chứng luồng UI Driver `list → detail → pickup → deliver` qua Nest HTTP thật và PGlite SQL.
   - Cập nhật `docs/openapi.json` và `docs/contracts/api-contract.md` cho `API05` và `API06`.

## 3. Phân tích chất lượng trước triển khai (Analyze)

- Đối chiếu `spec.md`, `plan.md`, `checklist.md`, `tasks.md` với Đặc tả v1.4 và `packages/database/sql/001-create-shipment.sql`:
  - Ràng buộc `CHECK (status = 'DELIVERED' OR "proofOfDeliveryNotes" IS NULL)` trong bảng `shipments` hoàn toàn tương thích: `pickup` giữ `proofOfDeliveryNotes = NULL`, `deliver` chỉ ghi `proofOfDeliveryNotes` khi `status = 'DELIVERED'`.
  - Ràng buộc `CHECK (kind IN ('CREATED', 'ASSIGNED', 'REASSIGNED', 'PICKED_UP', 'DELIVERED', 'DELIVERY_FAILED'))` và `UNIQUE ("customerId", "statusEventId")` trong bảng `notifications` hoàn toàn tương thích.
  - Biến thể schema enum (`shipment_status` và `shipment_action` riêng biệt trên Cloud) đã được hỗ trợ bởi `SHIPMENT_PROJECTION` dùng ép kiểu `::text`; các câu `INSERT`/`UPDATE` của `pickup` và `deliver` dùng literal `'PICKED_UP'` và `'DELIVERED'` tương thích với cả cột `text` và cột `ENUM`.
- Không có mâu thuẫn nghiêm trọng nào chặn việc triển khai.
