# Auth & RBAC Contract — Draft v0.3

## 1. Scope

Tài liệu này mô tả bản nháp cơ chế xác thực và phân quyền cho ParcelFlow.

Phạm vi tuần 1:

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

Implementation scaffold hiện đọc role từ Firebase custom claim `role` sau khi xác thực ID Token. Chỉ ba giá trị trên được chấp nhận; claim thiếu hoặc không hợp lệ sẽ bị từ chối với `401`. Nguồn role chính thức (custom claims hay PostgreSQL) vẫn cần nhóm chốt trước khi tích hợp đăng nhập thật. Auth guard chỉ dùng `TokenVerifier`, không truy cập database trực tiếp.

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

Các endpoint public không yêu cầu đăng nhập.

Các endpoint protected phải sử dụng `FirebaseAuthGuard`.

Các endpoint yêu cầu role cụ thể phải sử dụng cả:

- `FirebaseAuthGuard`
- `RolesGuard`
- `@Roles(...)`

Ví dụ khai báo quyền trên controller hoặc handler dành cho điều phối viên:

```ts
@UseGuards(FirebaseAuthGuard, RolesGuard)
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

Scaffold gồm `admin.module.ts`, `controllers/admin.controller.ts` và `services/admin.service.ts`. Module import `AuthModule` để nhận các guard qua dependency injection. Controller khai báo `@UseGuards(FirebaseAuthGuard, RolesGuard)` và `@Roles(UserRole.ADMIN)`; các handler sau này trong controller dùng quyền Admin mặc định.

Tuần 1 chưa cung cấp endpoint hoặc logic quản trị/điều phối. TV1 đăng ký `AdminModule` vào `AppModule` khi tích hợp bootstrap. Không tạo tài khoản Admin, cấp custom claim hoặc mở quyền từ frontend trong scaffold này.

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

Các kiểm tra không cần credentials hoặc Firebase project thật. `build` hiện biên dịch module Auth, chưa tạo một backend HTTP chạy độc lập vì bootstrap thuộc scaffold TV1.

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

## 9. Pending decisions

Các nội dung cần thống nhất với nhóm:

- Role được lưu bằng Firebase custom claims hay trong PostgreSQL.
- Đồng bộ prefix `/v1` với API contract tại `docs/openapi.json` ở nhánh TV1.
- Exception filter chung cần chuyển lỗi `401`/`403` từ NestJS sang `ProblemDetails` của contract TV1. Các ví dụ response ở tài liệu này mô tả scaffold mặc định, chưa phải response tích hợp cuối cùng.
- Cách đồng bộ người dùng Firebase với bảng người dùng trong database.

## 10. External dependencies

Việc tích hợp hoàn chỉnh phụ thuộc vào:

- NestJS skeleton và cấu trúc `apps/api` từ TV1.
- Firebase project/configuration từ TV5.
- API contract chung của nhóm.
- Database schema của người dùng và role.

Package API đã khai báo `firebase-admin` và cấu hình kiểm tra Auth. Khi ghép với nhánh frontend, hòa `apps/api/package.json` để giữ dependency/script của cả hai bên; khi chốt workspace, tạo lại lockfile chung nếu chuyển sang cài dependencies tại root. Sau khi TV1 cung cấp bootstrap, đăng ký `AuthModule` vào `AppModule` và dùng `@UseGuards(FirebaseAuthGuard, RolesGuard)` theo đúng thứ tự trên endpoint protected. Không đặt guard toàn cục lên health check công khai. Module Shipment phải kiểm tra quyền trên từng đơn hàng (chủ đơn hoặc tài xế được gán); `RolesGuard` chỉ kiểm tra role.

Các phần interface, guard, decorator và mock test có thể được chuẩn bị trước mà không cần chờ các dependency trên.

## 11. Firebase configuration và giới hạn tích hợp

- Cloud Run: dùng service account của runtime và ADC; TV5 xác nhận quyền và Firebase project. Không đưa JSON service account key vào repo.
- Local: cung cấp ADC hoặc `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới file credentials bên ngoài repo. Provider đọc biến môi trường đã có; bootstrap TV1 chịu trách nhiệm nạp `.env`.
- `FIREBASE_PROJECT_ID`: project Firebase cần xác thực, ví dụ `int3326e`; SDK dùng cấu hình ADC nếu không khai báo.
- Role custom claim chỉ nhận `CUSTOMER`, `DRIVER`, `ADMIN`. Claim `DISPATCHER` cũ bị từ chối. Nếu đã có tài khoản điều phối dùng claim này, người có quyền quản lý Firebase phải cập nhật custom claim thành `ADMIN` và refresh ID Token; client không tự cấp quyền.
- Nhánh TV6 không sửa frontend, Prisma hoặc worker. Các nhánh đó cần thống nhất ba role `CUSTOMER`, `DRIVER`, `ADMIN` theo cùng quyết định. Firebase Authentication thật, cấp claims, đồng bộ user/role với database và response `ProblemDetails` cần được kiểm thử khi tích hợp.
