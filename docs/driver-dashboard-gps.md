# Bàn giao Driver dashboard và gửi GPS thử

Phạm vi: Driver login/dashboard và gửi GPS thử, mốc 26/10–01/11/2026,
tương ứng VII.4/tuần 3 lộ trình sản phẩm. Branch `feature/driver-dashboard-gps`,
base develop `8038c83`.
Nguồn yêu cầu: [PF SPEC 01 nội dung v1.3](spec-baseline.md), VII.4/UI02;
contract GPS dùng chung tại [GPS event contract](gps-event-contract.md).

Trạng thái ngày 02/11/2026: phần Driver đạt kiểm chứng local sau tích hợp
`develop` tại `75e9664`, gồm kiểm tra trình duyệt W607. Nghiệm thu cloud W605 còn mở và
được bàn giao cho phần API/triển khai ở mục cuối.

## Hành vi tại mốc tuần 6

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
Task W606 đạt ở mức local/mock; W607 kiểm tra trực quan còn mở, cùng gate
W605 nghiệm thu Firebase/API/Pub/Sub thật bên dưới.

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

## Kiểm chứng giao diện ngày 02/11/2026

Kiểm chứng ban đầu tại `4b6c56a`, sau đó tích hợp `develop` tại `75e9664`
và kiểm tra lại với stylesheet chung hiện hành. Giữ cấu trúc tài liệu đã được
nhóm hợp nhất vào `docs`; harness nằm trong `apps/web/scripts`. Dùng nguyên
dashboard, layout, route guard, API client và adapter GPS hiện có. Không phát
hiện thiếu sót frontend cần sửa thêm trong phạm vi đã chốt.

| Kiểm tra | Kết quả | Mức bằng chứng |
| --- | --- | --- |
| Trình duyệt Microsoft Edge qua Playwright | 19/19 kịch bản đạt | Browser thật, AuthContext/API mock, clock mô phỏng |
| Layout 320/390/1440 px | Không tràn ngang, gồm tên tài khoản dài | Đã xem ảnh màn hẹp/rộng và trạng thái nhận GPS rồi dừng |
| Keyboard | Skip link đưa focus tới nội dung chính | Browser local |
| Start/Stop/restart | Không gửi lúc mở trang; mẫu đầu sau 8 giây; restart tiếp tục sequence | Body/Bearer token giả được đối chiếu trên request mock |
| Lỗi và cleanup | 401/403/404/409/503, response sai, mất mạng, timeout; không tăng số chấp nhận khi lỗi | Browser local; không lộ nội dung lỗi thô |
| Hủy request | Browser ghi nhận `net::ERR_ABORTED` khi timeout/rời route/đăng xuất/đổi tài khoản | Không phát thêm mẫu của phiên cũ |
| Toàn bộ frontend sau tích hợp | 438/438 test, 34 file | Local/mock |
| Suite tích hợp Shipment hiện có | 8/8 test | Nest HTTP + PGlite local; Firebase mock, không phải GPS cloud |
| Lint/build | `npm run lint:web`, `npm run build:web`: exit 0 | TypeScript + Vite; chưa deploy |

[Báo cáo trình duyệt](evidence/driver-dashboard/browser-review.json) ghi source
SHA, phiên bản Edge, 19 kịch bản, không có runtime error và không có HTTP request
ra ngoài origin thử. Ảnh: [tài khoản dài trên màn 320 px](evidence/driver-dashboard/mobile-long-account.png),
[hai mẫu được chấp nhận rồi Stop](evidence/driver-dashboard/gps-accepted-stopped.png).
Fixture dùng tài khoản/dữ liệu giả, không truy cập phiên trình duyệt của người
dùng và không gửi GPS lên cloud. Đây là bằng chứng W607, không thay W605.

Chạy lại với Node >=22.12, dependencies repo đã cài, package `playwright` có
sẵn trong môi trường kiểm thử và Microsoft Edge đã cài:

```powershell
node --experimental-strip-types apps/web/scripts/verify-driver-dashboard.mjs
npm run test:integration --workspace=@parcelflow/web
```

Nếu Playwright ở ngoài repo, đặt `DRIVER_REVIEW_PLAYWRIGHT` thành đường dẫn
package đó trước khi chạy. Harness dùng loopback `127.0.0.1:5179`, không cho
fallback sang origin khác, tạo fixture tạm trong `apps/web/.vitest`, tự đóng
browser/server và xóa đúng file fixture khi kết thúc. Kết quả mặc định nằm tại
`.vitest/driver-dashboard-review`; `DRIVER_REVIEW_OUTPUT` đổi thư mục kết quả.
Các lệnh test/lint/build ở trên giữ nguyên. Node có cảnh báo module type của
shared GPS type; harness vẫn exit 0, không sửa cấu hình package để che cảnh báo.
Dependency được khôi phục đúng lockfile; không thay package manifest/lockfile.
Fixture export component hợp lệ để lint vẫn đạt khi chạy song song browser.

## Bàn giao tích hợp API GPS

Driver đã đạt kiểm chứng local; các bước dưới đây thuộc phần API GPS và môi
trường triển khai cần sẵn sàng trước nghiệm thu cloud W605.

Nguồn review: `origin/feature/scaffold-gps-worker` tại `99a462a`. Gọi service
trực tiếp với request Driver hợp lệ và Pub/Sub SDK mock trả thành công cho
thấy response `ACCEPTED`, nhưng event publish không qua validator dùng chung.
[Báo cáo đối chiếu](evidence/driver-dashboard/backend-contract-review.json)
ghi SHA đầy đủ và mức mock; chưa chạy HTTP guard hoặc broker thật.

Các điểm cần xử lý trước W605:

1. `location.service.ts`: publish `clientTimestamp` dạng UTC ISO mili giây,
   giữ đúng các trường của `GpsTelemetryEvent`. Event hiện có timestamp dạng
   số và thêm `latitude`, `longitude`, `clientTimestampIso`, `receivedAtMs`,
   khiến `assertGpsTelemetryEvent` báo `GPS payload contains unknown fields`.
   Frontend tiếp tục dùng `lat/lng/clientTimestamp/seq` theo contract đã chốt.
2. `location.controller.ts`: gắn `BusinessUserGuard` và lấy Driver từ
   `request.businessUser.id` sau xác thực/role guard. Không dùng Firebase UID
   hoặc `driverId` trong body làm phương án thay thế cho định danh nghiệp vụ.
   Cần test qua Nest HTTP để chứng minh role/linkage/validation thực sự chạy;
   test gọi controller trực tiếp không kiểm chứng các guard đó.
3. Ghép LocationModule vào baseline develop hiện hành, giữ các module đang có.
   Kiểm tra request/response/event bằng shared validation và OpenAPI; giữ
   broker-confirmed 202, lỗi publish không trả thành công. Không thay contract
   frontend để khớp payload riêng chưa được duyệt.
4. Chuẩn bị bản web/API test đúng source, cấu hình Firebase/API URL/CORS và
   tài khoản Driver có linkage. Đăng nhập, Start, đối chiếu `eventId` giữa
   response và Pub/Sub trên kênh thử riêng; kiểm tra Stop, rời trang và lỗi.
   Không pull/ACK subscription nghiệp vụ để lấy bằng chứng. Chỉ đóng W605
   sau lượt thật; response 202 chưa chứng minh Worker đã ghi SQL.

## Cập nhật sau tích hợp nhánh Na — 02/11/2026

Đã nhập nhánh `feature/scaffold-gps-worker` tại `99a462a` vào baseline
`develop` tại `c580efb`, giữ code và lịch sử commit của Na. Xung đột module gốc
được xử lý bằng cách giữ Assignment/Geocoding hiện có và thêm LocationModule.

Các điểm 1–3 ở mục bàn giao phía trên đã được xử lý: event không còn trường
thừa, timestamp canonical, dùng BusinessUserGuard, không fallback UID/body.
Test HTTP local kiểm chứng quyền/mapping, publish-confirmed 202, lỗi 503 và
đối chiếu event bằng validator chung rồi đưa qua processor của Na. Báo cáo
`backend-contract-review.json` giữ nguyên như bằng chứng lịch sử của source cũ.
W605 vẫn mở đến khi có lượt Driver → API → Pub/Sub Cloud thật.
Xem [chi tiết tích hợp và kiểm thử](na-gps-merge.md).

## TV4 tuần 7 — nguồn vị trí, 08/11/2026

Tiếp tục trên `feature/driver-dashboard-gps`, đã fast-forward `origin/develop`
tại `c0f8c8b`. Người dùng cho phép quy trình spec/review/code/test tương đương
vì môi trường thiếu skill Spec Kit. [Spec](driver-gps-week7/spec.md),
[plan](driver-gps-week7/plan.md), [checklist yêu cầu](driver-gps-week7/checklist.md)
và [tasks](driver-gps-week7/tasks.md) truy vết phần TV4 trong sheet tuần 7.

Hành vi hiện tại:

- Chọn `Mô phỏng` (mặc định) hoặc `Vị trí trình duyệt`. Không lấy/gửi vị trí
  khi mở trang hoặc chỉ đổi nguồn. Simulator di chuyển theo tuyến mẫu có nhãn.
- Start: mỗi 8 giây tạo mẫu simulator hoặc gọi Geolocation; browser chỉ gửi khi
  nhận được vị trí. `clientTimestamp` giữ thời điểm đo của thiết bị, chuẩn UTC ms.
  Vị trí trình duyệt cần HTTPS/localhost và quyền định vị.
- Lỗi quyền, không có vị trí, không hỗ trợ, dữ liệu không hợp lệ hoặc chờ quá
  7 giây đều báo rõ rồi dừng. Không tự chuyển nguồn hoặc gửi lại; người dùng
  xử lý quyền rồi Start lại, hoặc tự chọn simulator.
- Stop để đổi nguồn; xóa preview nguồn cũ và tiếp tục seq. Callback định vị về
  muộn sau Stop/rời trang/đổi phiên không gửi dữ liệu. HTTP đã gửi trước Stop
  vẫn có thể hoàn tất. Adapter/Auth/202 và giới hạn một HTTP request giữ như cũ.

| Kiểm chứng bản chưa commit trên base `c0f8c8b` | Kết quả | Mức bằng chứng |
| --- | --- | --- |
| Toàn bộ frontend | 462/462 test, 34 file, exit 0 | jsdom/mock, gồm 24 test mới so với baseline 438 |
| `npm run lint:web` | Exit 0 | ESLint |
| `npm run build:web` | Exit 0 | TypeScript + Vite |
| Harness Microsoft Edge 157.0.4341.42 | 26/26 kịch bản, exit 0 | Browser local, Auth/API mock; Geolocation native với vị trí/quyền giả lập |
| 320/390/1440 px, keyboard, hai nguồn và lỗi quyền | Đạt, không tràn ngang | Browser local, đã xem ảnh |
| `git diff --check` | Exit 0 | Diff code/docs; không thay lockfile/dependency |

Review/converge phát hiện interval cần dừng ngay khi định vị lỗi, trước effect
cleanup: task W708 và test hồi quy đã bổ sung. Test từng tái hiện ba lần gọi thay
vì một; bản sửa xóa interval ngay và bộ test ở trên đã đạt. Checklist yêu cầu
được review riêng trước code; dấu đạt không phải bằng chứng implementation.

[Báo cáo browser](evidence/driver-gps-week7/browser-review.json) lưu base SHA,
trạng thái chưa commit, SHA-256 của source/harness đã test, 26 kịch bản và không
có runtime error hoặc HTTP request ngoài origin thử. Ảnh:
[màn 320 px](evidence/driver-gps-week7/layout-320.png),
[vị trí trình duyệt](evidence/driver-gps-week7/browser-position.png),
[từ chối quyền](evidence/driver-gps-week7/browser-permission-denied.png).
Các tọa độ này do harness giả lập; không phải GPS thiết bị thật của người dùng.
Harness có cảnh báo `MODULE_TYPELESS_PACKAGE_JSON` đã có từ shared GPS type,
vẫn exit 0; không sửa cấu hình package ngoài phạm vi để che cảnh báo.

Chạy lại từ gốc repo với Node >=22.12 và dependency đã cài:

```powershell
npm run test --workspace=@parcelflow/web
npm run lint:web
npm run build:web
# Nếu Playwright không nằm trong node_modules của repo, đặt đường dẫn package có sẵn:
$env:DRIVER_REVIEW_PLAYWRIGHT = 'C:\Users\_____\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
node --experimental-strip-types apps/web/scripts/verify-driver-dashboard.mjs
git diff --check
```

Nghiệm thu thật W707 còn mở. Checkout chỉ có `.env.example` cho web/API; chưa
có phiên Driver thật và dữ liệu đối chiếu revision, Pub/Sub, Worker, Cloud SQL
cho lượt này. TV5 cung cấp cấu hình web/API và revision; TV6 cấp tài khoản Driver
có role/linkage; TV2/5 chuẩn bị kênh quan sát thử riêng rồi đối chiếu `eventId`
từ Start → API → Pub/Sub → Worker → SQL. Kiểm tra Stop, quyền và rời trang trên
bản triển khai đó. Không pull/ACK subscription nghiệp vụ để chụp bằng chứng.
HTTP 202 và kiểm thử local không đóng checkpoint Cloud hoặc cả tuần 7 của nhóm.
Chưa commit/push/deploy trong nhiệm vụ này.
