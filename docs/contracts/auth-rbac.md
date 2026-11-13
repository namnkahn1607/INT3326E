# Hợp đồng Auth và RBAC

Trạng thái: hợp đồng đang áp dụng cho Auth/RBAC. Kết quả kiểm tra, hướng dẫn cấp claims và ghi nhận theo ngày nằm ở [Bàn giao Auth và RBAC](../tv6/auth-rbac-handoff.md). Báo cáo đó là bằng chứng tại thời điểm viết, không thay cho hợp đồng này.

## 1. Phạm vi

Tài liệu này mô tả bản nháp cơ chế xác thực và phân quyền cho ParcelFlow.

Phạm vi tuần 1 đã nghiệm thu (hồ sơ lịch sử):

- Phác thảo `AuthModule`.
- Phác thảo `AdminModule`, controller và service; chưa triển khai endpoint nghiệp vụ ở tuần 1.
- Xác định các role của hệ thống.
- Thống nhất cách backend nhận và xác thực Firebase ID Token.
- Xác định quy tắc trả về `401 Unauthorized` và `403 Forbidden`.
- Chuẩn bị cấu trúc để có thể kiểm thử bằng mock, chưa cần Firebase project thật.

## 2. Xác thực

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

## 3. Role

Quyết định ngày 09/10/2026: giữ Admin và gộp chức năng điều phối vào role này; không có role Dispatcher riêng. Hệ thống có ba role:

| Role | Mô tả |
| --- | --- |
| `CUSTOMER` | Tạo và theo dõi đơn giao hàng của mình |
| `DRIVER` | Nhận nhiệm vụ giao hàng và cập nhật trạng thái |
| `ADMIN` | Điều phối đơn hàng, phân công tài xế và giám sát vận hành |

Trong phạm vi MVP, mỗi tài khoản chỉ có một role tại một thời điểm.

Implementation scaffold hiện đọc role từ Firebase custom claim `role` sau khi xác thực ID Token. Chỉ ba giá trị trên được chấp nhận; claim thiếu hoặc không hợp lệ sẽ bị từ chối với `401`. Quyết định tuần 2 do người yêu cầu xác nhận ngày 17/10/2026: Firebase custom claims là nguồn role cho tích hợp Auth; tiếp tục dùng ba role, không khôi phục Dispatcher. Backend đối chiếu claim trong token với claim hiện tại của Firebase UserRecord. Auth guard chỉ dùng `TokenVerifier`, không truy cập database trực tiếp.

## 4. Quy tắc xác thực

### 4.1 Thiếu token

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

### 4.2 Token sai hoặc hết hạn

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

### 4.3 Không đủ quyền

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

### 4.4 Token và role hợp lệ

Nếu token hợp lệ và người dùng có role phù hợp, backend cho phép request tiếp tục đến controller.

## 5. Quy tắc phân quyền

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

## 6. Cấu trúc Auth module

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

Scaffold gồm `admin.module.ts`, `controllers/admin.controller.ts` và `services/admin.service.ts`. Module import `AuthModule` để nhận các guard qua dependency injection. Guard tuần 2 được áp dụng toàn cục; controller khai báo `@Roles(UserRole.ADMIN)`; các handler sau này trong controller dùng quyền Admin mặc định. Bản Admin directory ngày 23/10/2026 thêm `GET /v1/drivers` và `GET /v1/admin/customers`, đều dùng `BusinessUserGuard` cho liên kết SQL; `/admin/me` vẫn độc lập SQL. Contract và phụ thuộc ở [Admin directory](../features/admin-directory.md), kịch bản nghiệm thu ở [QA test plan](../qa/test-plan.md).

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

## 7. Test case

### Test xác thực

1. Không gửi header `Authorization` → trả về `401`.
2. Header không sử dụng Bearer scheme → trả về `401`.
3. Bearer token rỗng → trả về `401`.
4. Token không hợp lệ → trả về `401`.
5. Token hết hạn → trả về `401`.
6. Token hợp lệ → gắn `AuthenticatedUser` vào request.

### Test phân quyền

1. Người dùng chưa xác thực truy cập endpoint protected → trả về `401`.
2. Role `CUSTOMER` truy cập endpoint yêu cầu `ADMIN` → trả về `403`.
3. Role `DRIVER` truy cập endpoint yêu cầu `ADMIN` → trả về `403`.
4. Role `ADMIN` truy cập endpoint yêu cầu `ADMIN` → request thành công.
5. Role `CUSTOMER` truy cập endpoint yêu cầu `CUSTOMER` → request thành công.
6. Role `DRIVER` truy cập endpoint yêu cầu `DRIVER` → request thành công.
7. Endpoint dùng `FirebaseAuthGuard` nhưng không khai báo role → người dùng đã xác thực được phép truy cập.

### Chiến lược mock

Unit test sử dụng mock implementation của `TokenVerifier`.

Các file `*.spec.ts` dùng Vitest. Unit test kiểm tra token/header, ba role, claim không hợp lệ và Firebase initialization; HTTP integration test khởi tạo NestJS với `AuthModule` thật và mock Firebase Auth để kiểm tra response `401`, `403`, `200`. Controller trong test chỉ là fixture, không thêm endpoint nghiệp vụ vào ứng dụng.

Chạy độc lập từ `apps/api` với Node.js >= 20:

```bash
npm ci --workspaces=false
npm run typecheck
npm run build
npm run test:auth
```

Các kiểm tra không cần credentials hoặc Firebase project thật. TV1 đã bổ sung bootstrap và đăng ký Auth/Admin trong AppModule; xem [API scaffold](../features/api-scaffold.md) để chạy backend và kiểm tra public `GET /healthz`.

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

## 8. Yêu cầu bảo mật

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
- API scaffold đã dùng prefix `/v1` cho nghiệp vụ và giữ `/healthz` công khai ngoài prefix; Create và Assign đã có handler từ 01/11/2026, các contract còn lại vẫn là draft.
- Bản follow-up review dùng exception filter chung để trả ProblemDetails cho lỗi API, gồm 401/403/409/503. Các ví dụ response Nest ở phần tuần 1 là hồ sơ lịch sử.
- Đã có SQL lookup và BusinessUserGuard cho liên kết user; migration, seed và nghiệm thu Cloud SQL cần TV1/TV5 phối hợp, xem [mục 6 của bàn giao](../tv6/auth-rbac-handoff.md#6-follow-up-review-pr-15--danh-tính-nghiệp-vụ-và-lỗi-dependency).

## 10. Phụ thuộc bên ngoài

Việc tích hợp hoàn chỉnh phụ thuộc vào:

- NestJS skeleton và cấu trúc `apps/api` của TV1 đã có trên develop.
- Firebase project/configuration từ TV5.
- API contract chung của nhóm.
- Mapping UID Firebase với dữ liệu nghiệp vụ do nhóm tích hợp sau; không là điều kiện chạy auth/me.

API đã có firebase-admin, bootstrap và AuthModule. Tuần 2 dùng guard toàn cục, health được miễn bằng @Public(); không áp dụng lại guard cục bộ trên cùng controller. Module Shipment về sau vẫn phải kiểm tra quyền trên từng đơn hàng (chủ đơn hoặc tài xế được gán); RolesGuard không thay thế kiểm tra ownership.

Bản tích hợp tuần 2 trong [bàn giao](../tv6/auth-rbac-handoff.md) bổ sung frontend Firebase Web SDK; phạm vi tuần 1 được giữ làm hồ sơ lịch sử.

## 11. Firebase configuration và giới hạn tích hợp

- Cloud Run: dùng service account của runtime và ADC; TV5 xác nhận quyền và Firebase project. Không đưa JSON service account key vào repo.
- Local: cung cấp ADC hoặc `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới file credentials bên ngoài repo. Provider đọc biến môi trường đã có; bootstrap TV1 chịu trách nhiệm nạp `.env`.
- `FIREBASE_PROJECT_ID`: project Firebase cần xác thực, ví dụ `int3326e`; SDK dùng cấu hình ADC nếu không khai báo.
- Role custom claim chỉ nhận `CUSTOMER`, `DRIVER`, `ADMIN`. Claim `DISPATCHER` cũ bị từ chối. Nếu đã có tài khoản điều phối dùng claim này, người có quyền quản lý Firebase phải cập nhật custom claim thành `ADMIN` và refresh ID Token; client không tự cấp quyền.
- Tuần 2 bổ sung phần nối Auth của frontend và giữ giao diện hiện có. Không đổi Prisma hoặc worker. Cấp claims/cloud login cần nghiệm thu trên Firebase thật (xem bàn giao); đồng bộ dữ liệu nghiệp vụ và ProblemDetails cần phối hợp API contract của nhóm.
