# Tuần 9 (16/11–22/11)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: FALSE. Checkpoint nhóm: hoàn thành đầy đủ 8 use case bắt buộc. Đặc tả không liệt kê rõ tám use case nào, nhóm cần chốt.

## Việc của TV6 theo sheet

Backend notification (tạo khi đổi trạng thái), backend Admin cơ bản (quản lý driver/account).

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W9-TV6-01a | Xác định các thay đổi trạng thái thật cần thông báo (create, assign, pickup, deliver, fail) | Máy trạng thái FR | Danh sách event và người nhận | FR08 | Xong: create, assign, reassign, pickup, deliver, fail đều có notification kind tương ứng |
| W9-TV6-01b | Tạo đúng một notification mỗi event thật, trong cùng transaction với đổi trạng thái | W9-TV6-01a, API vòng đời (TV1) | Bảng `notifications` có dữ liệu | AC08, TC08.1 | Xong trên `develop` cả create, assign, pickup, deliver, fail (PR #51 đã merge); fail đã kiểm trên Cloud 23/11 |
| W9-TV6-01c | API đọc thông báo theo chủ đơn, Customer khác không đọc được | W9-TV6-01b | `GET /v1/notifications` (API10); không có mark-read theo SC07 và AC08 | AC08, FR10 | Đã có (07/11), test local; Cloud đạt 23/11 |
| W9-TV6-01d | No-op và rollback không tạo thông báo; lỗi đọc không mất bản ghi | W9-TV6-01b | Test cho TC08.1–08.2, REC07 | AC08 | Một phần: no-op và rollback không tạo thêm thông báo đã có test (TV1, TV6) trên PostgreSQL thật; REC07 (lỗi đọc rồi phục hồi) có ca 503 rồi đọc lại trong `notifications.postgres.spec.ts` |
| W9-TV6-02a | Admin cơ bản: danh sách driver và customer, phân trang | Directory tuần 6 | Dùng lại `/v1/drivers`, `/v1/admin/customers` | FR10 | Backend xong. Giao diện: trang Tài xế dùng API thật; trang "Tài khoản và phân quyền" còn dữ liệu cứng, chưa gọi `/v1/admin/customers` |
| W9-TV6-02b | Giữ phạm vi: không CRUD tài khoản, không cấp role qua HTTP | Phần VII | Test ADM15 vẫn đạt | FR10, AC10 | Đã có (không có handler) |

## Việc theo bản giao việc tuần 9

Nguồn: [`docs/coordination/week-09.md`](../coordination/week-09.md), mục TV6.

| Việc | Tình trạng 22/11 |
| --- | --- |
| Review PR của TV1 và TV3 | PR #51 (API07, TV1) đã review, kết quả bên dưới. TV3 chưa có PR nối trang Thông báo |
| Chạy lại AC01–AC08 trên Cloud, thêm AC07 và AC08 | 23/11: AC07 và AC08 đạt trên Cloud, kết quả bên dưới |
| Customer khác, tài xế khác sau gán lại | Chưa chạy: Customer thứ hai `usr_01JDC4…` chỉ có trong DB, không đăng nhập được và không có đơn; tài xế thứ hai `usr_01JDB8…` cũng không có tài khoản đăng nhập. Vẫn chờ TV5 |
| Admin cơ bản: kiểm phần đã có, ghi phần thiếu | Xong, kết quả bên dưới |
| Chốt tuần, PR `week/09` → `main` | Chưa |

### Review PR #51: API07 báo giao thất bại (22/11/2026)

Nhánh `tv1/week9` tại `2e68818`, 9 commit, 12 file. Kết quả: **đạt về code và test, cần cập nhật nhánh trước khi merge**.

| Kiểm tra | Kết quả |
| --- | --- |
| Route `POST /v1/shipments/{id}/fail`, `Cache-Control: no-store`, trả 200 | Đạt |
| Quyền: chỉ DRIVER đang được gán và ADMIN; Customer và tài xế khác 403 | Đạt (service chặn role, repository chặn tài xế không được gán) |
| Chỉ fail được từ PICKED_UP; trước pickup hoặc sau terminal trả 409 | Đạt |
| Body chỉ nhận `reason`, 5–500 ký tự đếm theo ký tự Unicode, cắt khoảng trắng | Đạt |
| Ghi `failureReason`, `failedByUserId`, `failedByRole`, event `DELIVERY_FAILED` có `reason`, notification kind `DELIVERY_FAILED` trong cùng transaction | Đạt |
| Gọi lặp giữ lý do đầu; Deliver đối đầu Fail chỉ một terminal thắng | Đạt. Gộp pickup, deliver, fail vào một hàm `runLockedTransition`, vẫn giữ bản sửa BUG-W8-01 (đọc lại sau khi có khóa) |
| Test | Toàn bộ API trên PostgreSQL thật (loopback): 616 test, 606 đạt, 10 skip, 0 lỗi; typecheck đạt |
| Test của TV6 | TV1 thêm vào `apps/api/src/qa/shipment-flow.postgres.spec.ts`: TC03.4 đầy đủ (10 vòng Deliver đối đầu Fail: một bên 200, một bên 409, đúng một event và một thông báo; Fail lặp đồng thời cùng 200) và ca `fail` trong ma trận quyền TC10. Đã chạy, đạt |
| Cần làm trước khi merge | Nhánh đi sau `develop` 6 commit và xung đột ở `docs/coordination/week-09.md` (chỉ tài liệu). TV1 cần merge `develop` vào nhánh rồi xử lý |

### AC07, AC08 trên Cloud (23/11/2026)

Môi trường: web `https://int3326e.web.app`, API Cloud Run `backend-service`. Ba tab đăng nhập sẵn Customer, Admin, Driver (`usr_01M5SW7617…`). Tạo đơn, gán và lấy hàng gọi API bằng token của đúng vai trò trong tab; bước báo thất bại bấm trên giao diện Driver.

Đơn kiểm thử: `PF20261123Z47ZC6` (`sh_01M83PMPX7PSM20B3PE4WZJNXB`), hạn giao 25/11/2026 14:58.

| Ca | Bước | Kết quả |
| --- | --- | --- |
| Chuẩn bị | Customer tạo đơn có `expectedDeliveryAt`, Admin gán Driver, Driver lấy hàng | 201, 200, 200; trạng thái `PICKED_UP` |
| AC07 | Driver mở chi tiết đơn, bấm "Báo giao thất bại", nhập lý do "Nguoi nhan khong nghe may sau 3 lan goi", xem lại rồi xác nhận | Đạt. Giao diện báo "Máy chủ đã xác nhận giao thất bại" |
| AC07 | Bấm đúp nút "Xác nhận giao thất bại" | Đạt. Chỉ một request `/fail` (200) |
| AC07 | Gửi lại `/fail` qua API với lý do khác | Đạt. 200 theo natural idempotency; lý do, `failedByRole` và `updatedAt` giữ nguyên |
| AC07 | Customer, Admin, Driver mở chi tiết đơn | Đạt. Cả ba thấy "Giao thất bại", lý do, người ghi nhận "Tài xế · usr_01M5SW7617…"; lịch sử có 4 mốc (tạo, gán, lấy hàng, thất bại), mốc thất bại ghi đúng người và lý do, không có mốc trùng; vị trí tài xế đã ẩn |
| AC08 | Customer mở trang Thông báo | Đạt. Có đủ 4 thông báo của đơn: tạo, phân công, lấy hàng, giao thất bại, mỗi loại một lần. Không còn dữ liệu mẫu (BUG-W8-03 đã hết) |
| AC08 | Đứng yên ở trang Thông báo, Customer tạo đơn thứ hai `PF202611232Z96NB` | Đạt. Thông báo "Đã tạo đơn hàng" hiện sau khoảng 10,5 giây, không tải lại trang |
| Bản đồ | Customer mở đơn `ASSIGNED` `sh_01M6C54T5MNE2EZSSSH6DXYD5E` | Đạt. Nền CARTO Voyager hiện đủ, không còn chữ "API KEY REQUIRED" (BUG-W8-02 đã hết) |
| Customer khác | Tìm đơn của Customer thứ hai để mở bằng Customer hiện tại | Không chạy được: Customer thứ hai không có đơn nào |

Dữ liệu để lại: đơn `PF202611232Z96NB` ở trạng thái `CREATED`, ghi chú "TV6 kiem thu AC08 tuan 9".

### Admin cơ bản (W9-TV6-02, 22/11/2026)

| Phần | Đã có | Còn thiếu |
| --- | --- | --- |
| Backend | `GET /v1/drivers` (API11), `GET /v1/admin/customers`, `GET /v1/admin/me`, đều có test mock và SQL | Không thiếu trong phạm vi đã chốt. Không có API tạo, sửa tài khoản hay cấp role qua HTTP, đúng đặc tả |
| Giao diện Tài xế (`/admin/drivers`) | Gọi `GET /v1/drivers` thật, có phân trang | |
| Giao diện Tài khoản (`/admin/accounts`) | | Còn 3 dòng dữ liệu cứng (`tuan.admin@…`, `driver4@…`, `customer1@…`), chưa gọi `/v1/admin/customers`. Cần TV3 nối API, chỉ đọc, không có nút sửa role |
| Cấp role cho tài khoản demo | Công cụ `npm run auth:set-role` cho operator | Tạo tài khoản thứ hai cho ca 403 là việc của TV5 theo bản giao việc |

## Đã làm được

- Danh sách tài xế và khách hàng chỉ đọc đã có từ tuần 6, kèm test.
- Create và assign hiện đã ghi notification trong transaction (code của TV1).
- 07/11: `GET /v1/notifications` (API10): chỉ CUSTOMER, scope theo chủ đơn lấy từ token, sắp xếp `createdAt`/`id` giảm dần, keyset cursor gắn với từng Customer, limit mặc định 20 tối đa 100, 503 không lộ SQL, `Cache-Control: no-store`. Có 16 test HTTP với mock Firebase/SQL và 5 test SQL trên PostgreSQL thật trên máy (cùng bảng `notifications` của file SQL 001). Đã thêm vào `docs/openapi.json`. TV3 dùng hợp đồng này cho UI thông báo (W9-TV3-02).

## Còn thiếu và rủi ro

- 23/11: AC07 và AC08 đạt trên Cloud. Còn thiếu ca Customer khác và tài xế khác mở đơn (403), chờ TV5 tạo tài khoản đăng nhập được cho Customer và Driver thứ hai.
- Trang Tài khoản của Admin còn dữ liệu cứng (TV3).
- Hạng mục quản lý tài khoản dễ mở rộng ngoài phạm vi; chỉ làm phần đã chốt, đổi phạm vi phải qua nhóm.
