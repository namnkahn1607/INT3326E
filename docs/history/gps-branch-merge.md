# Tích hợp nhánh GPS của Na vào develop

Ngày: 02/11/2026. Baseline develop: `c580efb`; nhánh Na:
`feature/scaffold-gps-worker` tại `99a462a`.

## Phần được giữ lại

Merge giữ lịch sử commit của Na và logic Worker: xử lý message, ghi history,
cập nhật current location, dedupe/ordering và các bài test. Giữ cả bản Prisma
và script tạo manifest của Na; script manifest chỉ in dữ liệu, không chứng minh
đã publish hoặc ghi Cloud SQL. Không chạy migration, không deploy trong lượt này.

## Điều chỉnh để chạy chung

- Module gốc giữ Auth/Admin/Shipment/Assignment/Geocoding hiện có, thêm Location.
- Giữ publisher và luồng chờ broker của Na. Controller chỉ nhận
  `POST /v1/locations`, dùng role DRIVER và BusinessUserGuard; không fallback
  sang Firebase UID hoặc mã Driver do client khai báo.
- DTO nhận đúng lat/lng/clientTimestamp và metadata tùy chọn. Chặn trường thừa,
  kiểm tra seq/sessionId, chuẩn hóa timestamp UTC mili giây trước publish.
  Event đúng EVT01, không chứa alias tọa độ hoặc timestamp phụ.
- Bổ sung dependency Pub/Sub cho gói API và pg cho gói Worker, đồng bộ lockfile.
  Bỏ dependency types chưa dùng của Worker để giữ khả năng build độc lập bằng
  Dockerfile hiện có; không thay cách tổ chức shared types.
- API test chạy bằng runner workspace API hiện hành; root tiếp tục chạy bộ
  Worker/shared/PubSub. Không trộn Nest 11 của API với runner root dùng Nest 12.

## Kiểm chứng local

| Kiểm tra | Kết quả | Giới hạn |
| --- | --- | --- |
| API GPS | 35/35 đạt | 4 ca service/controller của Na và 31 ca HTTP qua AppModule; Firebase, mapping và broker giả lập |
| Toàn bộ API | 399 đạt, 80 bỏ qua | Các ca PostgreSQL riêng/Firebase Emulator có điều kiện chưa chạy |
| Worker/shared/PubSub | 103/103 đạt | Bộ Na và bộ sẵn có; repository dùng bộ nhớ, không phải SQL Cloud |
| Frontend | 438/438 đạt | Local/mock |
| UI → Nest HTTP → SQL | 8/8 đạt | Shipment với PGlite cô lập; không phải GPS Cloud |
| Typecheck | API và root đạt | Không đổi cấu hình để bỏ lỗi |
| Build | API, Worker, frontend đạt | Chưa triển khai |
| Cài/build gói độc lập | API và Worker đạt | Copy package/lock/tsconfig/src vào thư mục riêng, npm ci rồi build; không dựa thư viện hoist của monorepo |

Bộ HTTP chứng minh thiếu/sai role bị chặn, thiếu/sai mapping trả 409 và không
publish; broker lỗi trả 503; chưa xác nhận broker thì chưa trả 202. Event từ
HTTP được đối chiếu bằng validator chung và đưa qua processor của Na.

Môi trường máy dùng Node 26. Frontend lần đầu lỗi do global Web Storage của
Node, chạy lại với `NODE_OPTIONS=--no-experimental-webstorage` đạt 438/438;
không sửa frontend để xử lý khác biệt môi trường. Lint phần Location chỉ còn
cảnh báo hai file scaffold trống đã có từ trước.

## Phần cần nghiệm thu tiếp

Tuần 6 cần TV5 triển khai API/web đúng source, kiểm tra cấu hình Firebase,
CORS, quyền publish và tài khoản Driver có mapping. TV4/TV6 đăng nhập, Start,
đối chiếu eventId của response với message Pub/Sub trên kênh quan sát test;
kiểm tra Stop và lỗi. Không dùng subscription nghiệp vụ để lấy mất message.
202 chỉ xác nhận publish, không xác nhận Worker đã ghi dữ liệu.

Worker SQL thuộc bước nghiệm thu tiếp cùng Na/TV5: code hiện dùng bảng/cột GPS
snake_case; Prisma là bản nháp và không thay thế baseline SQL camelCase của
Shipment/Auth. Cần đối chiếu schema thật, quyền ghi và transaction trên database
thử riêng trước khi triển khai. Repository hiện có fallback bộ nhớ khi thiếu
DATABASE_URL/pg; không coi ACK ở chế độ này là đã lưu bền vững. Cần kiểm chứng
thêm mẫu future retry vẫn dựa receivedAt của bản history đầu tiên. Các bài test
bộ nhớ hiện có chưa chứng minh các điều kiện SQL/Cloud này.

## Chạy lại

Từ gốc repo:

```sh
npm run test --workspace=@parcelflow/api
npm test
NODE_OPTIONS=--no-experimental-webstorage npm run test --workspace=@parcelflow/web
npm run test:integration --workspace=@parcelflow/web
npm run typecheck --workspace=@parcelflow/api
npm run typecheck
npm run build --workspace=@parcelflow/api
npm run build --workspace=@parcelflow/worker
npm run build:web
```
