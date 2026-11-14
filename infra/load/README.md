# GPS ingest k6 — khởi tạo tuần 8

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

Runner còn kiểm 503 do broker lỗi, 202 với body sai, 409 chưa liên kết và thiếu
file token. Các trường hợp này phải làm k6 trả mã lỗi; runner chỉ PASS khi k6
thất bại đúng lý do và không publish nhầm sự kiện. K6_SMOKE_OUTPUT tùy chọn
đổi thư mục report; mặc định `.vitest/gps-ingest-smoke` đã được Git ignore.

## Chạy với API và tài khoản đã chuẩn bị

Mỗi Driver phải có Firebase ID token với claim `role=DRIVER`, `sub` khác nhau
và `users.firebaseUid` liên kết đúng tài khoản nghiệp vụ. Dùng tài khoản test
do nhóm chuẩn bị. Script không đăng nhập, tạo user, cấp role hoặc refresh token.
Token phải còn hạn đủ duration + request timeout + 30 giây. Giải mã JWT chỉ
giúp bắt cấu hình sai, API vẫn xác minh chữ ký/quyền và linkage.

1. Tạo thư mục `.vitest/gps-ingest`, copy `driver-tokens.example.json` vào đó
   với tên `driver-tokens.json`, rồi thay placeholder bằng ID token. File là
   mảng chuỗi JSON, không phải access token Google, Firebase API key hay driverId.
2. Giữ file thật trong `.vitest/` hoặc ngoài repo. Không dán token vào command
   line, báo cáo hay Git. Script dùng N token đầu tiên và từ chối trùng `sub`.
3. Chạy thử nhỏ với API local đã cấu hình; khi có staging của TV5, đổi BASE_URL
   và ghi revision/môi trường vào bằng chứng. Lượt này chưa chạy staging/Cloud.

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
| DRIVERS | Số Driver/VU, số nguyên dương; mặc định 2, không vượt số token |
| SEND_INTERVAL_SECONDS | Chu kỳ mỗi Driver; mặc định 8, tối thiểu 0.001 giây |
| DURATION_SECONDS | Thời gian chạy, số nguyên giây dương; mặc định 16 |
| REQUEST_TIMEOUT_SECONDS | Timeout từng HTTP request; mặc định 7 giây |
| SUMMARY_PATH | File JSON đầu ra; mặc định `gps-ingest-summary.json` ở cwd, được ignore; thư mục cha phải tồn tại |

Dùng các biến trên để đổi tải, giữ nguyên scenario. Không ghi đè bằng `--vus`,
`--iterations`, `--duration`, K6_VUS/K6_DURATION hoặc config k6 riêng vì sẽ đổi
mapping/pacing. Không bật HTTP debug khi dùng token thật.

## Đọc kết quả và giới hạn

Exit code 0 chỉ khi mọi request trả **202 với ACCEPTED/eventId/receivedAt hợp
lệ**, không lỗi HTTP và có ít nhất một accepted. Body 202 sai cũng làm test
FAIL. 401/403/409 dừng toàn lượt để sửa token/quyền/linkage; không retry POST.
503/timeout/mạng lỗi được đếm thất bại, không tự coi là dữ liệu đã vào SQL.

JSON gồm `workload` và `summary.metrics`:

- `http_reqs.values.count`: số request; `gps_accepted.values.count` và
  `gps_rejected.values.count`: số phản hồi đạt/không đạt contract.
- `http_req_failed.values.rate`: tỷ lệ HTTP không phải 202 hoặc lỗi mạng.
  Kèm `checks.values.rate` để phát hiện 202 có body sai.
- `http_req_duration.values`: HTTP latency, có `p(95)` và `p(99)`, đơn vị ms.
  Đây không phải thời gian API → Pub/Sub → Worker → SQL.
- `http_reqs.values.rate`: throughput đạt thực tế; nominal rate là
  `DRIVERS / SEND_INTERVAL_SECONDS`. Ví dụ 2/8 = 0.25 event/s, 500/8 = 62.5.

Scenario dùng constant-vus và elapsed-time pacing. Nếu request dưới interval,
VU ngủ phần thời gian còn lại; nếu API chậm hơn thì tốc độ giảm, không tạo
request chồng lấn để bù. Đây là closed model mô phỏng Driver, chưa chứng minh
offered load cố định hay baseline/peak NFR. Không thêm threshold latency tùy
ý trong tuần 8; đo 62.5/300 events/s và end-to-end thuộc công việc tiếp theo.

`infra/pubsub/worker-load-benchmark.mjs` được tham khảo về số Driver/nhịp và
manifest, nhưng chỉ chạy Map trong process. Không dùng throughput của script
đó hoặc lượt smoke mock để kết luận Pub/Sub/Worker/Cloud đạt hiệu năng.

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

Kết quả ngày 15/11/2026 trên nhánh `test/gps-ingest-load`, base `f28365d`:
44/44 test config/contract; 5/5 kịch bản smoke k6 đạt (6/6 accepted, mỗi Driver
3 mẫu, bốn đường âm trả mã lỗi đúng). `npm.cmd run check` exit 0: Worker/shared/
load 166, API 454, web 538 và health e2e 2 test đạt; 116 ca PostgreSQL/Firebase
emulator bị bỏ qua do chưa cấu hình. Chưa chạy API với Firebase/PubSub thật,
Worker/SQL, staging hoặc Cloud. Lượt triển khai chưa commit/push; sau bàn giao,
người dùng yêu cầu commit và push nhánh này. Chưa merge hoặc deploy.

Tham khảo API chính thức k6:
[constant-vus](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-vus/),
[VU ID](https://grafana.com/docs/k6/latest/javascript-api/k6-execution/),
[expectedStatuses](https://grafana.com/docs/k6/latest/javascript-api/k6-http/expected-statuses/),
[custom summary](https://grafana.com/docs/k6/latest/results-output/end-of-test/custom-summary/).
