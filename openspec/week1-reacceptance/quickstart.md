# Quickstart nghiệm thu lại tuần 1

Chạy ở root bằng Node >=22.12. Không chạy deploy/publish/migration để nghiệm thu.
Dùng dependency theo lockfile hiện có; nếu thiếu, cài sạch đúng package và giữ lockfile.

```powershell
npm run lint:web
npm run build:web
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run typecheck --workspace=@parcelflow/api
npm test --workspace=@parcelflow/api
npm run build --workspace=@parcelflow/api
```

Mở [Hosting Driver](https://int3326e.web.app/driver), Customer và Admin trên cùng domain.
Mở trực tiếp/tải lại ba cổng; đối chiếu bundle asset với `apps/web/dist/index.html` và hash.
Kiểm tra desktop 1280x900, mobile 390x844 và Tab/Enter cho các control chính.

Script browser có thể chạy lại bằng Edge/Chrome headless với **profile tạm riêng**, không
dùng profile cá nhân. Ví dụ PowerShell (điều chỉnh đường dẫn Edge theo máy, chọn cổng trống):

```powershell
$reviewProfile = Join-Path ([IO.Path]::GetTempPath()) ('parcelflow-review-' + [guid]::NewGuid().ToString('N'))
Start-Process 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -WindowStyle Hidden -ArgumentList @('--headless','--disable-gpu','--remote-debugging-port=9227',('--user-data-dir=' + $reviewProfile))
node openspec/week1-reacceptance/verify-browser.mjs
```

Script đọc Hosting/bundle và thao tác emitter mẫu, không submit đơn hoặc gửi GPS.
`PARCELFLOW_REVIEW_CDP` đổi địa chỉ debug nếu cổng khác; `PARCELFLOW_REVIEW_ORIGIN` đổi
origin kiểm tra. Dừng đúng browser/profile tạm sau kiểm tra; không kill mọi tiến trình Edge.

Emitter: ban đầu 0/dừng; Start một timer; chờ hai chu kỳ 8 giây; Stop rồi đợi hơn 8 giây
không có mẫu mới; Restart tiếp tục đếm; chuyển cổng trong SPA dọn timer; kiểm tra không
request GPS/quyền vị trí. Reload trang là phiên stub mới, không yêu cầu giữ mẫu bền.

Local liveness (hai terminal, chọn cổng chưa dùng; không ghi đè `.env`):

```powershell
# Root: trỏ Pub/Sub về emulator local để không dùng topic cloud trong smoke test.
$env:PORT='18080'
node --env-file=.env.example dist/apps/worker/src/main.js
# Terminal khác: curl.exe -i http://127.0.0.1:18080/healthz

# API: chạy từ apps/api, dùng project Firebase mẫu; không verify token/DB trong health.
# $env:PORT='18081'; $env:FIREBASE_PROJECT_ID='int3326e'; npm start
# Terminal khác: curl.exe -i http://127.0.0.1:18081/healthz
```

Ghi nếu emulator chưa bật; health 200 không chứng minh queue. Dừng đúng tiến trình smoke
do mình tạo, không dừng service người khác. Không tái kiểm thử Hello World đã được nghiệm thu.

Public health theo issue #9:

- `https://backend-service-wcvss3dnxa-as.a.run.app/healthz/`
- `https://worker-service-wcvss3dnxa-as.a.run.app/healthz/`

Ghi HTTP/body/date và lỗi truy cập nếu có. Không suy ra metadata revision, SQL/IAM/budget
hoặc nghiệp vụ từ HTTP 200. Kết quả thực tế đi vào acceptance.md, không đánh dấu từ hướng dẫn này.
