# Hợp đồng sự kiện vị trí GPS

## Phạm vi và trạng thái

Contract tích hợp được lựa chọn ngày 16/10/2026 theo phạm vi tuần 2 và quyết định kỹ thuật được người yêu cầu ủy quyền. Type thực thi nằm tại `packages/types/src/gps.ts`; REST được mô tả trong `docs/openapi.json`. Review độc lập của người phụ trách GPS pipeline còn mở. API ingest và worker ghi vị trí chưa được triển khai.

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
| `seq` | Số nguyên từ 1 đến 2147483647 | Client tăng theo từng mẫu trong cùng vòng đời emitter; phù hợp cột PostgreSQL `Int` hiện có |
| `clientTimestamp` | UTC dạng `YYYY-MM-DDTHH:mm:ss.sssZ`, ngày giờ hợp lệ, đúng kết quả `Date.toISOString()` | Thời điểm đo mẫu trên client |

Cả bốn trường là bắt buộc. Không ép kiểu chuỗi thành số, không nhận `null`, không nhận trường thừa. Request không chứa `driverId`, `eventId`, `receivedAt` hoặc `sessionId`. API phải lấy tài xế từ danh tính Driver đã xác thực và ánh xạ sang định danh tài xế nội bộ; không tin định danh do client tự khai báo. Quy tắc xác thực/phân quyền sẽ được thực hiện cùng endpoint.

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

Event có đúng bảy trường, gồm request cùng ba trường API bổ sung:

| Trường | Kiểu và quy tắc | Bên tạo |
| --- | --- | --- |
| `eventId` | Chuỗi định danh opaque, không rỗng, không có khoảng trắng đầu/cuối; duy nhất cho mỗi lần API tiếp nhận | API; có thể dùng UUID, consumer không phụ thuộc prefix hoặc định dạng UUID |
| `driverId` | Chuỗi định danh nội bộ không rỗng, không có khoảng trắng đầu/cuối | API từ ngữ cảnh xác thực |
| `receivedAt` | UTC chuẩn như `clientTimestamp` | API lấy một lần khi tiếp nhận request |

Giữ nguyên event khi retry publish. Pub/Sub gán `messageId` riêng; `messageId` không thay thế `eventId`. Timestamp, sequence và event ID trong JSON không thay đổi khi broker redeliver. Payload không có shipment ID: vị trí thuộc tài xế; kiểm tra quyền xem qua đơn hàng thuộc read path.

## Thứ tự và tính lặp

- `clientTimestamp` quyết định độ mới của vị trí theo baseline README. Chỉ cập nhật `current_location` khi timestamp lớn hơn giá trị đang lưu. Timestamp bằng nhau không ghi đè vị trí hiện tại.
- Dedupe lịch sử theo cặp `(driverId, clientTimestamp)` như README. Nếu cùng cặp nhưng tọa độ khác nhau, giữ bản đầu tiên; không âm thầm đổi tọa độ. Việc thực thi constraint/transaction thuộc phần worker và schema DB sau này.
- `seq` dùng để quan sát mẫu bị thiếu/lặp trong cùng lần chạy client. Khi tải lại trang hoặc mount emitter mới, `seq` bắt đầu lại từ 1. Sequence nhỏ hơn không phải lý do loại bỏ một timestamp mới hơn. Nếu hết miền số nguyên, cần khởi tạo lại bộ đếm trước khi phát thêm mẫu; không wrap trong cùng vòng đời emitter.
- Retry REST cùng mẫu phải giữ `seq`, timestamp và tọa độ. Mỗi lần API tiếp nhận có thể tạo event ID khác; dedupe theo timestamp vẫn cần thiết. Retry publish cùng lần tiếp nhận phải giữ toàn bộ event, bao gồm `eventId` và `receivedAt`.
- Không giả định Pub/Sub giao đúng thứ tự hoặc đúng một lần. Thử nghiệm duplicate/out-of-order chỉ chứng minh broker vận chuyển nguyên vẹn; chưa chứng minh dedupe/ordering trong DB.
- Validation contract chỉ kiểm tra hình dạng và miền dữ liệu. Chính sách stale, clock skew hoặc đồng hồ client chạy sai chưa được chốt; phải được xác định trong phạm vi xử lý GPS invalid/stale trước khi tích hợp nghiệp vụ đầy đủ. Không dùng `receivedAt` thay cho thời điểm đo để tuyên bố vị trí mới hơn.

Proposal `sessionId` và quy tắc phiên mới luôn thắng bị loại khỏi contract GPS vì có thể tái kích hoạt một phiên cũ đến muộn. Quyết định này thay thế proposal trong OpenAPI, không thay đổi các contract shipment, role hoặc database khác.

## Ánh xạ và bàn giao

Emitter mẫu trên `/driver` tạo bốn trường request, hiển thị định danh mẫu riêng và chưa gọi REST. API bổ sung ba trường server trước publish. Worker cần dùng cùng type/validation khi triển khai consumer nghiệp vụ. `CurrentLocation` hiện chưa có `clientTimestamp`, lịch sử chưa có unique constraint theo cặp dedupe; contract không coi schema Prisma hiện tại đã đáp ứng các invariant này. Không sửa migration hoặc triển khai worker trong phạm vi tuần 2.

Các mục cần review độc lập: định danh nội bộ từ Auth, ánh xạ timestamp vào schema lưu trữ, constraint dedupe và chính sách clock skew. Người phụ trách GPS pipeline xác nhận review qua quy trình nhóm; tài liệu này không ghi nhận thay cho người đó.

## Kiểm chứng và tham chiếu

Xem [quy trình kiểm thử Pub/Sub](gps-pipeline-validation.md) cho lệnh chạy, ma trận kiểm thử và mức bằng chứng. Phạm vi và tác vụ nằm ở mục 10 của [đặc tả Driver và GPS emitter](../openspec/driver-gps-emitter-draft.md).

Pub/Sub emulator cung cấp môi trường thử cục bộ và có thể khác dịch vụ thật; cấu hình Node.js dùng `PUBSUB_EMULATOR_HOST` theo [hướng dẫn Google Cloud](https://docs.cloud.google.com/pubsub/docs/emulator). Việc NACK để yêu cầu giao lại dùng `modifyAckDeadline` với deadline bằng 0 theo [Pub/Sub API](https://docs.cloud.google.com/pubsub/docs/reference/rest/v1/projects.subscriptions/modifyAckDeadline).
