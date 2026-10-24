# Auth & RBAC Contract — v0.4 (TV6 tuần 2)

## 1. Scope

Tài liệu này mô tả bản nháp cơ chế xác thực và phân quyền cho ParcelFlow.

Phạm vi tuần 1 đã nghiệm thu (hồ sơ lịch sử):

- Phác thảo `AuthModule`.
- Phác thảo `AdminModule`, controller và service; chưa triển khai endpoint nghiệp vụ ở tuần 1.
- Xác định các role của hệ thống.
- Thống nhất cách backend nhận và xác thực Firebase ID Token.
- Xác định quy tắc trả về `401 Unauthorized` và `403 Forbidden`.
- Chuẩn bị cấu trúc để có thể kiểm thử bằng mock, chưa cần Firebase project thật.

## 2. Authentication

ParcelFlow sử dụng Firebase Authentication để xác thực người dùng.

Sau khi đăng nhập thành công ở frontend, client nhận Firebase ID Token và gửi token đó đến backend qua HTTP header:

```http
Authorization: Bearer <firebase-id-token>
```

Backend thực hiện các bước:

1. Kiểm tra header `Authorization`.
2. Lấy Bearer token.
3. Xác thực token bằng Firebase Admin SDK.
4. Chuẩn hóa thông tin người dùng.
5. Gắn thông tin người dùng vào request.
6. Chuyển request sang bước kiểm tra quyền truy cập.

Dữ liệu người dùng sau khi được chuẩn hóa:

```json
{
  "uid": "firebase-user-id",
  "email": "user@example.com",
  "role": "CUSTOMER"
}
```

Trong đó:

- `uid`: mã định danh người dùng do Firebase cấp.
- `email`: email của người dùng.
- `role`: quyền hiện tại của người dùng trong ParcelFlow.

## 3. Roles

Quyết định ngày 09/10/2026: giữ Admin và gộp chức năng điều phối vào role này; không có role Dispatcher riêng. Hệ thống có ba role:

| Role | Mô tả |
| --- | --- |
| `CUSTOMER` | Tạo và theo dõi đơn giao hàng của mình |
| `DRIVER` | Nhận nhiệm vụ giao hàng và cập nhật trạng thái |
| `ADMIN` | Điều phối đơn hàng, phân công tài xế và giám sát vận hành |

Trong phạm vi MVP, mỗi tài khoản chỉ có một role tại một thời điểm.

Implementation scaffold hiện đọc role từ Firebase custom claim `role` sau khi xác thực ID Token. Chỉ ba giá trị trên được chấp nhận; claim thiếu hoặc không hợp lệ sẽ bị từ chối với `401`. Quyết định tuần 2 do người yêu cầu xác nhận ngày 17/10/2026: Firebase custom claims là nguồn role cho tích hợp Auth; tiếp tục dùng ba role, không khôi phục Dispatcher. Backend đối chiếu claim trong token với claim hiện tại của Firebase UserRecord. Auth guard chỉ dùng `TokenVerifier`, không truy cập database trực tiếp.

## 4. Authentication rules

### 4.1 Missing token

Nếu request không có header `Authorization`, backend trả về:

```http
401 Unauthorized
```

Ví dụ response mặc định của NestJS trong scaffold:

```json
{
  "statusCode": 401,
  "message": "Authentication token is required",
  "error": "Unauthorized"
}
```

### 4.2 Invalid or expired token

Nếu Firebase ID Token không hợp lệ hoặc đã hết hạn, backend trả về:

```http
401 Unauthorized
```

Ví dụ response:

```json
{
  "statusCode": 401,
  "message": "Invalid or expired authentication token",
  "error": "Unauthorized"
}
```

### 4.3 Insufficient role

Nếu token hợp lệ nhưng người dùng không có role phù hợp, backend trả về:

```http
403 Forbidden
```

Ví dụ response:

```json
{
  "statusCode": 403,
  "message": "You do not have permission to access this resource",
  "error": "Forbidden"
}
```

### 4.4 Valid token and role

Nếu token hợp lệ và người dùng có role phù hợp, backend cho phép request tiếp tục đến controller.

## 5. Authorization rules

AuthModule đăng ký FirebaseAuthGuard rồi RolesGuard bằng APP_GUARD. Mọi handler mặc định yêu cầu đăng nhập; chỉ handler/controller có @Public() mới bỏ qua cả hai guard. GET /healthz là public. Khi thêm API mới, không cần gắn lại UseGuards; không đánh dấu public cho nghiệp vụ cần bảo vệ.

Endpoint yêu cầu role cụ thể dùng @Roles(...), sau bước xác thực toàn cục.

Ví dụ khai báo quyền trên controller hoặc handler dành cho điều phối viên:

```ts
@Roles(UserRole.ADMIN)
```

Quyền truy cập dự kiến:

| Khu vực API | Role được phép |
| --- | --- |
| API công khai | Không yêu cầu role |
| API khách hàng | `CUSTOMER` |
| API tài xế | `DRIVER` |
| API điều phối | `ADMIN` |

Bảng quyền chi tiết sẽ được cập nhật khi API contract của các module được thống nhất.

## 6. Auth module structure

Cấu trúc dự kiến:

```text
auth/
├── decorators/
│   └── roles.decorator.ts
├── guards/
│   ├── firebase-auth.guard.ts
│   └── roles.guard.ts
├── interfaces/
│   ├── authenticated-user.interface.ts
│   ├── authenticated-request.interface.ts
│   └── token-verifier.interface.ts
├── enums/
│   └── user-role.enum.ts
├── services/
│   └── firebase-token-verifier.service.ts
├── providers/
│   └── firebase-auth.provider.ts
└── auth.module.ts
```

Trách nhiệm của từng thành phần:

### `TokenVerifier`

Abstraction dùng để xác thực token.

Auth guard chỉ phụ thuộc vào interface này, giúp unit test bằng mock mà chưa cần kết nối Firebase thật.

### `FirebaseTokenVerifierService`

Implementation sử dụng Firebase Admin SDK để xác thực Firebase ID Token.

Service nhận Firebase Auth qua dependency injection. Provider khởi tạo default Firebase app bằng Application Default Credentials (ADC), dùng `FIREBASE_PROJECT_ID` nếu được cấu hình và tái sử dụng default app đã tồn tại. Chỉ backend tin cậy được phép cấp custom claim; frontend không tự chọn role.

### `FirebaseAuthGuard`

Có trách nhiệm:

- Đọc header `Authorization`.
- Kiểm tra định dạng `Bearer <token>`.
- Gọi `TokenVerifier`.
- Gắn người dùng đã xác thực vào request.
- Trả về `401` nếu xác thực thất bại.

### `@Roles(...)`

Decorator dùng để khai báo các role được phép truy cập endpoint.

### `RolesGuard`

Có trách nhiệm:

- Đọc role yêu cầu từ metadata.
- Đọc người dùng đã xác thực từ request.
- So sánh role của người dùng với role được yêu cầu.
- Trả về `403` nếu người dùng không đủ quyền.

### `AuthenticatedUser`

Kiểu dữ liệu chuẩn của người dùng sau khi xác thực:

```ts
export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role: UserRole;
}
```

### `AdminModule`

Scaffold gồm `admin.module.ts`, `controllers/admin.controller.ts` và `services/admin.service.ts`. Module import `AuthModule` để nhận các guard qua dependency injection. Guard tuần 2 được áp dụng toàn cục; controller khai báo `@Roles(UserRole.ADMIN)`; các handler sau này trong controller dùng quyền Admin mặc định. Bản Admin directory ngày 23/10/2026 thêm `GET /v1/drivers` và `GET /v1/admin/customers`, đều dùng `BusinessUserGuard` cho liên kết SQL; `/admin/me` vẫn độc lập SQL. Contract và phụ thuộc ở [Admin directory](tv6-admin-directory.md), kịch bản nghiệm thu ở [QA test plan](qa-test-plan.md).

Tuần 1 chưa cung cấp endpoint hoặc logic quản trị/điều phối. Tuần 2 bổ sung GET /v1/admin/me chỉ để xác minh danh tính/quyền Admin; không triển khai nghiệp vụ phân công hoặc cấp quyền qua HTTP. TV1 đăng ký `AdminModule` vào `AppModule` khi tích hợp bootstrap. Không tạo tài khoản Admin, cấp custom claim hoặc mở quyền từ frontend trong scaffold này.

Phạm vi Admin bám theo các màn hình hiện có của TV3; Admin là người điều phối vận hành:

| Route frontend | Chức năng |
| --- | --- |
| `/admin` | Tổng quan vận hành và đơn hàng |
| `/admin/shipments` | Xem, tìm kiếm và lọc toàn bộ đơn hàng |
| `/admin/assignment` | Phân công tài xế cho đơn hàng |
| `/admin/drivers` | Theo dõi danh sách tài xế và trạng thái hoạt động |
| `/admin/live-map` | Xem vị trí và trạng thái tài xế trên bản đồ |

Các route trên là màn hình frontend, không phải endpoint REST mới. Contract Shipment, Assignment và Tracking sẽ được thống nhất với TV1/TV3 khi tích hợp. Trang `/admin/accounts` hiện là bảng dữ liệu mẫu của TV3; chức năng cấp quyền hoặc quản lý tài khoản thật chưa thuộc scaffold TV6 tuần 1.

## 7. Test cases

### Authentication tests

1. Không gửi header `Authorization` → trả về `401`.
2. Header không sử dụng Bearer scheme → trả về `401`.
3. Bearer token rỗng → trả về `401`.
4. Token không hợp lệ → trả về `401`.
5. Token hết hạn → trả về `401`.
6. Token hợp lệ → gắn `AuthenticatedUser` vào request.

### Authorization tests

1. Người dùng chưa xác thực truy cập endpoint protected → trả về `401`.
2. Role `CUSTOMER` truy cập endpoint yêu cầu `ADMIN` → trả về `403`.
3. Role `DRIVER` truy cập endpoint yêu cầu `ADMIN` → trả về `403`.
4. Role `ADMIN` truy cập endpoint yêu cầu `ADMIN` → request thành công.
5. Role `CUSTOMER` truy cập endpoint yêu cầu `CUSTOMER` → request thành công.
6. Role `DRIVER` truy cập endpoint yêu cầu `DRIVER` → request thành công.
7. Endpoint dùng `FirebaseAuthGuard` nhưng không khai báo role → người dùng đã xác thực được phép truy cập.

### Mocking strategy

Unit test sử dụng mock implementation của `TokenVerifier`.

Các file `*.spec.ts` dùng Vitest. Unit test kiểm tra token/header, ba role, claim không hợp lệ và Firebase initialization; HTTP integration test khởi tạo NestJS với `AuthModule` thật và mock Firebase Auth để kiểm tra response `401`, `403`, `200`. Controller trong test chỉ là fixture, không thêm endpoint nghiệp vụ vào ứng dụng.

Chạy độc lập từ `apps/api` với Node.js >= 20:

```bash
npm ci --workspaces=false
npm run typecheck
npm run build
npm run test:auth
```

Các kiểm tra không cần credentials hoặc Firebase project thật. TV1 đã bổ sung bootstrap và đăng ký Auth/Admin trong AppModule; xem `docs/api-scaffold.md` để chạy backend và kiểm tra public `GET /healthz`.

Ví dụ:

```ts
const tokenVerifier = {
  verify: vi.fn().mockResolvedValue({
    uid: 'test-user-id',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  }),
};
```

Việc này cho phép kiểm thử Auth và RBAC mà chưa cần:

- Firebase project thật.
- Firebase credentials.
- Cloud SQL.
- Prisma.
- GCP deployment.

## 8. Security requirements

- Không commit Firebase service account key vào Git.
- Không ghi toàn bộ token vào log.
- Không tin tưởng role do frontend tự gửi.
- Backend phải tự xác thực token và lấy role từ nguồn đáng tin cậy.
- Firebase credentials phải được cung cấp qua environment variables hoặc secret manager.
- Thông tin lỗi không được làm lộ credentials hoặc nội dung token.
- Mọi endpoint yêu cầu role phải được kiểm tra quyền ở backend.

## 9. Quyết định và phần tích hợp còn lại

Quyết định tuần 2 và các nội dung cần phối hợp:

- Đã chốt: role xác thực lấy từ Firebase custom claims, gồm CUSTOMER/DRIVER/ADMIN; không phụ thuộc PostgreSQL để xác thực.
- API scaffold đã dùng prefix `/v1` cho nghiệp vụ và giữ `/healthz` công khai ngoài prefix; contract nghiệp vụ vẫn là draft.
- Bản follow-up review dùng exception filter chung để trả ProblemDetails cho lỗi API, gồm 401/403/409/503. Các ví dụ response Nest ở phần tuần 1 là hồ sơ lịch sử.
- Đã có SQL lookup và BusinessUserGuard cho liên kết user; migration, seed và nghiệm thu Cloud SQL cần TV1/TV5 phối hợp, xem mục 12.6.

## 10. External dependencies

Việc tích hợp hoàn chỉnh phụ thuộc vào:

- NestJS skeleton và cấu trúc `apps/api` của TV1 đã có trên develop.
- Firebase project/configuration từ TV5.
- API contract chung của nhóm.
- Mapping UID Firebase với dữ liệu nghiệp vụ do nhóm tích hợp sau; không là điều kiện chạy auth/me.

API đã có firebase-admin, bootstrap và AuthModule. Tuần 2 dùng guard toàn cục, health được miễn bằng @Public(); không áp dụng lại guard cục bộ trên cùng controller. Module Shipment về sau vẫn phải kiểm tra quyền trên từng đơn hàng (chủ đơn hoặc tài xế được gán); RolesGuard không thay thế kiểm tra ownership.

Bản tích hợp tuần 2 ở mục 12 bổ sung frontend Firebase Web SDK; phạm vi tuần 1 được giữ làm hồ sơ lịch sử.

## 11. Firebase configuration và giới hạn tích hợp

- Cloud Run: dùng service account của runtime và ADC; TV5 xác nhận quyền và Firebase project. Không đưa JSON service account key vào repo.
- Local: cung cấp ADC hoặc `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới file credentials bên ngoài repo. Provider đọc biến môi trường đã có; bootstrap TV1 chịu trách nhiệm nạp `.env`.
- `FIREBASE_PROJECT_ID`: project Firebase cần xác thực, ví dụ `int3326e`; SDK dùng cấu hình ADC nếu không khai báo.
- Role custom claim chỉ nhận `CUSTOMER`, `DRIVER`, `ADMIN`. Claim `DISPATCHER` cũ bị từ chối. Nếu đã có tài khoản điều phối dùng claim này, người có quyền quản lý Firebase phải cập nhật custom claim thành `ADMIN` và refresh ID Token; client không tự cấp quyền.
- Tuần 2 bổ sung phần nối Auth của frontend và giữ giao diện hiện có. Không đổi Prisma hoặc worker. Cấp claims/cloud login cần nghiệm thu trên Firebase thật; đồng bộ dữ liệu nghiệp vụ và ProblemDetails cần phối hợp API contract của nhóm.

## 12. TV6 — Tích hợp tuần 2 (17/10/2026)

Phạm vi đã được người yêu cầu xác nhận: giữ ba role `CUSTOMER`, `DRIVER`, `ADMIN`; Admin kiêm điều phối. Hoàn thiện custom claims, guard và luồng đăng nhập. Follow-up review bổ sung đường đọc user nghiệp vụ từ PostgreSQL hiện có; không tạo database, migration, Cloud Functions, role thứ tư, đăng ký tự chọn quyền hoặc logic Shipment/GPS.

### 12.1. Hành vi và ranh giới tin cậy

- Firebase Admin SDK kiểm tra ID Token với `checkRevoked=true`. Backend đọc UserRecord hiện tại để từ chối account bị disabled, role thiếu/sai hoặc token có role khác claim hiện tại. Việc đọc này cũng chặn token Admin cũ sau khi hạ quyền trong cùng một giây. Không lấy role từ header/body do client gửi.
- AuthModule áp dụng FirebaseAuthGuard trước RolesGuard cho toàn bộ handler. Chỉ `@Public()` bỏ qua; health vẫn public. Không gắn lại `@UseGuards` ở controller để tránh xác thực SDK hai lần.
- `GET /v1/auth/me`: mọi role hợp lệ; trả `{uid,email?,role}`. `GET /v1/admin/me`: chỉ ADMIN; role khác nhận 403. Cả hai trả `Cache-Control: no-store`. API nghiệp vụ khác vẫn là draft/chưa có handler.
- Token thiếu, sai, hết hạn, bị thu hồi; account bị vô hiệu hóa; claim không hợp lệ hoặc cũ: 401. Token/account hợp lệ nhưng không đúng role của handler: 403. Lỗi SDK/chi tiết credential không trả về client.
- CORS dùng danh sách origin chính xác, cho Authorization/Content-Type/Idempotency-Key; preflight qua trước guard. `CORS_ORIGINS` có thể cấu hình theo `.env.example`; không dùng wildcard. CORS không thay thế kiểm tra token.
- Frontend dùng Firebase Web SDK email/password, session persistence trong phiên trình duyệt, không có user demo hoặc role mặc định. AuthProvider được gắn vào ứng dụng; profile/role được xác nhận qua API `/auth/me`, UID phải trùng tài khoản Firebase đang đăng nhập.
- Route Customer/Driver/Admin kiểm tra đúng role; `/` và đăng nhập thành công đưa tới trang của role. Đăng xuất xóa trạng thái; response cũ không khôi phục session sau logout. Đổi token cùng tài khoản không làm unmount màn hình đang nhập. API client lấy ID Token hiện tại khi gọi API, không lưu token riêng vào localStorage. Không log token hoặc mật khẩu.

### 12.2. Cấp/đổi claims từ môi trường tin cậy

Chạy từ root repo bằng account operator có quyền Firebase Auth. Tài khoản phải được tạo trước trong Firebase Console; CLI không tạo user hoặc sửa mật khẩu. Dùng UID chính xác, không dùng email thay UID. Ví dụ dưới là hướng dẫn vận hành, **chưa được chạy trên project thật trong lượt triển khai này**.

```sh
npm run auth:set-role --workspace=@parcelflow/api -- \
  --project int3326e --uid TARGET_UID --role DRIVER --expect-role NONE
```

Lệnh mặc định chỉ đọc/preview. Kiểm tra UID, project và role; sau khi người vận hành xác nhận, chạy lại với `--apply`. `--expect-role` phải khớp giá trị hiện tại (`NONE`, `CUSTOMER`, `DRIVER`, `ADMIN`); project phải khớp `FIREBASE_PROJECT_ID` nếu biến này đã cấu hình. Không có endpoint HTTP cấp role hoặc nút tự nâng quyền trên frontend.

Khi đổi role, CLI giữ các custom claims không liên quan, kiểm tra giới hạn 1000 byte, ghi claim `role`, thu hồi refresh tokens và đọc lại role. User phải đăng nhập lại. Role không đổi trả `unchanged`, không thu hồi phiên. Nếu ghi role thành công nhưng thu hồi phiên lỗi, CLI trả lỗi rõ việc ghi đã xảy ra; operator phải xử lý thu hồi phiên, không báo hoàn thành giả. Không log credential/token/email.

Công cụ dùng read-merge-write, không có compare-and-swap của Firebase: chỉ một operator sửa claims của cùng UID tại một thời điểm; `--expect-role` không phải cơ chế khóa phân tán. Nếu hệ thống khác cũng sửa custom claims, phải phối hợp tuần tự để tránh ghi đè.

### 12.3. Hướng dẫn tích hợp Firebase thật với TV3/TV5

1. TV5 xác nhận Firebase Authentication email/password đã bật trong project `int3326e`, domain Hosting được cho phép; lấy Firebase Web App configuration từ Console. TV3 điền `apps/web/.env` theo `.env.example`, gồm `VITE_API_URL=https://backend-service-wcvss3dnxa-as.a.run.app/v1`, project ID, API key Web, authDomain, appId. Giá trị `VITE_*` là cấu hình public trong bundle, tuyệt đối không đưa service-account JSON/private key vào frontend.
2. Runtime backend dùng ADC/service account đúng project, có quyền đọc Firebase UserRecord để kiểm tra revoked/disabled/current claims. Operator cấp role dùng credential riêng có quyền cập nhật Firebase Auth; không cần trao quyền cấp role cho frontend hay runtime chỉ đọc. Không thay IAM hoặc tạo key trong bản thay đổi này.
3. Chuẩn bị ba tài khoản thử nghiệm và cấp từng role qua CLI ở trên sau xác nhận operator. Không tự gán CUSTOMER khi claim thiếu, không tự tạo Admin công khai. Người đã được cấp/đổi role đăng nhập lại.
4. Build/deploy backend và Hosting theo quy trình repo sau review. Trên production không đặt `FIREBASE_AUTH_EMULATOR_HOST` hoặc `VITE_FIREBASE_AUTH_EMULATOR_URL`. Backend từ chối emulator trong NODE_ENV=production; frontend chỉ cho emulator ở Vite DEV, project `demo-*`, URL loopback.
5. Nghiệm thu từng tài khoản: login → đúng trang role → `/v1/auth/me` đúng UID/role; Customer/Driver vào `/v1/admin/me` nhận 403, Admin nhận 200; bỏ/sửa token nhận 401. Đổi Admin thành Customer, token Admin cũ phải bị từ chối; đăng nhập lại cho role mới. Kiểm tra logout, reload và làm mới ID Token.

Không coi health 200 là xác nhận Firebase Auth hoạt động. Backend hiện thêm account lookup trên mỗi request để kiểm tra quyền hiện tại; chưa đo latency/p95 của Firebase thật hoặc chạy load test.

### 12.4. Kiểm thử và trạng thái nghiệm thu

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
- Firebase cloud end-to-end: **chưa nghiệm thu**, cần cấu hình/tài khoản và quyền ADC ở mục 12.3.
- Chưa deploy hoặc sửa tài khoản production trong lượt làm việc này. Không đánh dấu toàn bộ tuần 2 hoàn thành chỉ từ source; trạng thái review và merge được theo dõi trên pull request.

Tài liệu chính thức đã đối chiếu:

- https://firebase.google.com/docs/auth/admin/custom-claims
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
- https://firebase.google.com/docs/auth/admin/manage-sessions
- https://firebase.google.com/docs/auth/web/password-auth

### 12.5. Kết quả local ngày 17/10/2026

- Root npm ci từ lockfile cuối: đạt; giữ phiên bản Vite/PostCSS/Nanoid có sẵn, không nâng các gói này ngoài phạm vi. jsdom 26.1.0 tương thích Node tối thiểu của repo, khai báo ở root cho Vitest dùng chung và ở web để cài độc lập.
- API typecheck/build: đạt; 90 tests local/mock/HTTP đạt; 7 tests emulator được skip trong lệnh test thường và đã chạy riêng thành công.
- Frontend lint/build: đạt; 29 tests session/routing/API token reader đạt sau cài sạch. Không có lỗi lint frontend. Build còn cảnh báo kích thước bundle sau khi thêm Firebase SDK; chưa tối ưu bundle ngoài phạm vi.
- Worker typecheck/build/lint và hai health tests (unit + HTTP): đạt; lint còn cảnh báo scaffold và cấu hình strictNullChecks có sẵn.
- Firebase Auth Emulator với SDK/NestJS thật: 7/7 tests đạt; đã dọn các tài khoản thử và dừng emulator.
- Tổng: 121 kiểm tra local và 7 ca emulator đạt, không tính ca skip thành ca pass. Chưa có bằng chứng Firebase production hoặc browser end-to-end trên Hosting.


### 12.6. Follow-up review PR #15 — danh tính nghiệp vụ và lỗi dependency

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
