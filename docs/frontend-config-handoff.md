# Bàn giao cấu hình frontend cho TV5

| | |
| --- | --- |
| Người phụ trách | Đỗ Đức Đạt (TV6) |
| Ngày | 18/10/2026 |
| Commit | `87bb551` (PR #16) |
| Môi trường đã kiểm | Local; thăm dò HTTP chỉ đọc trên Cloud Run revision `backend-service-00012-m54` |
| Chưa kiểm | Đăng nhập trên Hosting, quyền Firebase của runtime, CORS sau khi deploy |

Frontend build được với Firebase Auth từ PR #15. Deploy Hosting cần thêm backend có các route Auth/Admin và CORS nêu dưới đây.

## Cấu hình build

Tạo `apps/web/.env.production.local` (Git bỏ qua file này), hoặc đặt các biến trong môi trường build. Lấy `apiKey` và `appId` từ cấu hình Firebase Web app do TV5 cung cấp, thay cả hai giá trị mẫu trước khi build.

```dotenv
VITE_API_URL=https://backend-service-wcvss3dnxa-as.a.run.app/v1
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=int3326e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=int3326e
VITE_FIREBASE_APP_ID=your-firebase-app-id
```

`apps/web/src/api/client.ts` đọc URL của API. `apps/web/src/features/auth/firebase.ts` đọc bốn biến Firebase còn lại. Ứng dụng hiện không dùng cấu hình Storage, Messaging, Analytics.

Vite nạp file env từ `apps/web`, không phải gốc repo. Giá trị từ shell hoặc CI ghi đè file env, file riêng cho production ghi đè file env chung. Giá trị `VITE_*` là công khai và nhúng vào bundle lúc build, nên đổi giá trị thì phải build lại. Không đưa mật khẩu, token, ADC hay service account vào các biến này. Không đặt `VITE_FIREBASE_AUTH_EMULATOR_URL` cho Hosting và không dùng API URL localhost trong bundle đã deploy.

## Build và deploy Hosting

Dùng Node.js >= 22.12.0 theo `package.json` gốc. Từ gốc repo:

```bash
cd apps/web
npm ci --workspaces=false
npm run lint
npm test
npm run build
npx --yes firebase-tools deploy --only hosting --project int3326e
```

Script build chạy `tsc -b && vite build`, kết quả ở `apps/web/dist`. Chạy Firebase CLI từ `apps/web`: `firebase.json` xuất bản `dist` và rewrite route SPA về `/index.html`, `.firebaserc` chọn project `int3326e`. TV5 phải đăng nhập Firebase CLI bằng tài khoản có quyền Hosting trước khi chạy lệnh deploy.

## Yêu cầu backend và điểm nghẽn đã quan sát

Ngày 18/10/2026, Cloud Run API xác nhận URL dịch vụ ở trên (không có `/v1`). Revision đang phục vụ là `backend-service-00012-m54`. Các thăm dò HTTP chỉ đọc cho kết quả:

| Request | Kết quả quan sát |
| --- | --- |
| GET `/healthz/` | 200, JSON liveness của API |
| GET `/healthz` | 404 |
| GET `/v1/auth/me`, có hoặc không dấu `/` cuối | 404 |
| GET `/v1/admin/me` | 404 |
| OPTIONS `/v1/auth/me` từ `https://int3326e.web.app` | 404, không có header allow-origin |

Trước khi nghiệm thu, TV5 phải deploy backend có code Auth/Admin đã merge, rồi ghi lại SHA nguồn và revision đang phục vụ. Làm theo hướng dẫn build/container trong [api-scaffold.md](api-scaffold.md) và quy trình deploy của TV5. Repo không quy định sẵn lệnh deploy Cloud Run cho backend.

Kiểm tra `FIREBASE_PROJECT_ID=int3326e`, `NODE_ENV=production`, `PORT` do Cloud Run cấp, và ADC của runtime có quyền `firebaseauth.users.get`. Không cấu hình Firebase Auth emulator. CORS phải cho phép origin `https://int3326e.web.app`, header `Authorization` và `Content-Type`, và OPTIONS phải thành công trước các guard xác thực. Nếu phục vụ cả domain `int3326e.firebaseapp.com` thì kiểm tra origin đó. Xác nhận đăng nhập email/password và danh sách authorized domains của Firebase. Lượt đọc cấu hình Auth project bằng tài khoản operator trả 403, nên các cài đặt này chưa được xem.

Sau khi deploy, kiểm tra:
- `/v1/auth/me` không token trả 401.
- Token thật của ba tài khoản thử có sẵn trả 200 với UID và role đúng.
- `/v1/admin/me` trả 200 cho ADMIN và 403 cho CUSTOMER/DRIVER.
- Đăng nhập trên Hosting, điều hướng theo role, reload, đăng xuất và vào thẳng `/admin`.

Không cấp lại role.

## Phạm vi kiểm chứng

Kiểm tra local ngày 18/10/2026 đạt: production build gồm typecheck, ESLint, 29 test frontend trong ba file, và smoke test trên trình duyệt thấy form đăng nhập, `/admin` khi chưa đăng nhập được chuyển về `/login`. Bundle đã build dùng đúng API URL đã deploy và cấu hình Firebase được cấp. Build có cảnh báo không gây lỗi về chunk JavaScript lớn hơn 500 kB.

Cấu hình công khai của Firebase Management và Hosting khớp cả bảy trường TV5 cung cấp. Các test token thật trong lượt kiểm tra TV6 trước đó chạy trên backend local, không chứng minh được nghiệm thu end-to-end trên Cloud Run hay Hosting. Đăng nhập trên Hosting, quyền Firebase của runtime và CORS sau deploy vẫn chưa kiểm chứng. Khi soạn bản bàn giao này, không có thao tác deploy, đổi IAM/tài khoản/role hay đụng Cloud SQL.
