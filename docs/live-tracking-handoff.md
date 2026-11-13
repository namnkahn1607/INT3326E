# Bàn giao frontend tracking — tuần 5

Ngày kiểm tra: 30/10/2026. Code frontend đang local, chưa commit/push/deploy.
Nguồn yêu cầu: [PF SPEC 01 v1.3](spec-baseline.md), VII.6 và [tracking](live-tracking.md).
Đã fetch origin; kiểm tra remote refs, đặc biệt develop `9ee7c10`, Driver `ca63f3a`,
Worker riêng `0d8ff4b`. Source ref không xác nhận revision đang chạy trên Cloud.

## Phần frontend đã có

- Tracking trong Customer/Admin Detail dùng API09, bản đồ thật và polling nối tiếp 5s.
- GPS mới/cũ/thiếu, reassign, terminal, lỗi/quyền và thời điểm cập nhật; không GPS giả.
- Terminal từ action/Detail dừng panel ngay; lỗi đọc không giữ marker như live.
- Admin live-map dùng API11 theo trang20/cursor, filter GPS và pager; bỏ fleet mẫu.
- Cleanup khi đổi route/đơn/account/cursor, abort và bỏ response đến muộn.
- Giữ theme Customer sáng/tối, Admin, auth và vòng đời đơn; không thêm dependency.

## Kiểm tra đã chạy

| Kiểm tra | Bằng chứng và giới hạn |
| --- | --- |
| `npm run test --workspace=@parcelflow/web` | 435/435, 34 file; local/mock |
| `npm run lint:web` | Exit0 |
| `npm run build:web` | TypeScript/build exit0; main491.61kB, tracking panel5.73kB, map2.48kB; không cảnh báo >500kB |
| Browser Edge local | 9 view Customer/Admin Detail và fleet ở390/768/1440; Leaflet thật, Auth/API mock riêng; 0 runtime exceptions |
| Browser tình huống | GPS mới/cũ/thiếu/reassign,503/403, terminal dừng polling, pager giữ cursor, route cleanup, sáng/tối và reduced motion đạt |
| Driver/client GPS | 43/43 trong GpsEmitter, DriverPlaceholderPage, locations tests; API được mock |
| GPS contract/PubSub/health | 74/74: packages/types/src/gps.spec.ts, infra/pubsub/gps-smoke.spec.ts, Worker health; broker dùng SDK mock |
| Admin directory | 31/31 tại API admin-directory.spec.ts; Nest HTTP local, Firebase/SQL mock |

Tile là dịch vụ hiện có; kết quả không cam kết tốc độ/sẵn sàng tile bên ngoài.
Không gọi GPS POST thật, không publish Pub/Sub/ghi DB hoặc đổi Cloud IAM.
Các phép kiểm tra mock không chứng minh GPS đã lưu SQL hoặc Cloud end-to-end đạt.

## Readiness backend và Driver

| Thành phần | Kết quả đối chiếu source |
| --- | --- |
| Driver Start/Stop | Có mẫu đầu sau8s, timer8s; Stop/unmount dừng mẫu mới. Payload đúng lat/lng/clientTimestamp/seq, không tự gửi driverId/role |
| Tọa độ Driver | Mẫu cố định21.028511,105.804817; chưa chứng minh marker di chuyển hoặc geolocation thiết bị |
| Driver gửi API | Client gọi authenticated POST `/v1/locations`, chờ202/accepted schema; một request đang chạy, timeout7s; pending thì bỏ mẫu |
| API08/API09 | Không có handler thực thi trên các remote refs đã kiểm tra; location controller/module/service/repository và tracking DTO trống, AppModule chưa import LocationModule |
| API11 | Có controller/repository directory thật; vẫn cần schema/quyền và dữ liệu SQL phù hợp để nghiệm thu |
| Worker develop | Subscriber log raw message rồi ACK; processor/writer trống, chưa persistence |
| Worker nhánh riêng | Có code nhưng writer dùng hai Map trong RAM; chưa PostgreSQL/transaction/ACK sau SQL commit |

Nhánh Worker riêng còn lỗi canonical future sample: mẫu đầu timestamp30s/receivedAt0s
history-only; retry cùng key với receivedAt60s và tọa độ khác làm current nhận tọa độ
retry dù history vẫn bản đầu. Đã thực thi trực tiếp source trong bộ nhớ, không DB.
Processor còn chấp nhận thiếu receivedAt bằng thời gian hiện tại. Không đáp ứng
first-write-wins/không nâng future thành eligible qua retry theo EVT01.
Schema nhánh đó dùng snake_case, trong khi API raw-pg hiện dùng quoted camelCase;
phải thống nhất mapping/migration, không merge/generate schema mù.

## Phần cần bàn giao để nối thật

1. **TV1**: API08 publish có broker-confirmed202 và API09 đúng SC05, owner/snapshot,
   hidden/missing/stale, reassign/terminal. Hoàn thiện List/Detail/action phụ thuộc.
2. **TV2**: Worker ghi PostgreSQL transaction, ACK sau commit; giữ bản đầu của
   driver/timestamp canonical, chống trùng/out-of-order/future; thống nhất SQL/API11.
3. **TV4**: RAM FIFO tối đa500 theo uid, retry giữ mẫu/timestamp, phục hồi offline,
   phản hồi overflow; 401 pause/403 stop; script mẫu chuyển động/trùng/đến trễ.
4. **TV5/TV6**: revision/schema/runtime/account được phép thử; kiểm tra toàn bộ TC04
   và TC05 trên Cloud: quyền, broker → SQL → read UI, crash/retry, reassign/terminal.

Kết luận: frontend đã có phần đọc để kết nối theo contract; **chưa đủ pipeline để
nghiệm thu tuần5 trên Cloud**. Không sửa thay backend/Driver/Worker trong lượt này.

## Chạy lại

Tại gốc repo: `npm run lint:web`, `npm run build:web`,
`npm run test --workspace=@parcelflow/web`; chạy UI bằng `npm run dev:web`.
Với API thật, mở chi tiết Customer/Admin và `/admin/live-map`, dùng các account/đơn
được nhóm cấp. API chưa sẵn sàng phải hiện lỗi/thiếu GPS, không hiện vị trí mẫu.

## Tiếp tục tuần 8 — 14/11/2026

Nguồn hiện hành là [PF SPEC 01 v1.4](https://docs.google.com/document/d/1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8/edit),
FR05/AC05, API09/SC05, VII tuần 8; đối chiếu trực tiếp sheet `Tiến độ 10 Tuần`,
A28:G33. Phần TV3 là Leaflet tracking/polling Customer. Các mục ngày 30/10 ở trên
là bằng chứng lịch sử theo lịch kỹ thuật cũ, không phải hiện trạng backend hôm nay.

Đã fetch origin và fast-forward `feature/frontend` từ `bb0a6f1` lên `c2bddbc`.
Code mới gồm SQL GPS và QA Worker duplicate/out-of-order của nhóm, cùng tài liệu
điều phối. Giữ nguyên `.env.example` local và `AGENTS.md`; không tự commit/push/deploy.

### Thay đổi frontend

- Customer/Admin Detail truyền hai điểm lấy/giao đã đọc đúng quyền vào tracking.
  Loading, tải lại thủ công và lỗi mạng/503 giữ cùng map instance, không tải lại
  toàn bộ nền bản đồ. GPS cũ bị bỏ khỏi view khi đọc thất bại.
- 401/403/404, tài khoản chưa provision hoặc response sai ẩn map và dừng polling;
  giữ nút thử lại. Không có endpoint giả hay fallback dữ liệu mẫu trong luồng thật.
- Viewport giữ vị trí người dùng đã kéo/zoom khi GPS cập nhật hoặc tạm mất marker.
  Lần đầu có GPS, đổi driver, đổi đơn/account hoặc điểm giao nhận thì căn lại khung.
- Vùng chữ loading/lỗi/GPS có chiều cao ổn định, trạng thái có nhãn và screen reader;
  giữ theme sáng/tối, reduced motion và các hành động nghiệp vụ hiện có.
- Bổ sung kiểm tra map/panel và route Customer/Admin qua apiClient/parser thật.
  Route tests mock HTTP, không thay thế kiểm tra handler API09 thật.

### Kết quả kiểm tra local

| Kiểm tra | Kết quả và giới hạn |
| --- | --- |
| `npm run test --workspace=@parcelflow/web` | 538/538, 40 file; Vitest/jsdom, có API mock |
| `npm run lint:web` | Đạt, exit 0 |
| `npm run build:web` | TypeScript/build đạt; main 512,33 kB còn cảnh báo >500 kB có từ trước, không tăng ngưỡng |
| `npm run test:integration --workspace=@parcelflow/web` | 11/11 UI → Nest → PGlite đạt; bộ này chưa kiểm API09 vì handler chưa có |
| Edge local, Leaflet và tile thật | Customer/Admin ở 390/768/1440px; fresh/stale/missing/503/reassign/403/terminal đạt, không tràn ngang; Auth/API mock riêng |
| Ổn định map và giao diện | Giữ cùng map qua lỗi/refresh; chênh vị trí trên của map khi đổi fresh → lỗi là 0px ở cả 6 view; terminal/route cleanup dừng polling |
| Ảnh và trạng thái trình duyệt | 11 ảnh local, 0 runtime exceptions; kiểm thêm theme sáng và reduced motion |

Lượt integration đầu timeout khi khởi tạo fixture 30 giây. Khởi tạo riêng Nest/PGlite
đạt khoảng 8,6 giây; chạy lại suite đạt 11/11, không tăng timeout hoặc bỏ test.
Node local 24.21.0; chạy test với `NODE_OPTIONS=--no-experimental-webstorage`.
Tốc độ/sẵn sàng tile bên ngoài không được bảo đảm bởi các kết quả này.

### Phụ thuộc chưa hoàn tất

`origin/develop` tại `c2bddbc` có POST `/v1/locations`, DTO tracking và repository
đọc GPS, nhưng chưa có handler GET `/v1/shipments/{id}/tracking`. Vì vậy chưa thể
chạy UI → Nest API09 → SQL thật hoặc xác nhận marker Customer di chuyển trên Cloud.
Không suy ra API09 đã chạy từ sự tồn tại DTO, SQL GPS hoặc health 200.

TV1 cần bàn giao API09 đúng SC05, quyền Customer owner/Admin/current Driver,
snapshot thống nhất và quy tắc null/stale/reassign/terminal. TV5 cần triển khai
API/Worker/web từ bản tích hợp cùng SHA, cấu hình SQL/PubSub đúng runtime đã chốt.
Sau đó TV3/TV6 kiểm lại TC05.1–05.3 với GPS được Worker ghi thật; đối chiếu vị trí
trong UI với mẫu trong SQL, ghi revision/SHA và dữ liệu kiểm tra không chứa bí mật.

**Kết luận:** phần frontend đã được triển khai và kiểm chứng local; checkpoint
tracking tuần 8 trên Cloud còn mở. Lượt này không sửa API/Driver/Worker/SQL,
không truy cập tài khoản demo hoặc thay đổi Cloud.
