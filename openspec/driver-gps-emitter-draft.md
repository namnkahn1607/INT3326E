# Phác thảo component GPS emitter — TV4, tuần 1

## Phạm vi

Bảng phân công `ParcelFlow - Bảng theo dõi tiến độ.xlsx`, sheet `Tiến độ 10 Tuần`, ô D7 giao TV4 hai việc: test Pub/Sub “hello world” cùng TV2 và phác thảo GPS emitter. Tài liệu và component này thực hiện riêng phần phác thảo emitter theo yêu cầu.

Component nằm tại `apps/web/src/features/driver/GpsEmitter.tsx`, được gắn vào khung `/driver` hiện có. Bản mẫu dùng tọa độ cố định, chỉ tạo và hiển thị payload trong trình duyệt. Không yêu cầu quyền vị trí, đăng nhập hoặc kết nối cloud.

## Giao diện component

| Đầu vào | Ý nghĩa |
| --- | --- |
| `driverId: string` | Định danh tài xế. Trang mẫu truyền `demo-driver-1`, không dùng tài khoản thật. |
| `onEmit?: (event: GpsEmitterDraftEvent) => void` | Điểm nối đồng bộ để nhận mẫu ở phía gọi component. Chưa gắn transport REST. |

Payload nội bộ tạm thời gồm `driverId`, `lat`, `lng`, `clientTimestamp` (ISO 8601 UTC). Tên trường theo kiểu camelCase đang dùng trong `packages/types/src/index.ts`. Đây chưa phải hợp đồng API hay schema Pub/Sub đã chốt. `GpsTelemetryEvent` hiện có còn chứa `eventId`, `seq`, `receivedAt`; cần thống nhất với TV2 cách tạo và trách nhiệm từng trường ở tuần 2 trước khi nối API.

```text
Tọa độ mẫu → timer 8 giây → payload tạm → hiển thị / callback onEmit
```

## Vòng đời

- Ban đầu dừng; chỉ bắt đầu khi bấm “Bắt đầu phát mẫu” và có `driverId`.
- Mẫu đầu tiên xuất hiện sau 8 giây; mỗi nhịp tạo timestamp mới và tăng số mẫu.
- Bấm “Dừng” hoặc rời trang sẽ hủy timer. Payload gần nhất và tổng số mẫu được giữ khi dừng; bật lại chờ một chu kỳ mới.
- Khi `driverId` hoặc callback thay đổi, effect hủy timer cũ trước khi tạo timer mới. Phía gọi cần giữ callback ổn định nếu muốn giữ nhịp liên tục.
- Cleanup timer tuân theo [vòng đời effect của React](https://react.dev/reference/react/useEffect), kể cả khi chạy dưới Strict Mode.

## Các điểm tích hợp sau tuần 1

- Tuần 2 (D13): cùng TV2 chốt schema, timestamp, định danh sự kiện và thứ tự sự kiện.
- Tuần 3 (D19): nối driver client phát thử GPS event theo contract thống nhất.
- Tuần 4 (D25): thay nguồn mẫu bằng browser geolocation hoặc simulator, nối REST `POST /location` theo kiến trúc hiện có. Frontend không gọi Pub/Sub trực tiếp.
- Khi nối nghiệp vụ: chỉ phát trong `PICKED_UP`; dừng khi `DELIVERED`, `DELIVERY_FAILED`, đăng xuất hoặc rời trang, theo `frontend-spec.md`.
- Tuần 5 (D31): xử lý vị trí stale/invalid và các lỗi emitter. Quyền vị trí, timeout, lỗi mạng và retry cần được thiết kế khi tích hợp thật.

Timer trình duyệt có thể bị trì hoãn khi tab ở nền; 8 giây là chu kỳ mục tiêu của bản mẫu, chưa phải cam kết chạy nền trên điện thoại.

## Cách kiểm tra bản phác thảo

1. Từ root repo chạy `npm run dev:web`, mở `/driver`.
2. Kiểm tra trang ban đầu dừng, chưa có payload.
3. Bấm bắt đầu, chờ 8 giây: xuất hiện payload có tài xế mẫu, tọa độ mẫu và timestamp. Chờ thêm 8 giây: số mẫu tăng, timestamp đổi.
4. Bấm dừng, chờ hơn 8 giây: payload và số mẫu giữ nguyên. Bật lại: chỉ có một nhịp phát mỗi 8 giây.
5. Rời `/driver` rồi quay lại: component trở về trạng thái dừng, số mẫu bằng 0.
6. Bản mẫu không tạo request vị trí hay request mạng để gửi GPS.

Kiểm tra mã nguồn bằng các script có sẵn: `npm run lint:web` và `npm run build:web`.
