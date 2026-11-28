# Kiểm thử tải GPS ingest bằng k6

Tracking read API09 tuần 9 dùng công cụ riêng `tracking-read.mjs` và runner
local `tracking-read-smoke.mjs`, không sửa generator GPS dưới đây. Xem
[cấu hình LT04, cách tính p95 và kết quả](../../docs/features/tracking-read-load.md).

`gps-ingest.js` gửi HTTP thật vào `POST /v1/locations`. Mỗi VU tương ứng một
tài xế với Firebase ID token riêng, tạo tọa độ mô phỏng và timestamp UTC ms
hiện tại. Không gửi driverId; API lấy danh tính từ Bearer và ánh xạ nghiệp vụ.
Không cần cài thêm npm dependency cho script k6.

## Công cụ và chạy thử local ngay

Đã kiểm bằng k6 **v2.4.0**. Trên máy hiện tại có bản portable tại
`.vitest/tools/k6/k6-v2.4.0-windows-amd64/k6.exe`, không cài vào hệ thống và
không đưa binary vào Git. ZIP từ [release chính thức](https://github.com/grafana/k6/releases/tag/v2.4.0)
đã đối chiếu SHA256 công bố:
`aaa90b3afc336faf90172c7addf45c4f41305f6f188e3d564f79466e80ac68e3`.

Máy khác có thể dùng standalone binary hoặc cài theo
[hướng dẫn Grafana](https://grafana.com/docs/k6/latest/set-up/install-k6/):
`winget install k6 --source winget`. Nếu k6 đã trong PATH thì không cần K6_BINARY.

Chạy từ gốc repo với dependencies đã có (`npm ci` khi mới clone):

```powershell
npm.cmd run build --workspace=@parcelflow/types
npm.cmd run build --workspace=@parcelflow/api
$env:K6_BINARY = (Resolve-Path '.vitest/tools/k6/k6-v2.4.0-windows-amd64/k6.exe').Path
node infra/load/gps-ingest-smoke.mjs
Get-Content .vitest/gps-ingest-smoke/report.json
```

Runner tự mở API NestJS thật trên port loopback ngẫu nhiên, tạo token fixture
chỉ có giá trị trong runner, chạy 2 Driver/1 giây/3 giây và đối chiếu business
driverId, seq/timestamp, payload và số accepted. Firebase, lookup tài khoản và
Pub/Sub được mock; không có Worker, SQL hoặc Cloud. Token fixture được xóa khi
runner kết thúc. Không thêm mock vào API runtime của ứng dụng.

Runner còn kiểm 503 do broker lỗi, 202 với body sai, 409 chưa liên kết, thiếu
file token, tải cố định và lượt gửi bị bỏ khi broker chậm. Runner đối chiếu
exit code, sự kiện publish và số liệu báo cáo. `K6_SMOKE_OUTPUT` tùy chọn
đổi thư mục report; mặc định `.vitest/gps-ingest-smoke` đã được Git ignore.

## Chạy với API và tài khoản đã chuẩn bị

Mỗi Driver phải có Firebase ID token với claim `role=DRIVER`, `sub` khác nhau
và `users.firebaseUid` liên kết đúng tài khoản nghiệp vụ. Dùng tài khoản test
do nhóm chuẩn bị. Script không đăng nhập, tạo user, cấp role hoặc refresh token.
Token phải còn hạn đủ warm-up + duration + request timeout + 30 giây. Giải mã JWT chỉ
giúp bắt cấu hình sai, API vẫn xác minh chữ ký/quyền và linkage.

1. Tạo thư mục `.vitest/gps-ingest`, copy `driver-tokens.example.json` vào đó
   với tên `driver-tokens.json`, rồi thay placeholder bằng ID token. File là
   mảng chuỗi JSON, không phải access token Google, Firebase API key hay driverId.
2. Giữ file thật trong `.vitest/` hoặc ngoài repo. Không dán token vào command
   line, báo cáo hay Git. Script dùng N token đầu tiên và từ chối trùng `sub`.
3. Chạy thử với API local đã cấu hình hoặc dùng quy trình Cloud bên dưới.

```powershell
New-Item -ItemType Directory -Path '.vitest/gps-ingest' -Force | Out-Null
# Tạo và điền .vitest/gps-ingest/driver-tokens.json trước khi chạy.
$env:BASE_URL = 'http://127.0.0.1:3000/v1'
$env:DRIVER_TOKENS_FILE = (Resolve-Path '.vitest/gps-ingest/driver-tokens.json').Path
$env:DRIVERS = '2'
$env:SEND_INTERVAL_SECONDS = '8'
$env:DURATION_SECONDS = '16'
$env:REQUEST_TIMEOUT_SECONDS = '7'
$env:SUMMARY_PATH = Join-Path (Resolve-Path '.vitest/gps-ingest').Path 'summary.json'
& '.vitest/tools/k6/k6-v2.4.0-windows-amd64/k6.exe' run --no-usage-report --http-debug-redact infra/load/gps-ingest.js
# Nếu đã cài k6: k6 run --no-usage-report --http-debug-redact infra/load/gps-ingest.js
```

| Biến | Ý nghĩa / mặc định |
| --- | --- |
| BASE_URL | Bắt buộc, base HTTP(S) kết thúc `/v1`; không query/fragment/credentials |
| DRIVER_TOKENS_FILE | Bắt buộc, nên dùng đường dẫn tuyệt đối tới mảng ID token |
| GPS_LOAD_PROFILE | Không đặt để chạy tùy chọn. Đặt `LT01` để dùng cấu hình baseline bên dưới |
| DRIVERS | Số Driver/VU, số nguyên dương; mặc định 2, không vượt số token |
| SEND_INTERVAL_SECONDS | Chu kỳ mỗi Driver; mặc định 8, tối thiểu 0.001 giây |
| OFFERED_EVENTS_PER_MINUTE | Nếu đặt, số lượt gửi lên lịch mỗi phút trên toàn bộ VU; số nguyên dương. Dùng thay cho `SEND_INTERVAL_SECONDS` để chạy tải cố định |
| WARMUP_SECONDS | Giây chạy warm-up trước khi đo; mặc định 0 khi biến không được đặt |
| DURATION_SECONDS | Thời gian đo, số nguyên giây dương; mặc định 16 |
| REQUEST_TIMEOUT_SECONDS | Timeout từng HTTP request; mặc định 7 giây |
| HTTP_P95_LIMIT_MS | Nếu đặt, k6 yêu cầu p95 HTTP thấp hơn ngưỡng này, tính bằng ms |
| SUMMARY_PATH | File JSON đầu ra; mặc định `gps-ingest-summary.json` ở cwd, được ignore; thư mục cha phải tồn tại |

Dùng các biến trên để đổi tải, giữ nguyên scenario. Không ghi đè bằng `--vus`,
`--iterations`, `--duration`, K6_VUS/K6_DURATION hoặc config k6 riêng vì sẽ đổi
mapping/pacing. Không bật HTTP debug khi dùng token thật.

## Baseline LT01 và NF05

`GPS_LOAD_PROFILE=LT01` lên lịch 3.750 lượt/phút (62,5 event/s) liên tục trong
2 phút warm-up và 10 phút đo. Script luân phiên 500 danh tính Driver theo thứ
tự lượt gửi, mỗi Driver cách danh nghĩa 8 giây. Lịch đo có 37.500 lượt.
HTTP timeout là 7 giây. Profile từ chối biến môi trường xung đột với các giá
trị đã khóa. Dùng một tiến trình k6 local với file token của 500 Driver test
khác nhau. Mỗi token phải còn hạn hơn 757 giây lúc k6 bắt đầu.

```powershell
$env:GPS_LOAD_PROFILE = 'LT01'
# Đặt BASE_URL, DRIVER_TOKENS_FILE và SUMMARY_PATH như phần trên.
# Xóa các biến DRIVERS, OFFERED_EVENTS_PER_MINUTE, WARMUP_SECONDS,
# DURATION_SECONDS, REQUEST_TIMEOUT_SECONDS và HTTP_P95_LIMIT_MS nếu đã đặt cho lượt khác.
k6 inspect --include-system-env-vars --execution-requirements infra/load/gps-ingest.js
# Chỉ chạy bước dưới trong cửa sổ benchmark đã thống nhất với TV5.
k6 run --no-usage-report --http-debug-redact infra/load/gps-ingest.js
```

`measuredResults` có offered, accepted, lỗi và p95 của request bắt đầu trong
10 phút đo, kể cả phản hồi đến khi k6 đợi request cuối hoàn tất. `results` có
số liệu cả lượt, gồm warm-up và lượt gửi bị bỏ. Ngưỡng NF05 là
`http_req_duration{phase:measure}: p(95)<150` ms. Lỗi request hoặc lượt gửi bị
bỏ ở bất kỳ giai đoạn nào đều làm k6 báo lỗi. Khi dry-run ở tải nhỏ, bỏ
`GPS_LOAD_PROFILE` để chỉ thu số liệu quan sát.

## Đọc kết quả và giới hạn

Exit code 0 chỉ khi mọi request trả **202 với ACCEPTED/eventId/receivedAt hợp
lệ**, không lỗi HTTP và có ít nhất một accepted. Body 202 sai cũng làm test
FAIL. 401/403/409 dừng toàn lượt để sửa token/quyền/linkage; không retry POST.
`results` trong JSON ghi số liệu chính. K6 giữ metric gốc ở `summary.metrics`.

- `offered` đếm ngay trước khi gọi POST. `accepted` đếm phản hồi 202 hợp lệ.
  `errors` đếm lỗi đã nhận, gồm lỗi transport (cả timeout), body 202 sai,
  HTTP 4xx, 5xx và các trạng thái HTTP còn lại. `incomplete` đếm request đã bắt
  đầu nhưng chưa thu được kết quả khi lượt chạy kết thúc.
- `httpP95Ms` tính từ `http_req_duration` của các request. Số đo kết thúc ở
  phản hồi HTTP. 202 xác nhận publish Pub/Sub. Để xác nhận commit SQL cần
  bằng chứng từ Worker và DB.
- `offeredPerSecond` và `acceptedPerSecond` dùng thời gian chạy thực tế của k6,
  gồm thời gian đợi iteration kết thúc. `workload.nominalEventsPerSecond` là
  tốc độ cấu hình.
- `droppedIterations` đếm lượt gửi đã lên lịch nhưng thiếu VU rảnh. Các lượt
  này chưa gọi HTTP. Trong chế độ tải cố định, có drop thì k6 trả mã lỗi.

Mặc định dùng `constant-vus` để mô phỏng nhịp GPS riêng của từng Driver. Tốc
độ danh nghĩa là `DRIVERS / SEND_INTERVAL_SECONDS` và giảm khi request kéo
dài hơn chu kỳ. Khi đặt `OFFERED_EVENTS_PER_MINUTE`, `constant-arrival-rate`
giữ nhịp phát toàn lượt với `DRIVERS` VU được cấp sẵn. Mỗi VU dùng một token
riêng và gửi tuần tự. Tốc độ của từng Driver ở chế độ này phụ thuộc lịch k6.
Các giá trị `3750` và `18000` tương ứng 62,5 và 300 event/s cho các lượt
baseline và peak sau này. Số VU/token phụ thuộc latency và tải dự kiến.

`infra/pubsub/worker-load-benchmark.mjs` được tham khảo về số Driver/nhịp và
manifest, nhưng chỉ chạy Map trong process. Không dùng throughput của script
đó hoặc lượt smoke mock để kết luận Pub/Sub/Worker/Cloud đạt hiệu năng.

## Dry-run Cloud tải nhỏ

Sau khi TV5 bật `int3326esql` và xác nhận Worker đang nhận từ subscription
GPS, lấy URL HTTPS của API đang chạy, revision API/Worker và tên subscription
từ cấu hình triển khai. Dùng tài khoản Driver test đã liên kết DB và không có
đơn đang được theo dõi. GPS mô phỏng sẽ được publish và có thể ghi vào DB thật.

Chạy từ gốc repo với file token đã chuẩn bị như trên. Một Driver gửi khoảng
12 request trong 90 giây nếu đáp ứng kịp chu kỳ 8 giây.

```powershell
$env:BASE_URL = 'https://backend-service-wcvss3dnxa-as.a.run.app/v1' # đối chiếu URL với TV5
$env:DRIVER_TOKENS_FILE = (Resolve-Path '.vitest/gps-ingest/driver-tokens.json').Path
$env:DRIVERS = '1'
$env:SEND_INTERVAL_SECONDS = '8'
$env:DURATION_SECONDS = '90'
$env:REQUEST_TIMEOUT_SECONDS = '7'
$env:SUMMARY_PATH = Join-Path (Resolve-Path '.vitest/gps-ingest').Path 'cloud-dry-run-summary.json'
Remove-Item Env:GPS_LOAD_PROFILE,Env:OFFERED_EVENTS_PER_MINUTE,Env:WARMUP_SECONDS,Env:HTTP_P95_LIMIT_MS -ErrorAction SilentlyContinue
$runStartedUtc = [DateTime]::UtcNow.ToString('o')
k6 run --no-usage-report --http-debug-redact infra/load/gps-ingest.js
$runExitCode = $LASTEXITCODE
$runEndedUtc = [DateTime]::UtcNow.ToString('o')
"UTC $runStartedUtc -> $runEndedUtc, k6 exit $runExitCode"
```

Trong [Cloud Monitoring](https://docs.cloud.google.com/pubsub/docs/monitoring),
lọc `Pub/Sub Subscription` theo đúng subscription Worker đang dùng (mặc định
`gps-events-sub`). Xem `subscription/num_unacked_messages_by_region` (cộng
qua các vùng tại cùng thời điểm) và `subscription/oldest_unacked_message_age_by_region`
(lấy lớn nhất qua các vùng). Ghi mốc UTC và giá trị trước lượt, cao nhất trong
lượt và sau lượt. Lấy mẫu theo phút và chờ điểm đo hiển thị. Nếu thiếu điểm
đo, ghi `không có dữ liệu` tại mốc đó. Subscription dùng chung có thể chứa
traffic ngoài k6. [Danh mục metric Pub/Sub](https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z#pubsub).

Ghi vào mục TV4 của [điều phối tuần](../../docs/coordination/README.md)
hoặc liên kết báo cáo từ đó. Ghi cửa sổ UTC, API URL, revision API/Worker,
subscription, tham số chạy, exit code, offered, accepted, lỗi theo nhóm,
p95 HTTP và các mốc backlog. Giữ token ngoài báo cáo và chỉ lưu phần số liệu
cần thiết của summary.

## Kiểm tra và bằng chứng

```powershell
npm.cmd test -- infra/load/gps-ingest-config.spec.ts
npm.cmd run check
git diff --check
```

[Báo cáo smoke](../../docs/evidence/gps-ingest-load/report.json) ghi k6 version,
tham số, event manifest, kết quả dương/âm, mức mock và SHA-256 source. Dữ liệu
raw từng lượt ở cùng thư mục, không chứa token. Chạy lại runner để lấy số mới,
không coi vài request local là benchmark hoặc nghiệm thu Driver trên Cloud.

Kết quả lịch sử ngày 15/11/2026 trên nhánh `test/gps-ingest-load`, base `f28365d`:
44/44 test config/contract; 5/5 kịch bản smoke k6 đạt (6/6 accepted, mỗi Driver
3 mẫu, bốn đường âm trả mã lỗi đúng). `npm.cmd run check` exit 0: Worker/shared/
load 166, API 454, web 538 và health e2e 2 test đạt; 116 ca PostgreSQL/Firebase
emulator bị bỏ qua do chưa cấu hình. Chưa chạy API với Firebase/PubSub thật,
Worker/SQL, staging hoặc Cloud trong lượt này. Bản tuần 8 đã vào `develop`.

Tham khảo API chính thức k6:
[constant-vus](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-vus/),
[constant-arrival-rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/),
[VU ID](https://grafana.com/docs/k6/latest/javascript-api/k6-execution/),
[expectedStatuses](https://grafana.com/docs/k6/latest/javascript-api/k6-http/expected-statuses/),
[custom summary](https://grafana.com/docs/k6/latest/results-output/end-of-test/custom-summary/).
