# Auth & RBAC Contract — Draft v0.1

## 1. Scope

Tài liệu này mô tả bản nháp cơ chế xác thực và phân quyền cho ParcelFlow.

Phạm vi tuần 1:

- Phác thảo `AuthModule`.
- Phác thảo `AdminModule`.
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

Hệ thống dự kiến có bốn role:

| Role | Mô tả |
| --- | --- |
| `CUSTOMER` | Tạo và theo dõi đơn giao hàng của mình |
| `DRIVER` | Nhận nhiệm vụ giao hàng và cập nhật trạng thái |
| `DISPATCHER` | Điều phối đơn hàng và tài xế |
| `ADMIN` | Quản trị hệ thống |

Trong phạm vi MVP, mỗi tài khoản chỉ có một role tại một thời điểm.

Nguồn lưu role chính thức sẽ được nhóm thống nhất sau. Auth module chỉ sử dụng giá trị role đã được chuẩn hóa và không phụ thuộc trực tiếp vào database.

## 4. Authentication rules

### 4.1 Missing token

Nếu request không có header `Authorization`, backend trả về:

```http
401 Unauthorized
```

Ví dụ response:

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

Ví dụ dự kiến:

```ts
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Get()
findAll() {
  return this.adminService.findAll();
}
```

Quyền truy cập dự kiến:

| Khu vực API | Role được phép |
| --- | --- |
| API công khai | Không yêu cầu role |
| API khách hàng | `CUSTOMER` |
| API tài xế | `DRIVER` |
| API điều phối | `DISPATCHER` |
| `/admin/*` | `ADMIN` |

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
│   └── token-verifier.interface.ts
├── enums/
│   └── user-role.enum.ts
├── services/
│   └── firebase-token-verifier.service.ts
└── auth.module.ts
```

Trách nhiệm của từng thành phần:

### `TokenVerifier`

Abstraction dùng để xác thực token.

Auth guard chỉ phụ thuộc vào interface này, giúp unit test bằng mock mà chưa cần kết nối Firebase thật.

### `FirebaseTokenVerifierService`

Implementation sử dụng Firebase Admin SDK để xác thực Firebase ID Token.

Service này sẽ được hoàn thiện sau khi TV5 cung cấp Firebase project configuration.

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

## 7. Admin module

Admin module tuần 1 chỉ là skeleton, chưa triển khai nghiệp vụ quản trị và chưa truy cập database.

Cấu trúc dự kiến:

```text
admin/
├── controllers/
│   └── admin.controller.ts
├── services/
│   └── admin.service.ts
└── admin.module.ts
```

Các thành phần:

- `AdminModule`: đăng ký controller và service của module Admin.
- `AdminController`: khai báo các endpoint dành cho Admin.
- `AdminService`: chứa business logic của Admin trong các tuần sau.

Tất cả endpoint thuộc `/admin/*` phải được bảo vệ bằng role `ADMIN`.

Có thể sử dụng endpoint tạm thời để kiểm tra guard:

```http
GET /admin/health
```

Response dự kiến:

```json
{
  "status": "ok",
  "module": "admin"
}
```

Endpoint này chỉ dùng trong quá trình scaffold và có thể được thay đổi hoặc loại bỏ khi API Admin chính thức được thống nhất.

## 8. Test cases

### Authentication tests

1. Không gửi header `Authorization` → trả về `401`.
2. Header không sử dụng Bearer scheme → trả về `401`.
3. Bearer token rỗng → trả về `401`.
4. Token không hợp lệ → trả về `401`.
5. Token hết hạn → trả về `401`.
6. Token hợp lệ → gắn `AuthenticatedUser` vào request.

### Authorization tests

1. Người dùng chưa xác thực truy cập `/admin/*` → trả về `401`.
2. Role `CUSTOMER` truy cập `/admin/*` → trả về `403`.
3. Role `DRIVER` truy cập `/admin/*` → trả về `403`.
4. Role `DISPATCHER` truy cập `/admin/*` → trả về `403`.
5. Role `ADMIN` truy cập `/admin/*` → request thành công.
6. Endpoint không khai báo role → người dùng đã xác thực được phép truy cập.

### Mocking strategy

Unit test sử dụng mock implementation của `TokenVerifier`.

Ví dụ:

```ts
const tokenVerifier = {
  verify: jest.fn().mockResolvedValue({
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

## 9. Security requirements

- Không commit Firebase service account key vào Git.
- Không ghi toàn bộ token vào log.
- Không tin tưởng role do frontend tự gửi.
- Backend phải tự xác thực token và lấy role từ nguồn đáng tin cậy.
- Firebase credentials phải được cung cấp qua environment variables hoặc secret manager.
- Thông tin lỗi không được làm lộ credentials hoặc nội dung token.
- Mọi endpoint Admin phải được kiểm tra role ở backend.

## 10. Pending decisions

Các nội dung cần thống nhất với nhóm:

- Role được lưu bằng Firebase custom claims hay trong PostgreSQL.
- Tên và prefix API chính thức, ví dụ `/api/v1`.
- Cấu trúc error response chung của backend.
- Cách Firebase Admin SDK được khởi tạo trong NestJS.
- Danh sách endpoint Admin chính thức.
- Cách đồng bộ người dùng Firebase với bảng người dùng trong database.

## 11. External dependencies

Việc tích hợp hoàn chỉnh phụ thuộc vào:

- NestJS skeleton và cấu trúc `apps/api` từ TV1.
- Firebase project/configuration từ TV5.
- API contract chung của nhóm.
- Database schema của người dùng và role.

Các phần interface, guard, decorator, mock test và Admin skeleton có thể được chuẩn bị trước mà không cần chờ các dependency trên.