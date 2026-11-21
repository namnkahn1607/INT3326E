# Hợp đồng API

Tài liệu gồm quyết định hợp đồng qua nhiều mốc; đoạn ghi "ở mốc …" là lịch sử. Trạng thái triển khai hiện tại xem [danh sách tính năng](../features.md).

## TV1 tuần 7 — Tài xế lấy hàng, giao hàng và lịch sử trạng thái

Đã triển khai và kiểm thử local hai API chuyển trạng thái cho `DRIVER`:
`POST /v1/shipments/:id/pickup` (`ASSIGNED → PICKED_UP`) và
`POST /v1/shipments/:id/deliver` (`PICKED_UP → DELIVERED`), đồng bộ cùng chuỗi
lịch sử `statusHistory` của `GET /v1/shipments/:id` và `GET /v1/shipments`.

- Chỉ `DRIVER` hiện đang được phân công (`shipment.driverId === actor.userId`)
  mới được gọi; không nhận `driverId`/`actorId` từ body hoặc query.
- Thứ tự kiểm tra bắt buộc dưới khóa dòng `SELECT ... FOR UPDATE OF s`:
  `401` xác thực → `403` role/provisioning (`409 USER_NOT_PROVISIONED`) →
  `404 SHIPMENT_NOT_FOUND` → `403 FORBIDDEN_RESOURCE` (không phải tài xế hiện tại,
  kể cả khi đơn đã ở trạng thái đích) → `200 OK` No-op tự nhiên nếu đơn đã ở
  trạng thái đích → `409 INVALID_STATUS_TRANSITION` nếu sai trạng thái nguồn.
- Ghi nguyên tử trong một giao dịch SQL: cập nhật `shipments` (lấy thời điểm từ
  `clock_timestamp()`, giữ `proofOfDeliveryNotes` chỉ khi `DELIVERED`), thêm dòng
  `shipment_status_events` (`previousDriverId = driverId`, `newDriverId = driverId`)
  và thêm dòng `notifications` cho Customer (`senderId`).
- `pickup` chỉ chấp nhận body rỗng hoặc `{}`. `deliver` chấp nhận body rỗng, `{}`
  hoặc `{ proofOfDeliveryNotes?: string | null }` (trim khoảng trắng hai đầu,
  tối đa 255 ký tự Unicode, chuỗi rỗng sau trim chuẩn hóa thành `null`).
- Chưa triển khai `POST /v1/shipments/:id/fail` và `GET /v1/shipments/:id/tracking`
  (thuộc phạm vi Tuần 8–10). Chưa chạy nghiệm thu trên Cloud SQL.

## Tích hợp GPS — 02/11/2026

`POST /v1/locations` của Na đã được tích hợp local, dùng DRIVER và
BusinessUserGuard, publish EVT01 canonical rồi mới trả 202. Chưa nghiệm thu
Pub/Sub Cloud hoặc Worker SQL. Xem [bàn giao merge](../history/gps-branch-merge.md).
Các nhận định GPS chưa có handler trong snapshot cũ bên dưới là lịch sử.


## TV1 tuần 6 — Đọc đơn và phân công tài xế

Đã triển khai và kiểm thử trên máy ba API: `GET /v1/shipments`,
`GET /v1/shipments/:id` và `POST /v1/shipments/:id/assign` chỉ dành cho ADMIN.
Dùng schema SQL hiện có, giữ tên cột camelCase có dấu nháy kép.
Customer chỉ xem đơn mình tạo, Driver chỉ xem đơn hiện được gán; chi tiết và
lịch sử lấy từ cùng một phiên bản dữ liệu. Phân công khóa dòng đơn rồi ghi
trạng thái, lịch sử và thông báo trong cùng giao dịch. Gán lại đúng tài xế hiện
tại không ghi thêm dữ liệu. Khi mất phản hồi, client đọc lại chi tiết để đối chiếu.

Xem [hướng dẫn TV1 tuần 6](../history/assignment-api-week6.md) để chạy test và tích hợp.
Chưa thay schema production, IAM hoặc triển khai lên Cloud. Các mục có ngày
bên dưới giữ kết quả tại thời điểm bàn giao trước đó.

## Tích hợp mã hóa địa lý VIETMAP — 2026-10-25

Phương án thay Photon đã được người dùng duyệt. Bản demo frontend đang dùng gọi VIETMAP
Autocomplete/Place/Reverse v4 trực tiếp, không qua proxy mã hóa địa lý của ParcelFlow.
Bản demo dùng `VITE_VIETMAP_API_KEY` từ cấu hình local đã được bỏ qua trong Git. Cách này làm lộ
key Services trên trình duyệt theo quyết định tạm thời rõ ràng của người dùng, là ngoại lệ với
quy tắc không đưa bí mật vào FE ở mục IV của constitution. Hạn chế quyền/đổi key demo và chuyển các lời gọi
về proxy trước khi dùng cho production. Không commit giá trị key hay ghi URL nhà cung cấp vào log.
Token Firebase và chỉ dẫn/thông tin liên hệ riêng cho tài xế không được gửi đến VIETMAP.
Không đổi nghiệp vụ đơn hàng, auth, database hay GPS; không tự động deploy gì.

Customer/Admin giữ Leaflet với các ô bản đồ raster nhẹ, dùng CARTO Voyager
khi đã cấu hình `VITE_CARTO_API_KEY`, nếu không thì dùng OSM. Ghi nguồn CARTO và OSM
vẫn hiển thị. Không cần key Tilemap hay WebGL SDK. Tra cứu địa chỉ độc lập
với tải ô bản đồ. Cache frontend giữ năm phút (30 mục), request
có thể hủy, timeout 12 giây và cửa sổ giới hạn tần suất chung 1.2 giây.

Proxy hiện có bên dưới vẫn được giữ để dùng sau, không nằm trên luồng frontend
hiện tại. Proxy giữ `VIETMAP_API_KEY` trên server và dùng Firebase guard hiện có
cho cả ba role, không cần liên kết SQL. Bản demo frontend không cần thông tin xác thực
Firebase Admin local hay một lần deploy Cloud mới để tra cứu địa chỉ.

Các endpoint `POST` chỉ đọc dưới `/v1/geocoding` dùng body để tránh đưa truy vấn
địa chỉ công khai/tọa độ vào URL request. Từ chối trường lạ trong body/query.

| Endpoint | Nội dung body | HTTP 200 |
| --- | --- | --- |
| `/search` | `{ query: string }` (3–255 ký tự) | Tối đa năm gợi ý có `reference`, `label`, `id`, `address`; tọa độ tùy chọn |
| `/place` | `{ reference: string }` (1–2048 ký tự) | Một kết quả đã xác định với `point: { lat, lng }` |
| `/reverse` | `{ lat: number, lng: number }` | `{ result: match \| null }` |

`address` chứa `street`, `area`, `regions: string[]`. Search gọi VIETMAP
Autocomplete v4 ưu tiên Hà Nội và dùng `display_type=2`; chỉ những tham chiếu đã chọn
mới gọi Place v4, kế thừa vùng theo định dạng cũ. Reverse v4 cũng dùng
`display_type=2`. Chỉ nhận kết quả ở Hà Nội. ID của nhà cung cấp không phải mã danh mục: frontend
đối chiếu tên trả về với danh mục tỉnh/huyện/xã cũ hiện có.
Cấp nào không khớp thì để trống, không đoán. Chỉ dẫn và thông tin liên hệ cho tài xế
không có trong request đến nhà cung cấp; token Firebase chỉ gửi đến ParcelFlow.

Lỗi: 400 kiểm tra dữ liệu, 401 xác thực, 429 giới hạn local, 503 `GEOCODING_UNAVAILABLE`
(thiếu/key không hợp lệ, hạn mức/lỗi nhà cung cấp, timeout). Không trả thông tin chẩn đoán thô từ nhà cung cấp.
Giới hạn mỗi instance API: 30 request/tài khoản/phút, tổng 300/phút, bốn lời gọi
đến nhà cung cấp đang chạy; cache năm phút tối đa 300 mục, timeout gọi nhà cung cấp
tám giây, không tự thử lại với nhà cung cấp. Đây không phải cơ chế kiểm soát ngân sách
phân tán/toàn Cloud. Phản hồi dùng `Cache-Control: no-store`. Không tự đổi
key, thay đổi thanh toán, migration hay deploy Cloud.

## Triển khai tạo đơn trên nhánh test — 2026-10-24

`POST /v1/shipments` hiện triển khai PF SPEC 01 v1.3 FR01/API01/SC02 trong
`apps/api/src/modules/shipments`. Chỉ CUSTOMER đã xác thực Firebase và
được cấp danh tính nghiệp vụ `usr_ULID` mới được tạo; các trường chủ thể không bao giờ lấy từ body.
Từ chối trường/query lạ và ép kiểu. JSON giữ `dropoff*`,
`trackingNumber`, `customerId`; lưu trữ ánh xạ sang `delivery*`, `trackingCode`, `senderId`.
Các trường tùy chọn notes/packageDescription/weight/deadline trong request được chuẩn hóa khi thiếu/null;
văn bản được trim, timestamp được kiểm tra múi giờ/ngày hợp lệ rồi cắt về UTC ms.

`Idempotency-Key` là một UUID v4 duy nhất, có phạm vi chủ thể + CREATE_SHIPMENT + key.
Cửa sổ gửi lại mặc định **24h**, cấu hình bằng `SHIPMENT_IDEMPOTENCY_TTL_SECONDS`
(số nguyên 1..31536000, mặc định 86400). SHA256 ổn định của payload chuẩn hóa được so sánh
khi giữ khóa dòng PostgreSQL. Cùng key/hash trả body 201 gốc, kể cả khi
trạng thái/deadline đơn đã đổi; payload khác→409 IDEMPOTENCY_KEY_CONFLICT.
Hết hạn được xử lý dưới khóa đó; ngoài cửa sổ có thể tạo đơn mới.
Key không hợp lệ/thiếu→400 IDEMPOTENCY_KEY_MISSING. Chỉ request mới kiểm tra deadline tương lai.

Một transaction/client commit đơn CREATED, sự kiện CREATED, thông báo Customer
và snapshot 201 bất biến. Mọi lần ghi rollback khi lỗi; lỗi DB→503, không lộ SQL thô
hay thông tin xác thực. Mã theo dõi là PFYYYYMMDD+6 Crockford Base32 (ngày UTC, không dấu gạch nối),
duy nhất với tối đa năm lần sinh. Không thử lại khi chưa rõ kết quả commit;
client giữ key của mình. Mọi key SC02 đều tường minh, gồm cả trường nullable.

Đây là **bản triển khai trên nhánh test, chưa phải nghiệm thu Cloud SQL đã deploy**.
Mốc SQL nền tảng yêu cầu schema rỗng; xem [an toàn DB](../../packages/database/README.md)
và [bàn giao tạo đơn hàng](../features/create-shipment-handoff.md).
Ở mốc 24/10, danh sách/chi tiết, phân công và GPS chưa được triển khai.
Danh sách/chi tiết/phân công hiện đã có trên máy như mô tả ở trên; phần tiếp nhận GPS đã tích hợp local như mô tả ở trên. Các nhận định nháp lịch sử bên dưới được giữ lại, không phải yêu cầu
tạo đơn hiện tại. Không tự chạy migration, seed, thay đổi IAM, deploy hay auth.

Các endpoint đọc hiện tại của Admin: `GET /v1/drivers` (API11/SC06) và
`GET /v1/admin/customers` (phạm vi chỉ đọc của TV6 được yêu cầu ngày 23/10/2026).
Cả hai yêu cầu ADMIN và người dùng nghiệp vụ đã được cấp. Xem
[danh mục Admin](../features/admin-directory.md) để biết phân trang, phụ thuộc database,
quyền riêng tư và chi tiết tích hợp; xem [kế hoạch test QA](../qa/test-plan.md) để nghiệm thu.
Các nhận định nháp lịch sử tuần 1/2 bên dưới không mô tả các handler mới này.

Các trường request/event GPS theo PF SPEC 01 v1.3, VI.API00/API08/EVT01. Hợp đồng
hiện tại là [hợp đồng sự kiện GPS](gps-event-contract.md); vẫn chờ người phụ trách
pipeline GPS review độc lập. `POST /v1/locations` đã triển khai từ tuần 6.
Các quyết định và đề xuất tuần 1 còn lại bên dưới được giữ nguyên.

## Phạm vi và nguồn

`docs/openapi.json` là bản nháp hợp đồng của TV1 để triển khai sau.
Tuần 1 chỉ chạy `GET /healthz`; các thao tác khác được đánh dấu `draft`.
Phạm vi bám theo luồng đơn hàng đơn lẻ trong README và quyết định của nhóm
ngày 09/10/2026 giữ Admin để điều phối.

| Chủ đề | Mốc nền tảng / bản nháp tuần 1 |
| --- | --- |
| Role | `CUSTOMER`, `DRIVER`, `ADMIN`; Admin điều phối và giám sát vận hành |
| Trạng thái đơn hàng | `CREATED → ASSIGNED → PICKED_UP → DELIVERED / DELIVERY_FAILED` |
| Tiền tố nghiệp vụ | `/v1`; kiểm tra tiến trình công khai vẫn là `/healthz` |
| Bản nháp endpoint GPS | `POST /v1/locations`, `202 Accepted`, theo OpenAPI hiện tại của TV1 |
| Địa chỉ | Bản nháp REST dùng `dropoffAddress/dropoffLocation`; bản nháp UI/dùng chung của TV3 dùng `deliveryAddress/deliveryLocation` |
| Phản hồi danh sách | Bản nháp REST trả `data` và `pagination { limit, hasMore, nextCursor }` |
| Định danh | Bản nháp REST dùng ID có tiền tố và `trackingNumber`; bản nháp TV3 dùng UUID và `trackingCode` |

Bản nháp REST là tài liệu tham khảo để review triển khai API, chưa phải thỏa thuận
tích hợp hoàn chỉnh. TV3/TV4 phải xác nhận trước khi nối UI hay bộ phát
GPS. Tên trong UI/lưu trữ không cần khớp từng chữ với tên JSON: phải có ánh xạ
rõ ràng khi bắt đầu triển khai. Tuần 1 không thêm adapter, migration hay
handler runtime.

## Các đề xuất giữ lại để nhóm review

- `CANCELLED` và `POST /shipments/{id}/cancel` mở rộng mốc nền tảng năm trạng thái.
  Thao tác hủy và schema request ban đầu được giữ dưới
  `x-proposals.cancellation` trong OpenAPI, không phải thao tác nháp đang áp dụng.
  Không thêm trạng thái đó vào enum dùng chung hay database trước khi được duyệt.
- Request GPS bắt buộc có `lat`, `lng`, `clientTimestamp`; `sessionId` (UUID) và
  `seq` là dữ liệu chẩn đoán tùy chọn. API lấy `driverId`
  từ danh tính đã xác thực và thêm `eventId`, `receivedAt`. Số thứ tự dùng
  để chẩn đoán; độ mới dùng `clientTimestamp`, còn khử trùng lịch sử dùng
  `(driverId, clientTimestamp)`. Nội dung này không hàm ý endpoint runtime hay hành vi DB đã có.
- Issue #2 đề xuất ghi database trực tiếp thay cho Pub/Sub. Vẫn cần
  quyết định của nhóm trước khi triển khai nghiệp vụ GPS; đề xuất không bỏ
  mốc Pub/Sub Hello World tuần 1.
- Lưu role, chuyển lỗi sang ProblemDetails, ánh xạ trường/định danh database
  và mã hóa địa lý (#3) vẫn là các quyết định tích hợp cho những tuần sau.
  Phản hồi lỗi Nest hiện có của Auth giữ nguyên trong khung này.

## Role và frontend

Tên role trong OpenAPI, enum Auth, `UserRole` dùng chung và `Role` Prisma đều
chỉ có `CUSTOMER`, `DRIVER`, `ADMIN`. `failedByRole` dùng tên Admin
thay cho tên Dispatcher cũ; phân quyền thao tác vẫn là bản nháp.
Frontend giữ `Admin*` và `/admin`; PR này không đổi UI của TV3.

Schema Prisma và file index kiểu dùng chung giữ bản nháp miền nghiệp vụ
năm trạng thái hiện có của TV3; chỉ loại role cũ. Các trường khác là
thiết kế nháp, chưa phải database đã sinh. Kiểu và kiểm tra dữ liệu GPS hiện theo
hợp đồng sự kiện tuần 2; schema lưu trữ vẫn cần đồng bộ sau.

## Review trước khi triển khai các phần sau

TV1 phụ trách hợp đồng API và bản nháp dữ liệu/dùng chung; TV3/TV4 review các trường client,
phân trang và dữ liệu đo; TV6 review Auth/RBAC; TV5 xác nhận tên tài nguyên
thực tế. Ghi mọi thay đổi được duyệt vào OpenAPI và tài liệu này trong cùng PR.
Test health và các test Auth/Admin của TV6 có thể chạy ngay mà không gọi Firebase.

## TV6 Auth tuần 2 — 17/10/2026

Bổ sung API đã triển khai `GET /v1/auth/me` (ba role) và `GET /v1/admin/me` (ADMIN). Mọi handler mặc định được guard bảo vệ; health public. API nghiệp vụ còn lại vẫn là draft. Custom claims Firebase là nguồn role, có kiểm tra revocation/account hiện tại; không có role Dispatcher riêng hoặc public API cấp quyền. Xem [bàn giao Auth và RBAC](../tv6/auth-rbac-handoff.md) cho claims CLI, cấu hình frontend/runtime, kiểm thử và trạng thái cloud chưa nghiệm thu.


### Review bổ sung Auth tuần 2

API hiện trả ProblemDetails cho lỗi qua ApiExceptionFilter; không còn dùng lỗi Nest mặc định ở runtime AppModule. 401/403 giữ ý nghĩa xác thực/quyền; Firebase/SQL tạm lỗi hoặc chưa cấu hình trả 503. BusinessUserGuard trên vùng Shipment dùng UsersService để nối Firebase UID với user nghiệp vụ; thiếu/lệch linkage trả 409 USER_NOT_PROVISIONED. /auth/me và /admin/me không bắt buộc user SQL. OpenAPI đã ghi nhận các lỗi này. CORS cho Idempotency-Key. Xem docs/contracts/auth-rbac.md mục 12.6 về mapping schema, seed và cloud acceptance còn mở.
