# Bàn giao Auth và RBAC

| | |
| --- | --- |
| Người phụ trách | Đỗ Đức Đạt (TV6), làm bằng Codex nên Git ghi tác giả `Codex` |
| Ngày | 17/10/2026, follow-up review PR #15 |
| Commit | `fe0b6e2`, `16f0cb1` (đã vào `develop` qua PR #15) |
| Môi trường đã kiểm | Local, mock/HTTP và Firebase Auth Emulator |
| Chưa kiểm | Firebase production, browser end-to-end trên Hosting, đo latency/NFR trên cloud |

Ghi chú 07/11/2026: các câu "chưa có handler Shipment" ở mục 6 đúng tại 17/10. Hiện Create và Assign đã có handler, kết quả kiểm tra ở [week-07](week-07.md#kết-quả-chạy-07112026).

Hợp đồng và quy tắc nằm ở [Hợp đồng Auth và RBAC](../auth-rbac.md). Tài liệu này chỉ ghi phần tích hợp tuần 2, cách vận hành và kết quả kiểm tra.

## Phạm vi

Phạm vi đã được người yêu cầu xác nhận: giữ ba role `CUSTOMER`, `DRIVER`, `ADMIN`; Admin kiêm điều phối. Hoàn thiện custom claims, guard và luồng đăng nhập. Follow-up review bổ sung đường đọc user nghiệp vụ từ PostgreSQL hiện có; không tạo database, migration, Cloud Functions, role thứ tư, đăng ký tự chọn quyền hoặc logic Shipment/GPS.

## 1. Hành vi và ranh giới tin cậy

- Firebase Admin SDK kiểm tra ID Token với `checkRevoked=true`. Backend đọc UserRecord hiện tại để từ chối account bị disabled, role thiếu/sai hoặc token có role khác claim hiện tại. Việc đọc này cũng chặn token Admin cũ sau khi hạ quyền trong cùng một giây. Không lấy role từ header/body do client gửi.
- AuthModule áp dụng FirebaseAuthGuard trước RolesGuard cho toàn bộ handler. Chỉ `@Public()` bỏ qua; health vẫn public. Không gắn lại `@UseGuards` ở controller để tránh xác thực SDK hai lần.
- `GET /v1/auth/me`: mọi role hợp lệ; trả `{uid,email?,role}`. `GET /v1/admin/me`: chỉ ADMIN; role khác nhận 403. Cả hai trả `Cache-Control: no-store`. API nghiệp vụ khác vẫn là draft/chưa có handler.
- Token thiếu, sai, hết hạn, bị thu hồi; account bị vô hiệu hóa; claim không hợp lệ hoặc cũ: 401. Token/account hợp lệ nhưng không đúng role của handler: 403. Lỗi SDK/chi tiết credential không trả về client.
- CORS dùng danh sách origin chính xác, cho Authorization/Content-Type/Idempotency-Key; preflight qua trước guard. `CORS_ORIGINS` có thể cấu hình theo `.env.example`; không dùng wildcard. CORS không thay thế kiểm tra token.
- Frontend dùng Firebase Web SDK email/password, session persistence trong phiên trình duyệt, không có user demo hoặc role mặc định. AuthProvider được gắn vào ứng dụng; profile/role được xác nhận qua API `/auth/me`, UID phải trùng tài khoản Firebase đang đăng nhập.
- Route Customer/Driver/Admin kiểm tra đúng role; `/` và đăng nhập thành công đưa tới trang của role. Đăng xuất xóa trạng thái; response cũ không khôi phục session sau logout. Đổi token cùng tài khoản không làm unmount màn hình đang nhập. API client lấy ID Token hiện tại khi gọi API, không lưu token riêng vào localStorage. Không log token hoặc mật khẩu.

## 2. Cấp/đổi claims từ môi trường tin cậy

Chạy từ root repo bằng account operator có quyền Firebase Auth. Tài khoản phải được tạo trước trong Firebase Console; CLI không tạo user hoặc sửa mật khẩu. Dùng UID chính xác, không dùng email thay UID. Ví dụ dưới là hướng dẫn vận hành, **chưa được chạy trên project thật trong lượt triển khai này**.

```sh
npm run auth:set-role --workspace=@parcelflow/api -- \
  --project int3326e --uid TARGET_UID --role DRIVER --expect-role NONE
```

Lệnh mặc định chỉ đọc/preview. Kiểm tra UID, project và role; sau khi người vận hành xác nhận, chạy lại với `--apply`. `--expect-role` phải khớp giá trị hiện tại (`NONE`, `CUSTOMER`, `DRIVER`, `ADMIN`); project phải khớp `FIREBASE_PROJECT_ID` nếu biến này đã cấu hình. Không có endpoint HTTP cấp role hoặc nút tự nâng quyền trên frontend.

Khi đổi role, CLI giữ các custom claims không liên quan, kiểm tra giới hạn 1000 byte, ghi claim `role`, thu hồi refresh tokens và đọc lại role. User phải đăng nhập lại. Role không đổi trả `unchanged`, không thu hồi phiên. Nếu ghi role thành công nhưng thu hồi phiên lỗi, CLI trả lỗi rõ việc ghi đã xảy ra; operator phải xử lý thu hồi phiên, không báo hoàn thành giả. Không log credential/token/email.

Công cụ dùng read-merge-write, không có compare-and-swap của Firebase: chỉ một operator sửa claims của cùng UID tại một thời điểm; `--expect-role` không phải cơ chế khóa phân tán. Nếu hệ thống khác cũng sửa custom claims, phải phối hợp tuần tự để tránh ghi đè.

## 3. Hướng dẫn tích hợp Firebase thật với TV3/TV5

1. TV5 xác nhận Firebase Authentication email/password đã bật trong project `int3326e`, domain Hosting được cho phép; lấy Firebase Web App configuration từ Console. TV3 điền `apps/web/.env` theo `.env.example`, gồm `VITE_API_URL=https://backend-service-wcvss3dnxa-as.a.run.app/v1`, project ID, API key Web, authDomain, appId. Giá trị `VITE_*` là cấu hình public trong bundle, tuyệt đối không đưa service-account JSON/private key vào frontend.
2. Runtime backend dùng ADC/service account đúng project, có quyền đọc Firebase UserRecord để kiểm tra revoked/disabled/current claims. Operator cấp role dùng credential riêng có quyền cập nhật Firebase Auth; không cần trao quyền cấp role cho frontend hay runtime chỉ đọc. Không thay IAM hoặc tạo key trong bản thay đổi này.
3. Chuẩn bị ba tài khoản thử nghiệm và cấp từng role qua CLI ở trên sau xác nhận operator. Không tự gán CUSTOMER khi claim thiếu, không tự tạo Admin công khai. Người đã được cấp/đổi role đăng nhập lại.
4. Build/deploy backend và Hosting theo quy trình repo sau review. Trên production không đặt `FIREBASE_AUTH_EMULATOR_HOST` hoặc `VITE_FIREBASE_AUTH_EMULATOR_URL`. Backend từ chối emulator trong NODE_ENV=production; frontend chỉ cho emulator ở Vite DEV, project `demo-*`, URL loopback.
5. Nghiệm thu từng tài khoản: login → đúng trang role → `/v1/auth/me` đúng UID/role; Customer/Driver vào `/v1/admin/me` nhận 403, Admin nhận 200; bỏ/sửa token nhận 401. Đổi Admin thành Customer, token Admin cũ phải bị từ chối; đăng nhập lại cho role mới. Kiểm tra logout, reload và làm mới ID Token.

Không coi health 200 là xác nhận Firebase Auth hoạt động. Backend hiện thêm account lookup trên mỗi request để kiểm tra quyền hiện tại; chưa đo latency/p95 của Firebase thật hoặc chạy load test.

## 4. Kiểm thử và trạng thái nghiệm thu

```sh
npm ci --no-audit --no-fund
npm run typecheck --workspace=@parcelflow/api
npm run build --workspace=@parcelflow/api
npm test --workspace=@parcelflow/api
npm run lint:web
npm run build:web
npm test --workspace=@parcelflow/web
```

Auth emulator được cô lập ở project `demo-parcelflow`, cổng loopback, không dùng credential/project production:

```sh
npm exec --yes --package=firebase-tools@15.34.0 -- firebase emulators:exec \
  --only auth --project demo-parcelflow \
  --config infra/firebase/auth-emulator.json \
  'FIREBASE_PROJECT_ID=demo-parcelflow npm run test:auth:emulator --workspace=@parcelflow/api'
```

Test emulator tạo/xóa tài khoản dùng riêng cho từng lượt, dùng Admin SDK thật để cấp/đổi claims, đăng nhập email/password qua Auth REST emulator và gọi NestJS API thật. Kiểm tra ba role, 401/403, token hết hạn, token role cũ sau downgrade và account disabled. Emulator dùng token không kiểm tra chữ ký như production; không suy ra đã nghiệm thu chữ ký/token thật trên Firebase cloud từ kết quả này. Bộ test thường skip emulator nếu chưa bật `RUN_FIREBASE_AUTH_EMULATOR_TESTS=1`; đó không phải lỗi và cũng không được tính là đã chạy emulator.

- Source, mock/HTTP tests và emulator: xem kết quả lượt kiểm tra local bên dưới.
- Firebase cloud end-to-end: **chưa nghiệm thu**, cần cấu hình/tài khoản và quyền ADC ở mục 3.
- Chưa deploy hoặc sửa tài khoản production trong lượt làm việc này. Không đánh dấu toàn bộ tuần 2 hoàn thành chỉ từ source; trạng thái review và merge được theo dõi trên pull request.

Tài liệu chính thức đã đối chiếu:

- https://firebase.google.com/docs/auth/admin/custom-claims
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
- https://firebase.google.com/docs/auth/admin/manage-sessions
- https://firebase.google.com/docs/auth/web/password-auth

## 5. Kết quả local ngày 17/10/2026

- Root npm ci từ lockfile cuối: đạt; giữ phiên bản Vite/PostCSS/Nanoid có sẵn, không nâng các gói này ngoài phạm vi. jsdom 26.1.0 tương thích Node tối thiểu của repo, khai báo ở root cho Vitest dùng chung và ở web để cài độc lập.
- API typecheck/build: đạt; 90 tests local/mock/HTTP đạt; 7 tests emulator được skip trong lệnh test thường và đã chạy riêng thành công.
- Frontend lint/build: đạt; 29 tests session/routing/API token reader đạt sau cài sạch. Không có lỗi lint frontend. Build còn cảnh báo kích thước bundle sau khi thêm Firebase SDK; chưa tối ưu bundle ngoài phạm vi.
- Worker typecheck/build/lint và hai health tests (unit + HTTP): đạt; lint còn cảnh báo scaffold và cấu hình strictNullChecks có sẵn.
- Firebase Auth Emulator với SDK/NestJS thật: 7/7 tests đạt; đã dọn các tài khoản thử và dừng emulator.
- Tổng: 121 kiểm tra local và 7 ca emulator đạt, không tính ca skip thành ca pass. Chưa có bằng chứng Firebase production hoặc browser end-to-end trên Hosting.

## 6. Follow-up review PR #15 — danh tính nghiệp vụ và lỗi dependency

- Giữ CUSTOMER/DRIVER/ADMIN. Không thêm DISPATCHER và không cache role 30–60 giây vì sẽ thay đổi hiệu lực hạ quyền hiện tại.
- Firebase SDK vẫn dùng verifyIdToken(token, true) và getUser. SDK tự đọc UserRecord khi checkRevoked=true, vì vậy hiện có hai lượt account lookup nối tiếp. Chưa có số liệu p95 trên Firebase thật; không tuyên bố đạt hoặc vi phạm NF03/NF04. Tối ưu sau đo phải giữ kiểm tra chữ ký, thu hồi, disabled và role hiện tại.
- Token sai/hết hạn/thu hồi/account disabled: 401 UNAUTHENTICATED. Lỗi mạng, SDK nội bộ hoặc credential/IAM backend: 503 SERVICE_UNAVAILABLE. Lỗi dependency không bị đổi thành thông báo token sai. Response không lộ lỗi SDK, địa chỉ SQL, credential hoặc query string.
- ApiExceptionFilter trên AppModule trả application/problem+json với type, title, status, code, instance và timestamp. Nó không thay response thành công của health hoặc profile.
- UsersRepository đọc bằng truy vấn tham số hóa, chỉ lấy id, firebaseUid, role từ bảng users theo schema Prisma nháp hiện có. DATABASE_URL do runtime cung cấp; pg Pool mở kết nối lười, tối đa 5 kết nối, timeout kết nối/query 5 giây. Không tắt kiểm tra chứng chỉ TLS. Pool được đóng khi Nest shutdown.
- UsersService.requireBusinessUser dùng Firebase uid đã verify để tìm user. Không có row, nhiều row, ID trống hoặc role/UID lệch trả 409 USER_NOT_PROVISIONED; không tự INSERT user hoặc nâng quyền. Không có DATABASE_URL hoặc SQL lỗi trả 503, không giả thành tài khoản chưa provision.
- BusinessUserGuard chạy sau global authentication/RolesGuard và gắn request.businessUser = {id,firebaseUid,role}. ShipmentsController đã gắn guard; chưa có handler Shipment thật nên chưa thể nghiệm thu Create. TV1 dùng request.businessUser.id cho customerId/driverId và vẫn kiểm tra ownership trong service. Với controller nghiệp vụ khác, import UsersModule và dùng BusinessUserGuard trước khi nhận traffic; không lấy actor từ body.
- /v1/auth/me và /v1/admin/me chỉ xác nhận danh tính/quyền Firebase, không yêu cầu row nghiệp vụ. Health không kết nối SQL.
- CORS đã cho Idempotency-Key để browser có thể gọi Create khi TV1 triển khai API. Contract nghiệp vụ còn draft, các response 409 đã ghi USER_NOT_PROVISIONED.

Phụ thuộc bắt buộc trước nghiệm thu nghiệp vụ: TV1 hoàn thiện migration và seed user với unique firebaseUid và role đồng bộ custom claim; TV5 cung cấp DATABASE_URL trỏ đúng database/runtime. SQL hiện dùng tên cột của packages/database/prisma/schema.prisma: users.id, users."firebaseUid", users.role. Nếu schema cuối đổi tên, phải sửa adapter và kiểm tra lại; không sửa database thật hoặc coi schema nháp là migration đã chạy.

Đo trên cloud sau khi có cấu hình/tài khoản: tách thời gian verifyIdToken và getUser trong trace, đo tổng latency endpoint với cả user lookup khi có nghiệp vụ; ghi revision/source SHA, số mẫu, concurrency, warm/cold và p95. Một vài request /auth/me chỉ là smoke test, không chứng minh NFR Create/Assign hoặc tracking. Không dùng số đo emulator thay cho Firebase production.

Kết quả follow-up local: 111 API tests đạt sau npm ci độc lập từ apps/api/package-lock.json; typecheck/build đạt. Firebase Auth Emulator chạy riêng 7/7 đạt, đã dọn tài khoản và tắt emulator. Lint exit 0, chỉ còn cảnh báo scaffold có sẵn. Các test user linkage dùng Firebase/SQL mock với HTTP Nest thật, chưa phải PostgreSQL/Cloud SQL integration. Chưa chạy migration/seed, Firebase production, deploy hoặc đo NFR cloud. PR tiếp tục Draft.
