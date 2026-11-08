# Driver Frontend & GPS Emitter — Week 1 Specification

| Thuộc tính | Giá trị |
| --- | --- |
| Dự án | ParcelFlow MVP |
| Module | Driver Frontend và GPS emitter |
| Phối hợp kỹ thuật | GPS pipeline: thử nghiệm Pub/Sub; Frontend: khung giao diện Driver; Hạ tầng: GCP |
| Giai đoạn | Tuần 1 |
| Trạng thái tài liệu | Đặc tả phạm vi tuần 1; payload GPS còn là bản nháp |

## 1. Mục tiêu và căn cứ

Phạm vi tuần 1 dựa trên `ParcelFlow - Bảng theo dõi tiến độ.xlsx`, sheet `Tiến độ 10 Tuần`, ô D7:

1. Thử publish/consume thông điệp “hello world” qua Pub/Sub, phối hợp với phần GPS pipeline.
2. Phác thảo component GPS emitter.

Kết quả cần đạt: nhận được thông điệp qua Pub/Sub và có component trên `/driver` tạo payload tọa độ mẫu theo chu kỳ 8 giây, hỗ trợ bắt đầu/dừng và quan sát kết quả.

Checkpoint dự án tuần 1 tại ô F4 còn yêu cầu URL chung truy cập được, health check của hai Cloud Run service trả 200 và topic/subscription tồn tại. Nghiệm thu Driver Frontend và emitter là một phần của checkpoint; bằng chứng triển khai và health check cần được xác nhận riêng.

## 2. Phạm vi

### 2.1. Trong tuần 1

- Thử publish và pull một thông điệp văn bản trên Pub/Sub trong project `int3326e`, phối hợp với phần GPS pipeline.
- Dùng route `/driver` và layout hiện có để hiển thị GPS emitter.
- Dùng tài xế mẫu `demo-driver-1` và tọa độ cố định `{ lat: 21.0285, lng: 105.8542 }`.
- Tạo payload trong trình duyệt, hiển thị mẫu gần nhất và tổng số mẫu đã tạo.
- Cung cấp callback đồng bộ tùy chọn `onEmit` làm điểm nối cho bước tích hợp sau.
- Dọn timer khi dừng, khi dependency thay đổi hoặc khi component bị unmount.

### 2.2. Ngoài phạm vi tuần 1

Đăng nhập Driver, lấy GPS thật, simulator có chuyển động, gắn emitter với trạng thái đơn hàng, gửi GPS qua REST, worker ghi vị trí vào Cloud SQL, retry, dedupe, xử lý out-of-order và load test.

Các mục này được triển khai theo roadmap ở mục 8. Riêng thử nghiệm Pub/Sub và bản phác thảo emitter là hai phép thử độc lập trong tuần 1, chưa tạo thành pipeline GPS từ Driver đến cloud. Frontend publish trực tiếp lên Pub/Sub không thuộc kiến trúc tích hợp của dự án.

## 3. Thử nghiệm Pub/Sub

### 3.1. Điều kiện và dữ liệu thử

| Mục | Giá trị hoặc điều kiện |
| --- | --- |
| Project | `int3326e` |
| Subscription trong ảnh | `hello-test-sub` |
| Tên resource | `projects/int3326e/subscriptions/hello-test-sub` |
| Topic thử nghiệm | Ghi lại topic thực tế mà subscription trên đang gắn vào; ảnh cung cấp chưa hiển thị tên topic |
| Message body | `Hello World` |
| Điều kiện trước khi chạy | Topic và subscription tồn tại; tài khoản thử nghiệm có quyền publish/pull tương ứng |

`gps-events` là tên topic GPS trong kiến trúc và cấu hình mẫu của repo. Chưa có bằng chứng subscription `hello-test-sub` trong ảnh gắn với topic đó; không dùng hai tên này thay thế cho nhau trong biên bản thử nghiệm.

### 3.2. Yêu cầu

| ID | Yêu cầu | Tiêu chí đạt |
| --- | --- | --- |
| PS-01 | Publish thông điệp lên topic thử nghiệm đã xác định. | Lưu tên topic và kết quả publish thành công. |
| PS-02 | Pull thông điệp từ subscription của topic đó. | Message body nhận được là `Hello World`; lưu ảnh hoặc log nhận thông điệp. |
| PS-03 | Ghi nhận kết quả thử nghiệm Pub/Sub. | Có project, topic, subscription, nội dung gửi/nhận, thời điểm thử và kết quả. Nếu có ACK, ghi riêng bằng chứng ACK. |

Việc nhìn thấy message trong màn hình Pull chứng minh bước nhận thông điệp của phép thử. Không suy ra worker đã xử lý message, đã ACK hoặc đã ghi dữ liệu vào DB từ ảnh này.

## 4. Component GPS emitter

### 4.1. Vị trí và giao diện lập trình

- Component: `apps/web/src/features/driver/GpsEmitter.tsx`.
- Trang sử dụng: `apps/web/src/features/driver/DriverPlaceholderPage.tsx`.
- Layout: `apps/web/src/layouts/DriverLayout.tsx`.
- Route: `/driver`, khai báo trong `apps/web/src/App.tsx`.

| Prop | Kiểu | Bắt buộc | Ý nghĩa |
| --- | --- | --- | --- |
| `driverId` | `string` | Có | Định danh tài xế được đưa vào từng payload. Trang mẫu truyền `demo-driver-1`. |
| `onEmit` | `(event: GpsEmitterDraftEvent) => void` | Không | Nhận payload tại mỗi nhịp phát. Tuần 1 chưa gắn callback gửi mạng. |

Luồng xử lý tuần 1:

```text
Bắt đầu → timer 8 giây → tọa độ cố định + timestamp mới
                     → hiển thị payload, tăng số mẫu, gọi onEmit nếu có
Dừng / unmount       → hủy timer
```

### 4.2. Payload nội bộ

| Trường | Kiểu | Quy tắc |
| --- | --- | --- |
| `driverId` | `string` | Lấy từ prop; chỉ cho bắt đầu khi `driverId.trim()` không rỗng. |
| `lat` | `number` | Vĩ độ theo độ thập phân; mẫu cố định `21.0285`, thuộc khoảng `[-90, 90]`. |
| `lng` | `number` | Kinh độ theo độ thập phân; mẫu cố định `105.8542`, thuộc khoảng `[-180, 180]`. |
| `clientTimestamp` | `string` | Thời điểm tạo mẫu bằng `new Date().toISOString()`, định dạng ISO 8601 UTC. |

Ví dụ minh họa, không phải log thử nghiệm:

```json
{
  "driverId": "demo-driver-1",
  "lat": 21.0285,
  "lng": 105.8542,
  "clientTimestamp": "2026-10-09T02:00:08.000Z"
}
```

Kiểu `GpsEmitterDraftEvent` là dữ liệu nội bộ của bản phác thảo. `GpsTelemetryEvent` trong `packages/types/src/index.ts` còn có `eventId`, `seq`, `receivedAt`. Phần Driver Frontend và GPS pipeline cần thống nhất contract GPS và nơi tạo từng trường ở tuần 2; payload bốn trường trên chưa phải schema REST hoặc Pub/Sub chính thức. Kiểm tra tọa độ stale/invalid thuộc tuần 5; tọa độ cố định hợp lệ chưa đủ để xác nhận việc xử lý các trường hợp này.

### 4.3. Yêu cầu hành vi và giao diện

| ID | Yêu cầu | Tiêu chí đạt |
| --- | --- | --- |
| GPS-01 | Khởi tạo ở trạng thái dừng. | Hiển thị “Đã dừng”, số mẫu `0`, thông báo chưa có mẫu; nút Dừng bị vô hiệu hóa. |
| GPS-02 | Bắt đầu phát khi người dùng bấm nút và định danh hợp lệ. | Hiển thị “Đang phát mẫu”; nút Bắt đầu bị vô hiệu hóa, nút Dừng được bật. Định danh rỗng hoặc chỉ có khoảng trắng không cho bắt đầu. |
| GPS-03 | Phát theo chu kỳ mục tiêu 8.000 ms. | Không phát ngay khi bấm; nhịp đầu tạo một mẫu sau một chu kỳ, mỗi nhịp sau tăng số mẫu một lần và tạo timestamp mới. |
| GPS-04 | Hiển thị kết quả phát. | Hiển thị JSON của mẫu gần nhất, tài xế mẫu và tổng số mẫu trong lần mount hiện tại. |
| GPS-05 | Dừng phát khi bấm Dừng. | Hủy timer; số mẫu và payload gần nhất giữ nguyên, không tạo thêm mẫu khi tiếp tục chờ. |
| GPS-06 | Bắt đầu lại sau khi dừng. | Chờ một chu kỳ mới rồi phát tiếp; số mẫu tiếp tục tăng từ giá trị đã giữ, không tạo timer trùng. |
| GPS-07 | Dọn tài nguyên đúng vòng đời. | Hủy timer cũ trước khi tạo timer mới khi `running`, `driverId` hoặc `onEmit` thay đổi; hủy timer khi unmount. Mount mới trở về trạng thái ban đầu. |
| GPS-08 | Chạy độc lập với GPS thật và cloud. | Component không xin quyền vị trí, không gửi request GPS, vẫn tạo được mẫu khi chưa nối backend. |

Callback `onEmit` cần giữ reference ổn định nếu phía gọi muốn giữ nhịp phát liên tục. Một render với callback mới sẽ làm effect dọn và tạo lại timer khi đang chạy.

Chu kỳ 8 giây là mục tiêu khi trang hoạt động. Timer có thể bị trì hoãn khi tab ở nền; bản phác thảo chưa cam kết gửi đều trong nền trên điện thoại. Giao diện dùng layout Driver hiện có, có vùng trạng thái `role="status"` và vùng JSON cho phép cuộn ngang.

## 5. Kịch bản nghiệm thu

Chạy `npm run dev:web` tại root repo, mở URL mà Vite in ra và vào `/driver`. Kiểm tra timer khi tab đang hoạt động.

| Ca kiểm tra | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| TC-01 | Mở mới `/driver`. | Trạng thái dừng, số mẫu `0`, chưa có JSON; Bắt đầu bật, Dừng tắt. |
| TC-02 | Bấm Bắt đầu, quan sát trước và sau chu kỳ đầu. | Chưa có mẫu ngay khi bấm; sau khoảng 8 giây có mẫu thứ nhất với đúng bốn trường ở mục 4.2. |
| TC-03 | Chờ thêm một chu kỳ. | Số mẫu thành `2`; tọa độ không đổi, timestamp mới khác timestamp trước. |
| TC-04 | Bấm Dừng, ghi lại JSON và số mẫu, chờ hơn 8 giây. | Trạng thái dừng; JSON và số mẫu không đổi. |
| TC-05 | Bấm Bắt đầu lại, thử bấm lặp và chờ hai chu kỳ. | Nút Bắt đầu bị vô hiệu hóa khi chạy; số mẫu chỉ tăng một lần mỗi nhịp, không tăng theo nhiều timer. |
| TC-06 | Khi đang chạy, chuyển sang route khác rồi quay lại `/driver`. | Instance cũ được dọn; instance mới dừng, số mẫu `0`, chưa có JSON. |
| TC-07 | Kiểm tra prop bằng `driverId` rỗng hoặc chỉ có khoảng trắng trong môi trường phát triển. | Không cho bắt đầu, không tạo mẫu. Không đổi tài xế mẫu trên trang bàn giao. |
| TC-08 | Quan sát quyền vị trí và Network trong lúc phát mẫu. | Emitter không yêu cầu quyền vị trí và không phát sinh request gửi GPS. |
| TC-09 | Publish `Hello World` lên topic đã ghi nhận rồi pull từ subscription tương ứng. | Nhận đúng nội dung; lưu bằng chứng theo PS-01 đến PS-03. |

Kiểm tra kỹ thuật bằng script sẵn có: `npm run lint:web` và `npm run build:web`. Các lệnh và ca kiểm tra trên là kế hoạch nghiệm thu; chỉ xác nhận đạt sau khi chạy và ghi nhận kết quả thực tế.

## 6. Bằng chứng hiện có

| Hạng mục | Bằng chứng được cung cấp hoặc đã đối chiếu | Kết luận |
| --- | --- | --- |
| Subscription | Ảnh danh sách có `hello-test-sub` trong project `int3326e`. | Có bằng chứng subscription tồn tại; cần bổ sung tên topic. |
| Nhận thông điệp | Ảnh Pull hiển thị body `Hello World` và publish time `Oct 8, 2026, 9:26:49 PM`. | Có bằng chứng nhận thông điệp; ảnh chưa cho biết múi giờ. |
| ACK và worker | “Enable ack messages” chưa được chọn trong ảnh; chưa có log xử lý worker. | Chưa có bằng chứng ACK hoặc worker consume bằng code. |
| Giao diện Driver | Ảnh `/driver` hiển thị tài xế mẫu, trạng thái dừng, số mẫu `0` và hai nút điều khiển. | Có bằng chứng trạng thái ban đầu; chưa có ảnh phát mẫu hoặc dừng sau khi phát. |
| Logic emitter | Mã nguồn hiện có timer 8.000 ms, tọa độ cố định, tạo timestamp, callback và cleanup. | Có phần triển khai tương ứng; cần thực thi các ca kiểm tra để kết luận nghiệm thu hành vi. |

## 7. Điều kiện hoàn thành và bàn giao

Phạm vi Driver Frontend và GPS emitter tuần 1 được nghiệm thu khi:

- Có biên bản publish/pull `Hello World`, xác định rõ topic và subscription thực tế.
- GPS emitter trên `/driver` đạt TC-01 đến TC-08, có ảnh hoặc video thể hiện phát ít nhất hai mẫu và dừng phát.
- Lưu kết quả lint/build cùng các lỗi còn tồn tại, nếu có.
- Tài liệu và mã nguồn emitter được bàn giao, ghi rõ payload còn là bản nháp và bước tích hợp tiếp theo.

## 8. Bàn giao sang các tuần sau

| Tuần | Phạm vi phát triển theo bảng tiến độ | Điểm tích hợp |
| --- | --- | --- |
| 2 — D13 | Tiếp tục thử pipeline Pub/Sub, thống nhất schema GPS giữa Driver Frontend và GPS pipeline. | Contract request/event, timestamp, `eventId`, `seq`, `receivedAt` và nơi tạo từng trường. |
| 3 — D19 | Driver login/dashboard skeleton, phát thử GPS event. | Nối driver client với endpoint `POST /location` của backend theo kế hoạch D17 và contract đã thống nhất. |
| 4 — D25 | Kết nối Driver app gửi GPS thật hoặc simulator toggle. | Frontend gọi REST; backend publish Pub/Sub, worker xử lý dữ liệu. |
| 5 — D31 | Xử lý GPS stale/invalid, bắt đầu phác thảo load test. | Chốt cách xử lý lỗi vị trí và lỗi gửi trước khi nghiệm thu pipeline đầy đủ. |

`POST /location` là endpoint trong kiến trúc dự kiến; các file controller/service/DTO của module location hiện còn rỗng. Spec tuần 1 không coi endpoint này đã hoạt động. Theo `frontend-spec.md`, khi tích hợp nghiệp vụ, emitter bắt đầu gửi GPS ở `PICKED_UP` và dừng khi đơn kết thúc (`DELIVERED` hoặc `DELIVERY_FAILED`); bản phác thảo hiện chưa kiểm tra trạng thái đơn hàng.

## 9. Tài liệu tham chiếu

- `ParcelFlow - Bảng theo dõi tiến độ.xlsx`, sheet `Tiến độ 10 Tuần`: D7, F4 và D13/D19/D25/D31.
- [Đặc tả frontend](frontend-spec.md): route Driver, luồng trạng thái và chu kỳ GPS.
- [Thiết kế frontend](frontend-design.md): frontend giao tiếp REST và kiến trúc Pub/Sub.
- [README](../README.md): kiến trúc GPS và roadmap MVP.
- [GpsEmitter.tsx](../apps/web/src/features/driver/GpsEmitter.tsx) và [types dùng chung](../packages/types/src/index.ts): đối chiếu hành vi và payload hiện có.
