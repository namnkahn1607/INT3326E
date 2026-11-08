# TV1 tuần 7 — Tài xế lấy hàng, giao hàng và lịch sử trạng thái

Nguồn yêu cầu: Đặc tả Kỹ thuật ParcelFlow v1.4 (PF SPEC 01 — cập nhật 02/11/2026),
mục `W7-TV1-01`, `W7-TV1-02`, `FR03`, `FR06`, `API02`, `API03`, `API05`, `API06`,
`SC01`, `SC02`, `SC03`, `AC03` (`TC03.1–TC03.3`), `TC02.5` và `AC06` (`TC06.1`).

## 1. Các API và hạng mục hoàn thành

| Mã công việc | Endpoint | Quyền & Hành vi chính |
| --- | --- | --- |
| `W7-TV1-01` | `POST /v1/shipments/:id/pickup` (`API05`) | Chỉ `DRIVER` hiện đang được gán (`driverId === actor.userId`). Chuyển `ASSIGNED → PICKED_UP` dưới khóa `SELECT ... FOR UPDATE OF s`. Gọi lặp khi đơn đã `PICKED_UP` trả `200 OK` No-op. |
| `W7-TV1-01` | `POST /v1/shipments/:id/deliver` (`API06`) | Chỉ `DRIVER` hiện đang được gán. Nhận `{ proofOfDeliveryNotes?: string \| null }` (trim, $\le 255$ ký tự Unicode, rỗng sau trim thành `null`). Chuyển `PICKED_UP → DELIVERED` dưới khóa dòng. Gọi lặp khi đơn đã `DELIVERED` trả `200 OK` No-op và giữ nguyên ghi chú lần đầu. |
| `W7-TV1-02` | `GET /v1/shipments` (`API02`) & `GET /v1/shipments/:id` (`API03`) | Hoàn tất và kiểm chứng chuỗi `statusHistory` đầy đủ `CREATED → ASSIGNED/REASSIGNED → PICKED_UP → DELIVERED` theo thứ tự `(occurredAt ASC, id ASC)`, tính đúng `isLate` cho trạng thái kết thúc `DELIVERED` dựa trên sự kiện kết thúc, giữ nguyên phân trang keyset `SC01` và giới hạn quyền theo role. |

## 2. Thiết kế giao dịch & bất biến kỹ thuật

1. **Thứ tự kiểm tra bắt buộc (Spec mục 2.2):**
   - `401` xác thực Firebase (`FirebaseAuthGuard`).
   - `403` sai role (`RolesGuard` + kiểm tra trong `ShipmentsService`) hoặc `409 USER_NOT_PROVISIONED` (`BusinessUserGuard`).
   - `400` sai định dạng `id`, dư query params hoặc sai schema body.
   - Trong giao dịch SQL sau `SELECT ... FROM shipments s WHERE s.id = $1 FOR UPDATE OF s`:
     1. Không có dòng $\rightarrow$ `404 RESOURCE_NOT_FOUND`.
     2. `current.driverId !== driverId` $\rightarrow$ `403 FORBIDDEN_RESOURCE` (kiểm tra **trước** bước No-op và trạng thái để tài xế cũ hoặc tài xế khác không bao giờ nhận `200` hay `409`).
     3. `current.status === target` $\rightarrow$ `200 OK` No-op (commit ngay, không đổi `updatedAt`/`proofOfDeliveryNotes`, không sinh thêm sự kiện hay thông báo).
     4. `current.status !== expectedFrom` $\rightarrow$ `409 INVALID_STATE_TRANSITION`.
2. **Ghi nguyên tử 3 bảng trong một giao dịch:**
   - Cập nhật `shipments` với thời gian từ `SELECT clock_timestamp() AS now` lấy sau khi đã giữ khóa dòng.
   - Thêm dòng `shipment_status_events` với `previousDriverId = driverId`, `newDriverId = driverId`, tách riêng tham số vị trí cho `action` (`shipment_action`) và `"toStatus"` (`shipment_status`) để tương thích cả cột `text` lẫn PostgreSQL `ENUM`.
   - Thêm dòng `notifications` cho `customerId = current.senderId` (`kind = 'PICKED_UP' | 'DELIVERED'`).
   - Mọi lỗi SQL hoàn tác toàn bộ giao dịch (`ROLLBACK`), đánh dấu hủy kết nối nếu `ROLLBACK` lỗi, và trả `503 SERVICE_UNAVAILABLE` qua `ProblemDetails` mà không lộ chuỗi SQL hoặc thông tin nhạy cảm.

## 3. Phân tích đánh đổi kỹ thuật (Trade-offs)

- **Pessimistic Row Locking (`SELECT ... FOR UPDATE OF s`) vs Optimistic Concurrency (`WHERE status = $expected`):**
  - *Hiệu năng & bộ nhớ:* Giữ kết nối từ `pg.Pool` trong suốt vòng đời giao dịch (1 lệnh `SELECT FOR UPDATE` + 1 `clock_timestamp()` + 3 lệnh ghi). Tuy nhiên mọi truy vấn đều đi theo khóa chính `shipments(id)` trên dữ liệu nhỏ nên thời gian giữ khóa rất ngắn (vài ms).
  - *Độ phức tạp & Failure modes:* Khóa dòng giải quyết triệt để race condition `TC02.5` giữa `POST /assign` (Admin gán lại tài xế) và `POST /pickup` (Tài xế lấy hàng), đồng thời cho phép phân biệt chính xác giữa `404`, `403`, `200 No-op` và `409` trong một lần đọc có khóa mà không cần vòng lặp retry ở tầng ứng dụng.
- **Idempotency tự nhiên theo trạng thái đích vs Bảng `idempotency_requests`:**
  - Đồ thị trạng thái `ASSIGNED → PICKED_UP → DELIVERED` là DAG đơn hướng không có chu trình. Kiểm tra `current.status === target` ngay dưới khóa dòng `FOR UPDATE` đảm bảo tính idempotent tự nhiên mà không tốn thêm dung lượng lưu trữ hay chi phí ghi vào bảng `idempotency_requests`.
  - *Đánh đổi:* Khi gọi lặp `POST /deliver` trên đơn đã `DELIVERED` với `proofOfDeliveryNotes` khác lần đầu, hệ thống ưu tiên tính bất biến của sự kiện đã chốt (trả `200 OK` với dữ liệu đã lưu lần đầu, không ghi đè ghi chú).

## 4. Kết quả kiểm chứng

Đã chạy trực tiếp trong phiên làm việc:

- `npm run typecheck` (gốc workspace) và `npm run typecheck --workspace=@parcelflow/api`: **Đạt (0 lỗi)**.
- `npm run build --workspace=@parcelflow/api`: **Đạt**.
- `npx oxlint --type-aware apps/api/src/modules/shipments/dto/driver-shipment-actions.dto.ts apps/api/src/modules/shipments/shipments.controller.ts apps/api/src/modules/shipments/shipments.service.ts apps/api/src/modules/shipments/shipments.repository.ts apps/api/src/modules/assignments/assignments.postgres.spec.ts`: **0 warnings, 0 errors**.
- `npm run test --workspace=@parcelflow/api`: **27 test files passed (3 skipped), 446 tests passed (99 skipped), 0 failed**.
  - Riêng `assignments.postgres.spec.ts`: **96 passed** trên cả hai chế độ SQL thật (`pglite` text và `pglite-enums` PostgreSQL ENUMs), bao gồm `TC03.1`, `TC03.2`, `TC03.3`, `TC02.5`, `TC06.1`, rollback từng bước ghi và kiểm thử client frontend thật.
- `npm run test:integration --workspace=@parcelflow/web`: **10/10 passed** (bao gồm luồng UI Driver `list → detail → pickup → deliver` qua Nest HTTP và PGlite thật).
- `npm run test --workspace=@parcelflow/web`: **36 test files passed, 493/493 tests passed**.

## 5. Phạm vi chưa kiểm chứng / Blocker ngoài local

- **PostgreSQL đa kết nối (`SHIPMENT_TEST_DATABASE_URL`)**: 49 ca trong chế độ `postgres` của `assignments.postgres.spec.ts` đang được skip do môi trường hiện tại chưa cấu hình `SHIPMENT_TEST_DATABASE_URL` trỏ tới database test `parcelflow_shipments_test`.
- **Nghiệm thu trên Cloud Run + Cloud SQL thật (`W7-TV1-T07`)**: Chưa thực hiện vì quy tắc dự án không tự động deploy/chạy trên môi trường ngoài khi chưa có yêu cầu và cần phối hợp cùng TV5/TV6 với tài khoản Firebase demo.
- **Các API thuộc Tuần 8–10**: `POST /v1/shipments/:id/fail` (`API07`) và `GET /v1/shipments/:id/tracking` (`API09`) giữ nguyên trạng thái chưa triển khai đúng theo lộ trình phân công tuần.
