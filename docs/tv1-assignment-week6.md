# TV1 tuần 6 — Đọc đơn và phân công tài xế

Đạt (TV6) thực hiện thay TV1, từ develop tại commit `3110275`.
Nguồn: [đặc tả ParcelFlow v1.3](https://docs.google.com/document/d/1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8/edit),
FR02/FR06/FR10, API02/03/04, SC01/02/03 và TC02.1–4/6.
Tuần 6 theo lịch nhóm: 26/10–01/11/2026.

## Các API đã làm

| API | Quyền và kết quả |
| --- | --- |
| `GET /v1/shipments` | Customer xem đơn mình tạo; Driver xem đơn hiện được gán, kể cả đơn đã kết thúc; Admin xem tất cả. |
| `GET /v1/shipments/:id` | Chi tiết đơn và lịch sử theo thời gian tăng dần. Không có đơn trả 404; ngoài quyền trả 403. |
| `POST /v1/shipments/:id/assign` | Chỉ Admin. Body duy nhất `{ "driverId": "usr_..." }`. Trả 200 và thông tin đơn sau phân công. |

Dùng lại xác thực Firebase, kiểm tra role, liên kết người dùng nghiệp vụ và
nhóm kết nối database `USER_DATABASE`. Không lấy danh tính người thao tác từ
body. Response có `Cache-Control: no-store`; lỗi dùng ProblemDetails hiện có.

Danh sách nhận `limit` mặc định 20, tối đa 100; `status`, `trackingNumber`
đầy đủ và `cursor`. Sắp `createdAt DESC,id DESC`. Cursor giữ vị trí phân trang,
gắn với người dùng và bộ lọc; SQL vẫn kiểm tra quyền ở mỗi request. Giữ độ
chính xác micro giây để không bỏ sót dòng. Tham số lạ, lặp hoặc cursor sai
trả 400. Không trả tổng số đơn hay cam kết dữ liệu cố định qua nhiều trang.

Chi tiết và lịch sử đọc bằng một câu SQL để không ghép trạng thái cũ với tài
xế mới khi có request gán lại chạy đồng thời. Đơn đang xử lý tính `isLate`
theo giờ máy chủ; đơn đã kết thúc dùng thời điểm sự kiện kết thúc. Chưa có
hạn giao trả null, kết thúc đúng hạn trả false.

## Vì sao phân công không bị ghi trùng?

1. Khóa dòng đơn bằng `SELECT ... FOR UPDATE OF s`, rồi kiểm tra trạng thái.
   Chỉ CREATED và ASSIGNED mới được phân công.
2. Kiểm tra tài khoản được chọn tồn tại, có quyền DRIVER. Khóa bằng `FOR SHARE`
   để role không đổi trong lúc giao dịch đang chạy.
3. Nếu vẫn là tài xế hiện tại thì giữ nguyên `updatedAt`, không thêm lịch sử
   hoặc thông báo. Nếu gán mới/đổi tài xế thì ghi ASSIGNED/REASSIGNED.
4. Cùng một kết nối SQL cập nhật đơn, ghi lịch sử và thông báo cho Customer.
   Chỉ trả thành công sau khi cả ba bước đã commit. Một bước lỗi thì hoàn tác
   toàn bộ; lỗi database trả 503 và không lộ SQL.

Request thứ hai chờ khóa rồi đọc dữ liệu đã commit của request trước. Hai
request chọn Driver khác nhau có thể thành công lần lượt vì đặc tả cho phép
gán lại trước khi lấy hàng. Mỗi đơn chỉ có một Driver hiện hành; một Driver
vẫn có thể nhận nhiều đơn.

Không có đơn/tài xế trả 404; tài khoản sai role trả 400; đã lấy hàng hoặc kết
thúc trả 409. Mất phản hồi thì frontend đọc lại chi tiết và yêu cầu người dùng
xác nhận lại ý định gán, không tự gửi lại POST.

## Code và dữ liệu

Controller nhận HTTP; service kiểm tra yêu cầu/quyền; repository xử lý SQL và
giao dịch. Dùng chung phần ánh xạ response. Comment giải thích khóa dòng,
thời điểm lấy giờ máy chủ, đọc cùng phiên bản dữ liệu và xử lý mất phản hồi.

Dùng các bảng `users`, `shipments`, `shipment_status_events`, `notifications`
và tên cột hiện có. Ánh xạ `trackingCode/senderId/delivery*` sang
`trackingNumber/customerId/dropoff*`. Không thêm thư viện hay migration.
File `packages/database/sql/001-create-shipment.sql` chỉ dành cho schema
rỗng/test, không chạy trực tiếp trên Cloud SQL đang có dữ liệu.

## Kiểm thử

Từ gốc repo:

```bash
npm ci --ignore-scripts --prefer-offline
npm run typecheck --workspace=@parcelflow/api
npm run build --workspace=@parcelflow/api
npm run test --workspace=@parcelflow/api
```

Muốn kiểm chứng khóa giữa nhiều kết nối, cấu hình `SHIPMENT_TEST_DATABASE_URL`
trỏ tới database test riêng trên máy tên `parcelflow_shipments_test`, rồi chạy:

```bash
npm run test --workspace=@parcelflow/api -- src/modules/assignments/assignments.postgres.spec.ts
```

Bộ test tự tạo/dọn schema riêng, không dùng `DATABASE_URL` của ứng dụng.
Firebase được giả lập. PGlite chạy SQL thật nhưng xử lý giao dịch lần lượt;
PostgreSQL nhiều connection mới kiểm chứng được việc chờ khóa.

Bộ test kiểm tra quyền, tài xế cũ mất quyền sau gán lại, đầu vào/trạng thái
sai, nhiều đơn cho một Driver, hoàn tác từng bước ghi, mất phản hồi sau commit,
phân trang và giao trễ. Có kiểm tra frontend hiện tại đọc response thật từ
Nest HTTP. Test PostgreSQL giữ giao dịch đầu tại một điểm chờ, quan sát
connection thứ hai chờ khóa trong `pg_stat_activity`, rồi kiểm tra thứ tự gán,
lịch sử và thông báo.

Kết quả bản triển khai ngày 01/11/2026:

- Bộ mới: 69 đạt, 1 bỏ qua với PGlite và PostgreSQL 18.6. Ca bỏ qua là kiểm
  tra chờ khóa không áp dụng cho PGlite.
- Toàn bộ API: 357 đạt, 16 bỏ qua. Gồm 7 ca cần Firebase Emulator, 7 ca Admin
  cần URL PostgreSQL riêng và 2 ca khóa không áp dụng cho PGlite.
- 354 test frontend đạt. Kiểm tra kiểu dữ liệu ở gốc repo và API, build API đạt.
- Lint phần sửa không có lỗi/cảnh báo; toàn repo còn cảnh báo cũ ngoài phạm vi.
- OpenAPI JSON, tham chiếu nội bộ và `git diff --check` đạt.

PostgreSQL kiểm thử chạy riêng trên máy và đã dừng sau khi kiểm tra.
Chưa kết nối database nhóm trong lượt này.

## Bàn giao

TV3 dùng nguyên `getShipments`, `getShipmentById`, `assignShipment` hiện có.
Giữ cách đọc lại chi tiết khi kết quả phân công chưa rõ, không tự retry POST.
TV4 dùng danh sách/chi tiết theo tài khoản Driver hiện hành.

Còn cần triển khai và nghiệm thu trên Cloud: schema/mapping Firebase đúng,
Admin gán/gán lại, Driver xem đúng đơn. Hiệu năng phải đo riêng trên Cloud.
Ca TC02.5 cạnh tranh với Pickup làm sau khi có API Pickup. GPS ingest, Worker,
UI mới và cấp user production nằm ngoài phần này.
