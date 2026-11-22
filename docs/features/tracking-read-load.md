# Tracking read dưới tải polling — TV3 tuần 9

Nguồn: [PF SPEC 01 v1.4](https://docs.google.com/document/d/1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8/edit),
roadmap tuần 9 (TV3), NF04 và LT04. Đo API09 và UI Customer/Admin khi
polling; giữ nguyên API, phân quyền, ETA và luồng GPS.

## Công cụ và cách chạy

`infra/load/tracking-read.mjs` dùng Node fetch, không thêm dependency.
Chỉ gửi GET `/v1/shipments/:id/tracking`. Chuẩn bị file local theo
`infra/load/tracking-fixtures.example.json`: mỗi dòng có shipmentId và Firebase
ID token CUSTOMER chủ đơn hoặc ADMIN. Giữ file thật trong `.vitest/`, không
commit hoặc đưa token vào dòng lệnh. Kiểm tra JWT trước chạy chỉ đọc claims;
chữ ký, quyền và ownership vẫn do API xác minh.

Chạy từ gốc repo sau khi TV4/TV5 thống nhất cửa sổ đo và môi trường sẵn sàng:

```powershell
$env:BASE_URL = 'https://<api-host>/v1'
$env:TRACKING_FIXTURES_FILE = (Resolve-Path '.vitest/tracking-fixtures.json').Path
$env:TRACKING_ENVIRONMENT = 'Cloud; API revision <revision>; source <sha>'
$env:POLLERS = '500'
$env:WARMUP_SECONDS = '60'
$env:DURATION_SECONDS = '600'
$env:REQUEST_TIMEOUT_MS = '5000'
$env:POLL_INTERVAL_SECONDS = '5'
$env:SUMMARY_PATH = '.vitest/tracking-read/5s.json'
node infra/load/tracking-read.mjs

$env:POLL_INTERVAL_SECONDS = '10'
$env:SUMMARY_PATH = '.vitest/tracking-read/10s.json'
node infra/load/tracking-read.mjs
```

LT04 yêu cầu hai lượt riêng: **500 poller, chu kỳ 5s (100 request/s) và
10s (50 request/s), mỗi lượt đo 10 phút**; warm-up tách riêng. Token phải còn
hạn tới hết lượt đo và timeout. Mỗi poller giữ fixture cố định, không có
request chồng trên cùng poller. Có thể lặp fixture để đo hot read, nhưng phải
ghi số fixture và phân bố dữ liệu; 500 poller không đồng nghĩa 500 tài khoản
hay 500 trình duyệt.

Scheduler đặt lịch theo thời điểm bắt đầu. Slot lỡ hoặc poller còn request
đang chạy được ghi `dropped`, không gửi dồn bù. 401/403/404/409 dừng lượt để
sửa fixture/quyền. Công cụ không đo FPS/render của 500 browser.

## Đọc kết quả

JSON tách `warmup` và `measurement`, kèm raw `records` từng slot; không ghi
token, header, response body hay tọa độ. Latency từ gửi request đến đọc hết
body. `p95CompletedMs` dùng nearest-rank trên tất cả HTTP hoàn tất, gồm HTTP
lỗi; timeout/network failure ghi riêng và vẫn nằm trong tổng mẫu. Không lấy
trung bình các p95. `requestRate` là số bắt đầu chia thời gian đo; đối chiếu
với `expectedRequestsPerSecond`, `scheduled`, `expected`, `dropped`,
`completed`, `success`, `failed`, `timeouts` để đánh giá đủ tải.

NF04 đặt p95 dưới 300ms. `latencyAndWorkloadPass` chỉ true nếu đủ slot,
không lỗi/timeout/bỏ lượt và p95 đạt. `fullLt04Window` chỉ xác nhận kích thước
workload, không tự kết luận Cloud đạt. Bổ sung revision/SHA, cold/warm, máy
phát tải, số fixture, cấu hình Cloud Run/SQL/pool và số đo tài nguyên từ TV5
trước khi TV6 đối chiếu NFR. Giữ cả JSON thất bại khi bàn giao.

Response kiểm theo SC05: fresh/stale/missing/hidden, GPS/timestamp đồng bộ,
ETA/null đúng trạng thái; HTTP 200 sai contract tính là thất bại. UI hiện nhãn
cập nhật và khóa tải lại khi request còn chạy. Không đổi khoảng polling hoặc
tự tính ETA để cải thiện số đo.

## Kiểm tra local và phần còn mở

```powershell
npm.cmd test -- infra/load/tracking-read.spec.ts
node --experimental-strip-types infra/load/tracking-read-smoke.mjs
npm.cmd run check
```

Smoke cần API đã build (gate `check` có build API); runner dùng fixture web
integration, tạo Nest/PGlite riêng trong RAM và mock Firebase. Không đọc
DATABASE_URL hoặc tạo bảng trong Cloud SQL. Kết quả ở
`.vitest/tracking-read-smoke/report.json`; không phải NF04/LT04 Cloud.

[Bằng chứng ngày 18/11/2026](../evidence/tracking-read-week9/report.md):
check toàn repo, HTTP smoke và browser 390/1440px. LT04 đầy đủ trên Cloud và
stale/null trong cửa sổ tải thật **chưa chạy**; chờ deploy và cấu hình đo của
nhóm. Không deploy hoặc thay Cloud/IAM/secret trong lượt này.
