# TV6 — Admin directory

## Phạm vi và nguồn

Triển khai từ `develop` tại `52b4cf25dcbadd64fe8796b8f806c27df857f409`.
Đã đối chiếu các branch, PR/issue và PF SPEC 01 v1.3 trong
[Google Docs](https://docs.google.com/document/d/1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8/edit),
Phần VI AUTH01, API00/API11, SC01/SC06, DATA01/02/04 và UI03; Phần VII tuần 3.

`GET /v1/drivers` là API11 của đặc tả, phục vụ Assignment/Driver monitoring.
`GET /v1/admin/customers` là phần đọc bổ sung theo yêu cầu TV6 ngày 23/10/2026;
không phải API được định nghĩa sẵn trong danh mục API01–11. Nó chỉ liệt kê
Customer đã có trong `users`, không tạo/sửa tài khoản hoặc custom claim.
Frontend Admin và tích hợp phân công vẫn thuộc phần bàn giao TV3/TV1.

## API

| Method/path | Quyền | Kết quả |
| --- | --- | --- |
| `GET /v1/drivers` | ADMIN đã có liên kết business user | `data: DriverResponse[]`, `pagination` |
| `GET /v1/admin/customers` | ADMIN đã có liên kết business user | `data: CustomerSummaryResponse[]`, `pagination` |
| `GET /v1/admin/me` | ADMIN | Giữ profile Firebase, không yêu cầu SQL |

Cả hai danh sách dùng `Authorization: Bearer <ID token>`, trả
`Cache-Control: no-store`. Global guards kiểm tra Firebase/role trước; tiếp theo
`BusinessUserGuard` kiểm tra `users.firebaseUid` và role snapshot của Admin.
Không token/sai token → 401; Customer/Driver → 403; thiếu/lệch liên kết →
409 `USER_NOT_PROVISIONED`; dependency hoặc schema SQL chưa sẵn sàng → 503.
Lỗi theo ProblemDetails, không trả raw SQL/driver error hoặc query string.

Query chỉ nhận `limit` và `cursor`. Limit mặc định 20, hợp lệ 1–100; ngoài range,
field lạ, query lặp hoặc cursor sai trả 400 `VALIDATION_ERROR`.
Sort `createdAt DESC, id DESC`, keyset dùng hai khóa và lấy thêm một row để xác
định `hasMore`. Cursor opaque, có version/scope riêng cho hai danh sách; cursor
Customer không dùng cho Driver. Cursor không trao quyền và không chứa UID/email.
Giữ độ chính xác microsecond của khóa SQL trong cursor để không bỏ sót row;
timestamp trả ra response vẫn chuẩn ISO UTC millisecond. Không có total hoặc
cam kết snapshot xuyên các trang. Client giữ nguyên cursor khi tải trang tiếp.

```json
{
  "data": [{
    "id": "usr_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "name": "ParcelFlow Test Driver",
    "activeShipmentCount": 0,
    "currentLocation": null,
    "lastLocationUpdatedAt": null,
    "locationClientTimestamp": null,
    "isLocationStale": null
  }],
  "pagination": { "limit": 20, "hasMore": false, "nextCursor": null }
}
```

DriverResponse chỉ có các field SC06. Đếm đơn `ASSIGNED/PICKED_UP`, cho phép
một tài xế có nhiều đơn. Một SELECT aggregate/join trả count và GPS cùng
snapshot; không gọi một query cho từng tài xế. Không có active shipment hoặc
chưa có current GPS thì cả tọa độ, hai timestamp và stale đều null. Tọa độ
0,0 hợp lệ. Tuổi mẫu dựa `clientTimestamp`: trong [0,30] giây là fresh; ngoài
khoảng là stale. `lastLocationUpdatedAt` dùng `receivedAt`, không dùng
`current_locations.updatedAt`. Không suy ra online/offline từ GPS hoặc tự sinh
giá trị khi chưa có dữ liệu.

CustomerSummaryResponse gồm `id`, `name`, `email`, `phone` (nullable).
Role được cố định ở SQL theo từng route. Không trả Firebase UID, claim,
credential hoặc dữ liệu Admin khác trong các danh sách.

## Database và tích hợp

Dùng pool `USER_DATABASE` hiện có của UsersModule, cấu hình bởi `DATABASE_URL`.
UsersRepository tiếp tục sở hữu đóng pool; Admin không tạo thêm pool/Firebase
client. Tham số cursor/role/limit được bind vào query, không nội suy vào SQL.

| Bảng | Field đọc | Đầu mối schema |
| --- | --- | --- |
| `users` | `id`, `firebaseUid` cho actor; `name`, `role`, `createdAt`; Customer thêm `email`, `phone` | TV1 |
| `shipments` | `driverId`, `status` | TV1 |
| `current_locations` | `driverId`, `lat`, `lng`, `clientTimestamp`, `receivedAt` | TV2 phối hợp TV1 |

Contract dùng tên field camelCase có quote như UsersRepository hiện tại và
DATA01/02/04. Index dự kiến: `users(role, createdAt DESC, id DESC)`, index theo
driver/status cho shipments, PK `current_locations.driverId`; TV1/TV2 chốt
migration và TV5 xác nhận schema/search_path của runtime. Các index này là
khuyến nghị bàn giao, chưa được tạo bởi thay đổi TV6.

Prisma trong repo vẫn là draft: `current_locations` chưa có hai timestamp của
DATA04, ID còn UUID thay cho prefixed ULID. Không dùng draft đó làm bằng chứng
migration đã chạy. Danh sách trả 503 nếu ID vẫn là định dạng cũ; API11 cũng
trả 503 nếu DB chưa đáp ứng query; không fallback
thành danh sách rỗng/count 0. Danh sách Customer chỉ phụ thuộc bảng users.
Không chạy migration hoặc seed trên Cloud SQL trong lượt triển khai này.

TV3 dùng `/v1/drivers`, không ghép thêm `/admin` vào API11. Chỉ vẽ/đếm tập
đang hiển thị, xử lý empty/loading/error và phân trang. Form Assign dùng `id`
nội bộ từ row; backend Assignment của TV1 vẫn phải kiểm tra lại target DRIVER
trong transaction. Danh sách không thay thế quyền/ownership của từng shipment.

## Kiểm tra

Từ `apps/api`:

```bash
npm ci --workspaces=false
npm run typecheck --workspaces=false
npm test --workspaces=false
npm run build --workspaces=false
```

Các test mặc định dùng Firebase/SQL mock qua Nest HTTP thật. Bộ SQL integration
tùy chọn đọc `TV6_ADMIN_TEST_DATABASE_URL`, chỉ nhận database loopback tên
`parcelflow_admin_test`; không dùng `DATABASE_URL` của ứng dụng. Nó tạo một
schema test ngẫu nhiên, seed fixture tối thiểu và dọn riêng schema đó khi kết
thúc. Không phải migration mẫu cho production. Sau khi operator cấu hình biến
này bằng kết nối database test cục bộ:

```bash
npm test --workspaces=false -- src/modules/admin/admin-directory.postgres.spec.ts
```

SQL integration vẫn mock Firebase, không chứng minh IAM runtime, Cloud SQL,
NFR, concurrency giữa nhiều instance hoặc đăng nhập trên Hosting. Chi tiết
case, checkpoint và cách ghi kết quả ở [QA test plan](qa-test-plan.md).

Đồng bộ dependency `class-validator` vào manifest và hai lockfile để sửa lỗi
typecheck có sẵn của DTO GPS; không thay đổi GPS contract trong phần Admin.

## Kết quả kiểm tra bản bàn giao 23/10/2026

- API: **179 test pass**, gồm 7 SQL integration qua `pg`/Nest HTTP trên
  PostgreSQL WASM (PGlite 0.5.11); Firebase được mock. **7 Firebase Auth
  Emulator test skip**, không được tính đã chạy. Nếu không cấu hình SQL test,
  bộ mặc định có 172 pass, 7 SQL skip và 7 emulator skip.
- API cài sạch từ lockfile riêng, typecheck và build pass. Root workspace
  `npm ci --ignore-scripts`, typecheck và **74 test GPS/runner** pass.
- Root lint không có error, còn cảnh báo scaffold rỗng/strictNullChecks có sẵn.
  Frontend production build pass, còn cảnh báo bundle lớn có sẵn.
- OpenAPI 3.0.3 validation và `git diff --check` pass.

SQL test sử dụng database in-memory riêng, không phải Cloud SQL; không đo NFR,
không chạy race đa kết nối thực hoặc nghiệm thu runtime production. Database
application, Firebase thật, IAM và deployment không bị thay đổi. Bản code được
bàn giao qua nhánh `feature/tv6-admin-directory`; kết quả này chưa nghiệm thu deploy. TV1/TV2/TV5
cần xác nhận migration/runtime trước khi chạy smoke các endpoint mới trên cloud.
