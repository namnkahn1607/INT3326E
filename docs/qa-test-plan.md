# ParcelFlow — QA test plan (draft)

TV6 chủ trì. Ngày soạn: 23/10/2026. Baseline đọc:
`develop@52b4cf25dcbadd64fe8796b8f806c27df857f409` và PF SPEC 01 v1.3,
Phần III AC01–AC10, VI.14, AUTH01/API11/SC01/SC06, VII tuần 3.
Kế hoạch này mô tả expected result; không mặc định các case đã đạt trên cloud.

## Phạm vi đợt này

- Kiểm chứng Admin directory, Auth/RBAC, business linkage, phân trang và quyền
  xem vị trí. Tách test mock, SQL cục bộ và smoke trên revision đã deploy.
- Chuẩn bị QA Assign/reassign và publisher tuần 3 cùng chủ component.
- Các action vòng đời, GPS persistence/ACK, tracking, notification và ETA được
  lên lịch theo checkpoint của đặc tả; không yêu cầu hoàn thành toàn dự án ở
  đợt Admin skeleton. Accounts giữ scaffold, không test CRUD/cấp role qua UI.

## Dữ liệu và điều kiện chạy

| Fixture | Mục đích |
| --- | --- |
| A: Admin; C1/C2: Customer; D1/D2/D3: Driver | Firebase claim và users.role khớp; ID nội bộ khác UID |
| A-missing / A-mismatch | Token Admin hợp lệ nhưng row thiếu/role lệch → 409 |
| D1 có ASSIGNED và PICKED_UP, kèm đơn terminal | Count đúng 2, không đếm terminal hoặc nhân bản row sau join |
| D2 chỉ có terminal nhưng vẫn còn current GPS | Count 0; không lộ vị trí/timestamp/stale |
| D3 có active nhưng chưa có current | Missing → toàn bộ field vị trí null, không thay bằng 0,0 |
| Mẫu fresh/stale/future và tọa độ 0,0 | Tuổi 0/30s/30s+1ms/-1ms; ghi rõ clock fixture |
| Nhiều row cùng createdAt; khác nhau dưới 1ms | Keyset không trùng/bỏ sót trong dữ liệu ổn định |
| Database/schema test riêng | Không sử dụng dữ liệu thật cho case lỗi/schema drift/mutation |

Firebase production dùng tài khoản demo đã cấp role; operator đăng nhập qua
Terminal/trình duyệt. Không đưa password, ID token, refresh token, ADC hoặc DSN
vào Git/bằng chứng. Đối chiếu UID với ID nghiệp vụ bằng dữ liệu được phép đọc.
Đối với cloud, TV5 cung cấp source/revision, migration/schema, runtime SA và
kết nối; TV1/TV2 xác nhận DATA01/02/04 đã được áp dụng.

## Ma trận Admin directory

| ID | Thao tác / tiền điều kiện | Expected result | Tầng kiểm tra |
| --- | --- | --- | --- |
| ADM01 | Không token hoặc token sai/hết hạn gọi hai danh sách | 401 UNAUTHENTICATED; không đọc SQL khi Auth fail | HTTP mock + cloud |
| ADM02 | CUSTOMER/DRIVER gọi hai danh sách | 403 FORBIDDEN_RESOURCE; không đọc danh sách | HTTP mock + cloud |
| ADM03 | ADMIN thiếu/lệch users linkage | 409 USER_NOT_PROVISIONED; không tự tạo user/đổi claim | HTTP mock + SQL test + cloud |
| ADM04 | ADMIN hợp lệ đọc hai danh sách | 200; drivers chỉ DRIVER, customers chỉ CUSTOMER; no-store | HTTP mock + SQL test + cloud |
| ADM05 | Danh sách không có dữ liệu | data=[]; hasMore=false, nextCursor=null; không 404 | HTTP mock + SQL test |
| ADM06 | limit thiếu/1/100; 0/101/số thập phân/query lặp | Default 20; hợp lệ giới hạn trang; còn lại 400 | Unit + HTTP |
| ADM07 | Cursor qua nhiều trang, tie createdAt/id và microsecond | Thứ tự giảm dần; không lặp/bỏ sót trong fixture ổn định; lookahead không lộ | Unit + SQL test |
| ADM08 | Cursor hỏng/sai version/scope/ID/thời gian; role/uid field lạ | 400 VALIDATION_ERROR; cursor không đổi quyền/scope | Unit + HTTP |
| ADM09 | Một driver có nhiều đơn với đủ năm state | Count chỉ ASSIGNED/PICKED_UP; mỗi driver một row; không N+1 | SQL test |
| ADM10 | Không active hoặc missing current | Tọa độ, hai timestamp và stale cùng null | HTTP mock + SQL test + cloud |
| ADM11 | Fresh/stale/future; 0,0; clientTimestamp khác receivedAt | Stale theo client time; receivedAt là lastLocationUpdatedAt; ISO UTC ms | HTTP mock + SQL test |
| ADM12 | Reassign/terminal commit giao nhau với lần đọc | Count và GPS cùng snapshot; read sau commit áp dụng privacy mới | PostgreSQL đa kết nối + cloud |
| ADM13 | SQL lỗi, schema thiếu timestamp hoặc chưa cấu hình pool | 503 SERVICE_UNAVAILABLE; không trả 200 rỗng; không lộ SQL/secret | HTTP mock + SQL test |
| ADM14 | Xem JSON hai danh sách | Không firebaseUid/credential/claim; Driver không email/profile ngoài SC06; không total/onlineFlag | HTTP mock + SQL test |
| ADM15 | POST/PATCH tài khoản hoặc gán role qua HTTP | Không có handler trong phạm vi này | HTTP |
| ADM16 | /healthz và /admin/me khi SQL chưa provision | Health public; /admin/me vẫn chỉ cần Firebase ADMIN | Regression HTTP |
| ADM17 | Hosting preflight, login/logout/reload, đổi trang danh sách | CORS origin đúng; token hợp lệ; role guard backend vẫn quyết định; UI loading/empty/error rõ | Browser/cloud, TV3 + TV5 |

ADM12 cần PostgreSQL đa kết nối thực; test SQL trên WASM/PGlite hoặc test mock
không đủ để xác nhận race/snapshot giữa các transaction cạnh tranh.

## Checkpoint nghiệp vụ và đầu mối

Các ID TC dưới đây giữ nguyên của VI.14; không ghi pass khi handler chưa có.

| Checkpoint | Case từ đặc tả | Nội dung cần đối chiếu | Chủ component / TV6 |
| --- | --- | --- | --- |
| Create/Auth nền | TC01.1–TC01.6, TC10.1–TC10.3 | Create nguyên tử shipment/history/notification/idempotency; retry snapshot 201; actor từ token; 401/403/409 | TV1/TV3; TV6 rà quyền và rollback |
| Assign tuần 3 | TC02.1 | Admin gán D1: 200 ASSIGNED; Customer/Driver 403; event/notification đúng một lần | TV1/TV3/TV6 |
| Assign tuần 3 | TC02.2 | Gán lại cùng driver là no-op, giữ thời gian/history/notification | TV1, TV6 đối chiếu SQL |
| Reassign tuần 3 | TC02.3 | D2 thay D1 trước pickup; driver cũ mất scope; history trước/sau đúng | TV1/TV3/TV6 |
| Validation tuần 3 | TC02.4 | Sau pickup/terminal →409; driver không tồn tại →404; sai role →400 | TV1/TV6 |
| Mất response tuần 3 | TC02.6 | Client GET Detail, hiển thị driver/state mới; không tự retry Assign | TV3/TV1 |
| Publisher tuần 3 | TC04.1–TC04.2 | Chỉ DRIVER, actor server, validation; broker confirm mới 202; lỗi/timeout 503 | TV1/TV2/TV6 |
| Vòng đời tuần 4 | TC02.5, TC03.1–TC03.4, TC07.1–TC07.2 | Assign/Pickup race; owner/driver; deliver/fail chỉ một terminal, retry không thêm tác động | TV1/TV4; TV6 rà quyền/race |
| GPS persist tuần 4–5 | TC04.3–TC04.8 | Dedupe, first-write-wins, timestamp/order, future, buffer, ACK sau commit và recovery | TV2/TV4/TV5; TV6 đối chiếu manifest |
| Tracking tuần 5 | TC05.1–TC05.3 | Scope, snapshot, GPS terminal/reassign, null/stale, polling cleanup | TV1/TV3/TV6 |
| History/ngoại lệ tuần 6 | TC06.1, TC07.3, TC08.1–TC08.2 | History/late/notification đúng owner; no-op/rollback không thêm thông báo | TV1/TV3/TV6 |
| ETA tuần 7 | TC09.1–TC09.4 | Haversine/ceil/0 distance/30s boundary; null reason; không đổi deadline | TV2/TV3/TV4; TV6 rà case biên |
| Hồi quy tích hợp tuần 8 | TC10.1–TC10.3 và các case đã đến checkpoint | Quyền trên read/write/retry; Firebase/SQL/PubSub lỗi và phục hồi | TV6 + chủ component |

Assignment chưa có handler trên baseline này. Các test với controller probe/mock
không chứng minh API04, ownership Shipment, ghi history hoặc notification đã chạy.
TV6 không tạo handler Assign/GPS thay chủ component chỉ để đánh dấu QA đạt.

## Cách chạy và ghi kết quả

Các lệnh tự động, điều kiện SQL test nằm ở [Admin directory](tv6-admin-directory.md#kiểm-tra).
Unit/HTTP thường chạy cùng `npm test` tại `apps/api`; Firebase Emulator và SQL
integration opt-in phải ghi rõ đã chạy hay skip. Build/typecheck pass không thay
nghiệm thu cloud hoặc đo NFR.

Mỗi lượt chạy ghi một dòng theo mẫu dưới đây vào PR/test run gắn với source SHA:

| Case/version | Môi trường / source / revision / migration | Fixture và actor | Expected / actual | Kết quả | Bằng chứng / defect |
| --- | --- | --- | --- | --- | --- |
| ADM04/v1 | Điền theo môi trường đã chạy | ID fixture và role, không token | HTTP + field đã đối chiếu | PASS / FAIL / BLOCKED / NOT RUN | Link output đã lọc hoặc defect |

Đối với cloud, bổ sung ngày giờ, URL API, runtime SA, origin frontend và cấu hình
SQL liên quan trong deployment record của nhóm. Dùng HTTP/SQL log đã lọc để
chứng minh quyền/count/transaction; ảnh UI chỉ chứng minh hành vi giao diện.
Nếu handler, migration hoặc quyền runtime chưa sẵn sàng, ghi BLOCKED cùng owner
và điều kiện chạy lại. Không thay một lỗi 503 bằng dữ liệu mẫu để hoàn tất case.

Đợt này chỉ có thể đóng phần code sau khi build/typecheck và test Admin đạt,
OpenAPI khớp implementation, regression Auth giữ nguyên. Nghiệm thu cloud để mở
đến khi revision mới và DATA01/02/04 thật được kiểm tra; không gộp trạng thái đó
vào kết quả unit/HTTP/SQL local.
