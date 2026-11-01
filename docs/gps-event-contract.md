# Hợp đồng sự kiện vị trí GPS

## Phạm vi và trạng thái

Contract được đồng bộ theo [PF SPEC 01 nội dung v1.3](spec-baseline.md), VI.API00/API08/EVT01 và VII.3. Type thực thi nằm tại `packages/types/src/gps.ts`; REST được mô tả trong `docs/openapi.json`. Review độc lập của người phụ trách GPS pipeline còn mở. API ingest và worker ghi vị trí chưa được triển khai.

Luồng tích hợp: Driver gửi `POST /v1/locations` qua REST, API publish JSON UTF-8 lên Pub/Sub, worker đọc sự kiện. Frontend không giữ credentials hay publish trực tiếp lên Pub/Sub. API chỉ trả `202 Accepted` sau khi publish thành công; phản hồi này chưa chứng minh dữ liệu đã được ghi vào Cloud SQL.

## Request của client

```json
{
  "lat": 21.0285,
  "lng": 105.8542,
  "seq": 1,
  "clientTimestamp": "2026-10-16T10:00:00.000Z"
}
```

| Trường | Kiểu và giới hạn | Nguồn |
| --- | --- | --- |
| `lat` | JSON number hữu hạn, từ -90 đến 90, bao gồm hai biên | Tọa độ đo hoặc simulator của client |
| `lng` | JSON number hữu hạn, từ -180 đến 180, bao gồm hai biên | Tọa độ đo hoặc simulator của client |
| `seq` | Tùy chọn; số nguyên từ 1 đến 2147483647 | Client tăng theo từng mẫu trong cùng vòng đời emitter; phù hợp cột PostgreSQL `Int` hiện có |
| `sessionId` | Tùy chọn; UUID | Phiên client nếu có, chỉ phục vụ chẩn đoán |
| `clientTimestamp` | ISO 8601 có timezone, ngày giờ hợp lệ | Thời điểm đo mẫu trên client; giữ nguyên khi retry |

Ba trường `lat`, `lng`, `clientTimestamp` là bắt buộc. Không ép kiểu chuỗi thành số, không nhận `null`, không nhận trường thừa. Request không chứa `driverId`, `role`, `eventId` hoặc `receivedAt`. API phải lấy tài xế từ danh tính Driver đã xác thực và ánh xạ sang định danh tài xế nội bộ; không tin định danh do client tự khai báo. Quy tắc xác thực/phân quyền sẽ được thực hiện cùng endpoint.

API chuẩn hóa timestamp sang UTC mili giây trước hash/dedupe/publish, cắt phần nhỏ hơn mili giây và không làm tròn. Ví dụ `2026-10-16T17:00:00.123456+07:00` thành `2026-10-16T10:00:00.123Z`. Validator request chỉ kiểm tra đầu vào, không thay đổi payload; validator event yêu cầu timestamp đã canonical hóa dạng `YYYY-MM-DDTHH:mm:ss.SSSZ`. Chuẩn hóa tại API thuộc bước tích hợp endpoint.

## Event nội bộ

```json
{
  "eventId": "gps-example-001",
  "driverId": "demo-driver-1",
  "lat": 21.0285,
  "lng": 105.8542,
  "seq": 1,
  "clientTimestamp": "2026-10-16T10:00:00.000Z",
  "receivedAt": "2026-10-16T10:00:00.120Z"
}
```

Event bắt buộc có sáu trường `eventId`, `driverId`, `lat`, `lng`, `clientTimestamp`, `receivedAt`; `seq` và `sessionId` là metadata tùy chọn. API bổ sung:

| Trường | Kiểu và quy tắc | Bên tạo |
| --- | --- | --- |
| `eventId` | Chuỗi định danh opaque, không rỗng, không có khoảng trắng đầu/cuối; duy nhất cho mỗi lần API tiếp nhận | API; có thể dùng UUID, consumer không phụ thuộc prefix hoặc định dạng UUID |
| `driverId` | Chuỗi định danh nội bộ không rỗng, không có khoảng trắng đầu/cuối | API từ ngữ cảnh xác thực |
| `receivedAt` | UTC mili giây, cùng định dạng canonical của `clientTimestamp` trong event | API lấy một lần khi tiếp nhận request |

Giữ nguyên event khi retry publish. Pub/Sub gán `messageId` riêng; `messageId` không thay thế `eventId`. Timestamp, sequence và event ID trong JSON không thay đổi khi broker redeliver. Payload không có shipment ID: vị trí thuộc tài xế; kiểm tra quyền xem qua đơn hàng thuộc read path.

## Thứ tự và tính lặp

- `clientTimestamp` quyết định độ mới của vị trí theo baseline README. Chỉ cập nhật `current_location` khi timestamp lớn hơn giá trị đang lưu. Timestamp bằng nhau không ghi đè vị trí hiện tại.
- Dedupe lịch sử theo cặp `(driverId, clientTimestamp)` như README. Nếu cùng cặp nhưng tọa độ khác nhau, giữ bản đầu tiên; không âm thầm đổi tọa độ. Việc thực thi constraint/transaction thuộc phần worker và schema DB sau này.
- `seq` dùng để quan sát mẫu bị thiếu/lặp trong cùng lần chạy client. Khi tải lại trang hoặc mount emitter mới, `seq` bắt đầu lại từ 1. Sequence nhỏ hơn không phải lý do loại bỏ một timestamp mới hơn. Nếu hết miền số nguyên, cần khởi tạo lại bộ đếm trước khi phát thêm mẫu; không wrap trong cùng vòng đời emitter.
- Retry REST cùng mẫu phải giữ `seq`, timestamp và tọa độ. Mỗi lần API tiếp nhận có thể tạo event ID khác; dedupe theo timestamp vẫn cần thiết. Retry publish cùng lần tiếp nhận phải giữ toàn bộ event, bao gồm `eventId` và `receivedAt`.
- Không giả định Pub/Sub giao đúng thứ tự hoặc đúng một lần. Thử nghiệm duplicate/out-of-order chỉ chứng minh broker vận chuyển nguyên vẹn; chưa chứng minh dedupe/ordering trong DB.
- Validation dùng chung kiểm tra hình dạng và miền dữ liệu. Theo EVT01, API từ chối mẫu vượt `receivedAt` hơn 60 giây; mẫu tương lai trong ngưỡng này chỉ lưu history, không chiếm current/ETA. Worker dùng row history đầu tiên và `receivedAt` gốc để xét điều kiện, không biến mẫu future thành eligible bằng lần nhận sau. Chính sách này được thực thi khi tích hợp API/Worker; validator tuần 2 không coi đó là logic đã triển khai.

`sessionId` không quyết định mẫu thắng. Phiên mới không được làm vị trí lùi về timestamp cũ hơn.

## Ánh xạ và bàn giao

Emitter độc lập tạo bốn trường request và có thể chỉ xem payload. Dashboard `/driver` hiện nối callback gửi REST bằng phiên Driver, hiển thị trạng thái HTTP 202 theo `AsyncAcceptedResponse`; API ingest vẫn chưa được triển khai trong checkout này. Xem [bàn giao Driver/GPS](driver-dashboard-gps.md) để kiểm chứng và phân biệt mock/local/cloud. API bổ sung ba trường server trước publish. Worker cần dùng cùng type/validation khi triển khai consumer nghiệp vụ. `CurrentLocation` hiện chưa có `clientTimestamp`, lịch sử chưa có unique constraint theo cặp dedupe; contract không coi schema Prisma hiện tại đã đáp ứng các invariant này. Không sửa migration hoặc triển khai worker trong phạm vi tuần 2.

Các mục cần review độc lập: định danh nội bộ từ Auth, ánh xạ timestamp vào schema lưu trữ, constraint dedupe và việc áp dụng chính sách clock skew đã chốt. Người phụ trách GPS pipeline xác nhận review qua quy trình nhóm; tài liệu này không ghi nhận thay cho người đó.

## Kiểm chứng và tham chiếu

Xem [quy trình kiểm thử Pub/Sub](gps-pipeline-validation.md) cho lệnh chạy, ma trận kiểm thử và mức bằng chứng; [Driver dashboard/GPS](driver-dashboard-gps.md) mô tả phần client, còn [baseline](spec-baseline.md) dẫn nguồn yêu cầu và lịch triển khai.

Pub/Sub emulator cung cấp môi trường thử cục bộ và có thể khác dịch vụ thật; cấu hình Node.js dùng `PUBSUB_EMULATOR_HOST` theo [hướng dẫn Google Cloud](https://docs.cloud.google.com/pubsub/docs/emulator). Việc NACK để yêu cầu giao lại dùng `modifyAckDeadline` với deadline bằng 0 theo [Pub/Sub API](https://docs.cloud.google.com/pubsub/docs/reference/rest/v1/projects.subscriptions/modifyAckDeadline).
