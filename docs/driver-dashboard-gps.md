# Bàn giao Driver dashboard và gửi GPS thử

Phạm vi: Driver login/dashboard và gửi GPS thử, mốc 26/10–01/11/2026,
tương ứng VII.4/tuần 3 lộ trình sản phẩm. Branch `feature/driver-dashboard-gps`,
base develop `8038c83`.
Yêu cầu và tasks: mục 11 của [đặc tả Driver](../openspec/driver-gps-emitter-draft.md).

## Hành vi

- Login/role gate và đăng xuất tái sử dụng phần Auth có sẵn. `/driver` chỉ dành
  cho DRIVER; danh tính hiển thị từ phiên, không dùng `demo-driver-1`.
- Dashboard có khung đơn được phân công, ghi rõ chưa kết nối danh sách đơn.
- Start tạo tọa độ mô phỏng đầu tiên sau 8 giây, gửi mỗi 8 giây qua API client
  chung. Body có `lat/lng/clientTimestamp/seq`, không có `driverId` hoặc role.
  Backend phải lấy driver từ Bearer token, enrich và publish theo contract.
- Chỉ đếm thành công với HTTP 202 và JSON `{status:"ACCEPTED",eventId,receivedAt}`
  đúng schema. Hiển thị mã sự kiện/thời điểm gần nhất. Không tuyên bố đã lưu SQL.
- Một request mỗi lúc, timeout 7 giây; không retry hoặc lưu queue tự động.
  Mẫu tới khi request còn chờ được bỏ qua và có thông báo số lượng.
- Stop ngừng tạo mẫu mới, không hủy yêu cầu đã gửi. Restart tiếp tục sequence.
  Rời trang/hết phiên/đổi tài khoản hủy request và timer; không hiển thị kết quả cũ.
- Emitter dùng độc lập không có callback vẫn chỉ hiển thị payload mẫu.

## Kiểm chứng local ngày 24/10/2026

| Kiểm tra | Kết quả | Mức bằng chứng |
| --- | --- | --- |
| Test Driver + adapter + emitter | 43/43 đạt, 3 file | jsdom, fetch/API mock, fake timers, StrictMode |
| Toàn bộ test frontend | 219/219 đạt, 20 file | Local; không phải Firebase/Pub/Sub thật |
| `npm run lint:web` | Exit 0 | Local ESLint |
| `npm run build:web` | Exit 0 | TypeScript + Vite production build |
| `git diff --check` | Exit 0 | Whitespace của diff |

Test mới kiểm tra Bearer token và URL `/v1/locations`, body, HTTP status/response,
invalid payload, timeout/cancel; Driver route và phiên, timer/Stop/restart,
request không chồng lấn, lỗi API, unmount và thay tài khoản.
Build có cảnh báo chunk JS lớn hơn 500 kB; build vẫn đạt. Lần test sandbox ban đầu
bị `spawn EPERM`, chạy lại bằng quyền cho phép tạo process thì đạt.

Chạy lại từ gốc repo:

```powershell
npm run test --workspace=@parcelflow/web -- src/api/endpoints/locations.spec.ts src/features/driver/DriverPlaceholderPage.spec.tsx src/features/driver/GpsEmitter.spec.tsx
npm run test --workspace=@parcelflow/web
npm run lint:web
npm run build:web
```

## Kiểm chứng tích hợp develop ngày 26/10/2026

Đã merge `origin/develop` tại `c00c42d` vào nhánh Driver, không có xung đột.
Trên bản tích hợp: toàn bộ frontend đạt 351/351 test trong 27 file;
`npm run lint:web` và `npm run build:web` đều exit 0.
Người dùng đã cho phép merge qua PR vào develop trong lượt này; kết quả local
không đóng W605 hoặc thay thế nghiệm thu Firebase/API/Pub/Sub thật bên dưới.

## Tích hợp và nghiệm thu thật còn mở

Chưa kiểm tra trực quan trong trình duyệt, đăng nhập Firebase thật hoặc pipeline
Driver → API → Pub/Sub cloud trong lượt này. Trong checkout, controller/service
GPS của API còn trống; mock không chứng minh endpoint đó hoạt động.
Review contract độc lập G206 vẫn chờ người phụ trách. Chưa deploy. Tại lần bàn giao
24/10, người dùng cho phép commit/push nhánh và mở Draft PR, chưa cho phép merge;
quyền merge đã được cập nhật ngày 26/10 như ghi ở trên.

1. TV2 cung cấp `POST /v1/locations`, xác thực DRIVER, validation, enrich và trả
   202 sau broker-confirmed publish; response theo `AsyncAcceptedResponse` trong
   `docs/openapi.json`. Không cần Worker/SQL để kiểm tra riêng mốc publish này.
2. TV6 chuẩn bị tài khoản Firebase có claim DRIVER và business identity đúng;
   TV5 cấu hình API URL/CORS/credentials backend. Không đưa Google credentials
   vào frontend. `VITE_API_URL` là base có `/v1`; giữ cấu hình Firebase hiện có.
3. Chạy `npm run dev:web`, đăng nhập rồi vào `/driver`. Kiểm tra giao diện ở màn
   hình hẹp, nội dung tài khoản, tab/keyboard và đăng xuất. Chưa bấm Start thì
   không có request GPS.
4. Mở Network, bấm Start. Sau 8 giây kiểm tra POST đúng URL/body, có Bearer token
   (không lưu token trong ảnh/báo cáo), HTTP 202 và JSON hợp lệ; UI tăng đúng một.
   Không chấp nhận chỉ thấy JSON trên trang làm bằng chứng đã publish.
5. Phối hợp TV5 chuẩn bị kênh quan sát test riêng trước khi gửi, đối chiếu eventId
   từ response với message GPS trên Pub/Sub. Không pull/ACK subscription nghiệp
   vụ để lấy ảnh vì có thể lấy mất message của Worker. Lưu thời điểm, môi trường,
   eventId và kết quả thật, không dùng ảnh Hello World cũ thay cho lượt này.
6. Stop rồi chờ hơn 8 giây: không có mẫu mới; Restart tiếp tục sequence. Rời route
   thì không gửi tiếp. Thử sai role, mất mạng và API không sẵn sàng; UI báo lỗi,
   không tăng số chấp nhận. `202` chưa chứng minh Worker đã ghi SQL.

W605 còn mở đến khi có bằng chứng này. Không đánh dấu toàn bộ tuần 6 hoàn tất
chỉ dựa vào kết quả local.

## Kiểm chứng thời hạn gửi ngày 01/11/2026

Rà soát tiếp từ baseline `9ee7c10`. API client áp dụng cùng một thời hạn cho
lấy Firebase token, gửi HTTP và đọc phản hồi; adapter GPS tiếp tục đặt 7 giây.
Hủy khi rời trang có hiệu lực ngay cả trong lúc chờ token. Token đến sau khi
hết hạn hoặc hủy không được tạo request HTTP muộn. Không thay đổi payload,
nhịp phát mẫu, cơ chế xác thực hoặc thêm retry/queue.

Ba test hồi quy tái hiện lỗi trước khi sửa và đều đạt sau sửa: token không trả
về trong thời hạn, hủy trong lúc lấy token, và tổng thời gian lấy token + HTTP.

| Kiểm tra | Kết quả | Mức bằng chứng |
| --- | --- | --- |
| API client + adapter GPS + dashboard + emitter | 52/52 test, 4 file | Local/mock, gồm 3 test hồi quy mới |
| Toàn bộ frontend | 354/354 test, 27 file | Local/mock |
| `npm run lint:web` | Exit 0 | ESLint |
| `npm run build:web` | Exit 0 | TypeScript + Vite; chưa deploy |

Chạy lại bộ kiểm tra tập trung từ gốc repo:

```powershell
npm run test --workspace=@parcelflow/web -- src/api/client.spec.ts src/api/endpoints/locations.spec.ts src/features/driver/DriverPlaceholderPage.spec.tsx src/features/driver/GpsEmitter.spec.tsx
```

Kiểm tra HTTP chỉ đọc cùng ngày ghi nhận:

- `GET https://int3326e.web.app/driver`: 200. Bundle Hosting vẫn có Driver
  skeleton dùng `demo-driver-1` và route Driver không qua login; chưa phải
  dashboard dùng Firebase của baseline hiện tại. HTTP 200 không xác nhận
  phiên bản frontend đã được cập nhật.
- `GET https://backend-service-wcvss3dnxa-as.a.run.app/v1/auth/me` không kèm
  token: 401 `UNAUTHENTICATED`. Chưa kiểm tra tài khoản Driver thật.
- `OPTIONS /v1/locations` trên API trên: 204, cho phép origin
  `https://int3326e.web.app` và method POST. Preflight không chứng minh handler
  ingest đã tồn tại hoặc Pub/Sub đã nhận event.

Chưa có cấu hình Firebase local; không tạo hoặc thay đổi tài khoản/claim.
Công cụ điều khiển trình duyệt dừng vì không xác định được URL hiện tại đủ
tin cậy, nên W607 chưa có bằng chứng trực quan. W605 vẫn mở: cần cấu hình và
triển khai frontend hiện hành, endpoint ingest hoạt động, phiên Driver hợp lệ
và đối chiếu eventId trên kênh Pub/Sub thử riêng. Không gửi GPS hoặc deploy
trong lượt kiểm tra HTTP này.
