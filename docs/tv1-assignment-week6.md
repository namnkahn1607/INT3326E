# TV1 tuần 6 — Shipment reads và Assignment

Đạt (TV6) thực hiện thay TV1 theo phân công hiện tại. Baseline:
`develop@3110275d4a54ff7cebf0a875fbf1a94a41359193`.
Nguồn yêu cầu: [PF SPEC 01, nội dung v1.3](https://docs.google.com/document/d/1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8/edit),
FR02/FR06/FR10, API02/03/04, SC01/02/03, SD04 và TC02.1–4/6.
Theo lịch nhóm, tuần 6 là 26/10–01/11/2026. List/Detail là phụ thuộc để nối
giao diện phân công hiện có; không làm lại frontend hoặc Auth.

## API

| Method/path | Quyền và kết quả |
| --- | --- |
| `GET /v1/shipments` | CUSTOMER chỉ đơn mình tạo; DRIVER chỉ đơn hiện đang gán, gồm terminal; ADMIN toàn bộ. Trả SC01 với `data: SC02[]`. |
| `GET /v1/shipments/:id` | Cùng quyền tài nguyên; SC02 kèm `statusHistory: SC03[]` theo `occurredAt ASC, id ASC`. Không tồn tại 404, ngoài quyền 403. |
| `POST /v1/shipments/:id/assign` | Chỉ ADMIN có business user. Body duy nhất `{ "driverId": "usr_..." }`, trả 200 SC02. |

Giữ FirebaseAuthGuard, RolesGuard, BusinessUserGuard và pool `USER_DATABASE`
hiện có. Không tin actor/role trong body. Các response mới có
`Cache-Control: no-store`; lỗi đi qua ProblemDetails hiện có.

List nhận `limit` mặc định 20, tối đa 100; `status`, `trackingNumber` exact và
`cursor` opaque. Sort `createdAt DESC,id DESC`. Cursor gắn với actor/filter,
giữ microsecond của khóa SQL; scope vẫn được áp lại trong query, cursor không
trao quyền. Field lạ, lặp hoặc cursor không khớp trả 400. Không có total hay
snapshot xuyên các trang. Detail và history đọc bằng một SQL statement để
tránh trộn state/driver/history khi reassign cạnh tranh. `isLate` của đơn active
so với server time; đơn terminal so với sự kiện kết thúc, bằng deadline là false.

## Transaction phân công

1. Khóa shipment bằng `SELECT ... FOR UPDATE OF s`, sau đó kiểm tra state.
2. Khóa user được chọn bằng `FOR SHARE` và kiểm tra role DRIVER. Shipment/Driver
   không tồn tại trả 404; target sai role trả 400; PICKED_UP/terminal trả 409.
3. CREATED chuyển ASSIGNED. ASSIGNED cùng Driver là no-op, giữ nguyên
   `updatedAt`, history và notification. ASSIGNED khác Driver ghi REASSIGNED.
4. Với thay đổi thật, cùng một SQL client ghi shipment, status event và
   notification cho Customer rồi commit. Lỗi ghi rollback tất cả; lỗi dependency
   được che chi tiết SQL và trả 503. Không tự retry transaction.

Hai request cạnh tranh được serialize theo khóa shipment; request sau đọc
state/driver sau commit trước. Hai yêu cầu gán Driver khác nhau có thể cùng
thành công theo thứ tự, vì reassign được phép trước pickup. Mỗi đơn chỉ có một
Driver hiện hành; một Driver được có nhiều đơn. Nếu mất response, frontend phải
GET Detail và yêu cầu xác nhận mới; không tự phát lại ý định gán cũ.

Comment trong source giải thích khóa, thời điểm lấy clock, snapshot, no-op và
commit. Controller chỉ nhận HTTP; service kiểm tra request/quyền; repository
giữ query/transaction. Response mapper dùng chung cho reads và Assign.

## Database

Dùng các bảng/cột đã có ở `packages/database/sql/001-create-shipment.sql`:
`users`, `shipments`, `shipment_status_events`, `notifications`.
Giữ mapping quoted camelCase, `trackingCode/senderId/delivery*` sang
`trackingNumber/customerId/dropoff*`. Không thêm dependency, schema hoặc lệnh
migration mới. File SQL baseline chỉ dành cho schema rỗng/test; không apply nó
trực tiếp lên Cloud SQL đã có dữ liệu. Pool và credential do cấu hình hiện có quản lý.

## Kiểm thử

Từ gốc repo:

```bash
npm ci --ignore-scripts --prefer-offline
npm run typecheck --workspace=@parcelflow/api
npm run build --workspace=@parcelflow/api
npm run test --workspace=@parcelflow/api
```

Để kiểm tra PostgreSQL native, operator cấu hình `SHIPMENT_TEST_DATABASE_URL`
tại máy trỏ tới database test loopback **`parcelflow_shipments_test`**, rồi chạy:

```bash
npm run test --workspace=@parcelflow/api -- src/modules/assignments/assignments.postgres.spec.ts
```

Harness tự tạo/dọn schema ngẫu nhiên, không dùng `DATABASE_URL` của ứng dụng.
Firebase được mock trong cả hai mode. PGlite chạy SQL thật nhưng serialize
transaction; chỉ PostgreSQL native kiểm chứng khóa giữa nhiều connection.

Bộ test bao phủ quyền 401/403/409, scope sau reassign, state/target invalid,
same-driver no-op, nhiều đơn/Driver, rollback từng bước ghi, mất response sau
COMMIT, filter/pagination/microsecond, terminal lateness và frontend API client
đọc response thật từ Nest HTTP. Test native giữ transaction đầu tại barrier,
quan sát connection thứ hai chờ `Lock` trong `pg_stat_activity`, rồi xác nhận
history ASSIGNED/REASSIGNED đúng driver trước/sau và không ghi trùng notification.

Kết quả kiểm tra ngày 01/11/2026:

- Bộ mới: **69 pass, 1 skip** với PGlite và PostgreSQL native 18.6. Skip là ca
  quan sát lock cố ý không chạy trên PGlite.
- Toàn bộ API: **357 pass, 16 skip**. 16 skip gồm 7 Firebase Emulator, 7 Admin
  native SQL do chưa cấu hình URL riêng và 2 ca lock không áp dụng cho PGlite.
- API typecheck/build đạt. Kết quả này không chứng minh Firebase/Cloud SQL thật.
- Root typecheck và **354 test frontend** đạt. Lint phần thay đổi không có
  warning/error; lint toàn repo còn cảnh báo có sẵn ở scaffold và code ngoài phạm vi.
- OpenAPI JSON, các `$ref` nội bộ và `git diff --check` đạt.

PostgreSQL chạy tạm trên loopback trong thư mục công việc, database riêng.
Không thay dependencies repo để cài server, không kết nối database nhóm.

## Bàn giao tích hợp

TV3 có thể dùng nguyên `getShipments`, `getShipmentById`, `assignShipment` đang
có. Frontend đã có recovery GET-only khi kết quả Assign không rõ; không thêm
retry POST. TV4 dùng List/Detail theo business Driver hiện hành.

Còn mở: deploy bản mới, xác nhận schema/runtime và mapping Firebase ba role,
nghiệm thu Admin chọn đơn/gán/reassign và Driver đọc đúng đơn trên Cloud.
Đo NFR riêng trên môi trường đó. TC02.5 race với Pickup vẫn là bước sau khi API
Pickup tồn tại; không bổ sung handler Pickup chỉ để đóng test này. GPS ingest,
Worker, UI mới và provisioning production không thuộc thay đổi này.
