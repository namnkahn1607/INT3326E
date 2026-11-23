# Tuần 10 (23/11–29/11)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: FALSE. Checkpoint nhóm: ETA hoạt động cùng tracking.

## Việc của TV6 theo sheet

QA tính năng ETA, test phân quyền chéo (ranh giới customer/driver/dispatcher/admin).

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W10-TV6-01a | Kiểm ETA cơ bản: đơn vị mét/giây, kết quả hợp lý theo hai điểm | W10-TV2-02 | Kết quả TC09.1 | AC09 | Chưa bắt đầu |
| W10-TV6-01b | Hai điểm giống nhau cho ETA 0; thiếu GPS hoặc GPS cũ cho `null` kèm lý do | W10-TV6-01a | Kết quả TC09.2–09.3 | AC09 | Chưa bắt đầu |
| W10-TV6-01c | Biên tuổi mẫu 0 và 30 giây; chỉ PICKED_UP có ETA; ETA không đổi `expectedDeliveryAt`; không NaN hay Infinity | W10-TV6-01a | Kết quả TC09.4 | AC09 | Chưa bắt đầu |
| W10-TV6-02a | Lập ma trận role × API × quan hệ (chủ đơn, driver được gán) | Toàn bộ API | Bảng ma trận | FR10, AC10, NF09 | Xong 23/11, bảng bên dưới |
| W10-TV6-02b | Thử đoán ID, giả actor trong body, Customer khác, Driver sau reassign | W10-TV6-02a | Kết quả TC10.1–10.3 | AC10, NF09 | Chưa bắt đầu |
| W10-TV6-02c | Token thiếu, hỏng, hết hạn cho 401; sai role cho 403; health vẫn public | Auth tuần 5 | Kết quả theo từng API | AC10 | Test mock đã có, chưa chạy trên Cloud |

## Ma trận quyền chéo (W10-TV6-02a, 23/11/2026)

Lập từ code trên `develop` (`@Roles` ở controller, kiểm chủ đơn và tài xế được gán ở service, repository) và `docs/openapi.json`. Đặc tả chỉ có ba role CUSTOMER, DRIVER, ADMIN; "dispatcher" trong sheet chính là ADMIN. Ô ghi mã HTTP mong đợi khi đã đăng nhập; không token hoặc token hỏng luôn là 401, trừ health.

| API | Customer chủ đơn | Customer khác | Driver được gán | Driver khác / driver cũ sau gán lại | Admin |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/health`, `/v1/healthz` | 200, không cần token | 200 | 200 | 200 | 200 |
| `GET /v1/auth/me` | 200 | 200 | 200 | 200 | 200 |
| `POST /v1/shipments` | 201 | 201 (đơn của chính mình) | 403 | 403 | 403 |
| `GET /v1/shipments` | 200, chỉ đơn của mình | 200, chỉ đơn của mình | 200, chỉ đơn được gán | 200, không thấy đơn đã bị gán đi | 200, tất cả |
| `GET /v1/shipments/{id}` | 200 | 403 | 200 | 403 | 200 |
| `GET /v1/shipments/{id}/tracking` | 200 | 403 | 200 | 403 | 200 |
| `POST /v1/shipments/{id}/assign` | 403 | 403 | 403 | 403 | 200 |
| `POST /v1/shipments/{id}/pickup` | 403 | 403 | 200 | 403 | 403 |
| `POST /v1/shipments/{id}/deliver` | 403 | 403 | 200 | 403 | 403 |
| `POST /v1/shipments/{id}/fail` | 403 | 403 | 200 | 403 | 200 |
| `POST /v1/locations` | 403 | 403 | 202 | 202 (GPS gắn với tài xế, không gắn đơn) | 403 |
| `GET /v1/notifications` | 200, chỉ của mình | 200, chỉ của mình | 403 | 403 | 403 |
| `GET /v1/drivers`, `/v1/admin/customers`, `/v1/admin/me` | 403 | 403 | 403 | 403 | 200 |
| `POST /v1/geocoding/*` | 200 | 200 | 200 | 200 | 200 |

Ca thử thêm theo TC10.1–10.3: đoán ID đơn của người khác (403, không lộ dữ liệu), gửi `customerId`/`driverId` giả trong body tạo đơn (400 vì body không nhận trường lạ), Driver cũ gọi pickup sau khi Admin gán lại (403).

Đã có test: ma trận TC10 trên PostgreSQL thật trong `apps/api/src/qa/shipment-flow.postgres.spec.ts`, ca gán lại và tracking trong `apps/api/src/qa/tracking.postgres.spec.ts`. Trên Cloud 20/11 và 23/11 mới chạy được: không token 401, driver không được gán 403. Còn thiếu trên Cloud: Customer khác và Driver cũ sau gán lại, vì chưa có tài khoản thứ hai đăng nhập được (chờ TV5).

## Đã làm được

- Auth đã có test 401/403 ở mức mock và Emulator (tuần 5).
- Bảng quyền và mã TC09, TC10 đã nằm trong ma trận QA.

## Còn thiếu và rủi ro

- ETA phụ thuộc Haversine của TV2 và UI của TV3.
- Ma trận quyền chéo cần đầy đủ API; các API vòng đời chưa có thì ghi BLOCKED.
