# Khung API — Tuần 1

## Chạy trên máy

Dùng Node.js >= 20.12 (phần khởi động dùng `loadEnvFile` có sẵn trong Node).
Từ gốc repo:

```bash
cd apps/api
npm ci --workspaces=false
cp .env.example .env
npm run typecheck
npm test
npm run build
npm start
```

`npm start` nạp `apps/api/.env` khi chạy từ thư mục đó.
Biến môi trường đã có khi chạy được ưu tiên hơn giá trị trong file.
`PORT` được ưu tiên hơn `API_PORT`; giá trị dự phòng khi chạy local là `3000`.
Máy chủ HTTP lắng nghe tại `0.0.0.0` để chạy trên Cloud Run.

Trong terminal khác:

```bash
curl -i http://localhost:3000/healthz
```

Kết quả mong đợi: HTTP `200`, JSON `{"status":"ok","service":"api"}`, không cần token.
Đây là kiểm tra tiến trình còn chạy; không truy vấn Firebase, Cloud SQL hay Pub/Sub.

## Ứng dụng chạy ở tuần 1

Mục này mô tả trạng thái tuần 1. Các API đã triển khai sau đó xem [danh sách tính năng](../features.md).

`AppModule` import `AuthModule` và `AdminModule` đã có của TV6,
cùng `ShipmentsModule`. Shipment và Admin có khung controller/service,
chưa có handler nghiệp vụ. Chỉ `GET /healthz` đã được triển khai.
Các route nghiệp vụ sẽ dùng tiền tố `/v1`; health nằm ngoài tiền tố này.

Auth dùng provider Firebase Admin SDK đã có và ba role:
`CUSTOMER`, `DRIVER`, `ADMIN`. Admin thực hiện điều phối và
frontend giữ `/admin`. Health không được bảo vệ bởi auth guard toàn cục.
Ứng dụng không có chế độ xác thực mock hay tự chọn role.

Để kiểm tra tiến trình trên máy, `FIREBASE_PROJECT_ID=int3326e` cho phép SDK khởi tạo;
health không xác thực token hay yêu cầu thông tin xác thực. Việc xác thực token thật
sau này cần ADC hoặc thông tin xác thực bên ngoài. Trên Cloud Run, TV5 cấu hình
project Firebase và service account/ADC khi chạy. Không sao chép thông tin xác thực
vào mã nguồn, file môi trường mẫu, ảnh chụp màn hình hay image container.

Các file rỗng khác kế thừa từ TV1 vẫn là phần giữ chỗ cho các tuần sau;
chúng không được import vào ứng dụng đang chạy.

## Bàn giao container cho TV5

Từ gốc repo:

```bash
docker build -t parcelflow-api:week1 apps/api
docker run --rm -p 8080:8080 \
  -e PORT=8080 -e FIREBASE_PROJECT_ID=int3326e parcelflow-api:week1
curl -i http://localhost:8080/healthz
```

Ngữ cảnh build phải là `apps/api`; Dockerfile cài đặt từ
lockfile của API và loại trừ các file môi trường local. Cloud Run cung cấp `PORT`.
Image chạy không có dependency dành cho phát triển và chạy bằng người dùng `node`.

TV5 deploy image/mã nguồn này và ghi URL Cloud Run thực tế, revision,
SHA mã nguồn cùng kết quả `GET /healthz` công khai vào issue #9. Không dùng
hostname mẫu trong các bản nháp hợp đồng cũ làm bằng chứng deploy. Việc deploy Worker
vẫn do TV2/TV5 phụ trách.

## Hợp đồng và tích hợp

Xem [bản nháp hợp đồng API](../contracts/api-contract.md) để biết các quyết định nền tảng và đề xuất.
`docs/openapi.json` mô tả cả API đã triển khai lẫn API dự kiến; trạng thái từng API xem [danh sách tính năng](../features.md).
Thao tác health trong OpenAPI ghi đè rõ server thành `/`.

API giữ package/lockfile riêng để có thể cài đặt và build
trước khi tích hợp workspace FE/worker. Việc đồng bộ workspace gốc thuộc
issue #10; giữ nguyên dependency/script Auth của API khi merge.
Các file Prisma/kiểu dùng chung sao chép từ TV3 chỉ là tài liệu nháp tham khảo,
đã loại role Dispatcher cũ. Tuần 1 không thêm migration database, Prisma client,
script seed, phần tiếp nhận GPS hay endpoint nghiệp vụ.

Gửi kết quả kiểm tra và SHA mã nguồn trong bình luận ở issue #5; dẫn link
bằng chứng Cloud Run từ #9 sau khi TV5 deploy. Không cần file
checkpoint riêng.
