# Kiểm tra tuần 2

Root: `npm ci --workspaces=false --prefix apps/web` theo web lockfile.

```powershell
npm run lint:web
npm run build:web
npm test --prefix apps/web --workspaces=false
npm run dev:web
```

Điền apps/web/.env theo .env.example với TV5; API base có /v1, Firebase Web config,
không service account/secret trong frontend. Không commit .env.
Tài khoản thử do vận hành provision/claim/linkage, không tự cấp role.

Mock tests: token/header/schema, validation biên/0/trống, cùng key/body khi retry,
deadline qua giữa retry, double-submit, empty/error/pagination/abort và Auth regression.
Browser mock chỉ ở công cụ test, không thêm mock production.

Thật: Customer login → Create → mã vận đơn → List/Detail/refresh/retry theo TC01.1/4/6;
TV1/6 đối chiếu SQL/transaction không trùng. Browser 390/768/1280px, Tab/Enter,
focus lỗi và reduced motion. Không dùng PII thật trong fixture hoặc log token.
Source hiện thiếu Shipment handler: cloud gate còn mở, không giả response.

## Browser mock reproducible

Node24 (harness import fixture TypeScript), Edge/Chromium có CDP. Tạo profile tạm riêng,
không dùng phiên đăng nhập thật. Vite: npm run dev --prefix apps/web --workspaces=false
-- --host 127.0.0.1 --port 5174 --strictPort. Edge headless cần --remote-debugging-port=9232
và --user-data-dir trỏ profile tạm. PowerShell Start-Process dùng -WindowStyle Hidden.
Chạy node openspec/week2-customer/verify-browser.mjs. Harness chỉ nhận origin local,
intercept Auth module/API trong browser test; không đổi source production. Screenshot
ghi thư mục temp; không commit. Đóng browser test và dev server riêng sau kiểm tra.
