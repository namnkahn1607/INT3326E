# ParcelFlow

Nền tảng giao nhận và theo dõi vận chuyển, xây theo hướng Cloud-native: Modular Monolith cho nghiệp vụ, pipeline bất đồng bộ cho dữ liệu GPS tải cao.

| | |
| --- | --- |
| Môn học | Phát triển ứng dụng Cloud (INT3326E), UET |
| Đề tài | Logistics & Delivery Platform |
| Nhóm | Nhóm 6, 6 thành viên |
| Thời gian | 10 tuần (tuần 4 đến tuần 13) |
| Trọng tâm | Hiệu năng và khả năng mở rộng |
| Web | https://int3326e.web.app |

## Đọc gì trước

- [AGENTS.md](AGENTS.md): cài đặt, lệnh chạy, test, ràng buộc khi viết code.
- [ARCHITECTURE.md](ARCHITECTURE.md): kiến trúc và cấu trúc thư mục.
- [docs/features.md](docs/features.md): tính năng nào đã xong, kiểm bằng test nào.
- [docs/README.md](docs/README.md): mục lục toàn bộ tài liệu.
- [Triển khai lên Cloud](docs/features/deploy.md): build, deploy, biến môi trường.
- [Độ tin cậy](docs/RELIABILITY.md) và [nợ kỹ thuật](docs/tech-debt.md).
- [Điều phối theo tuần](docs/coordination/README.md): việc từng thành viên và PR chốt tuần.

## Chạy nhanh

```sh
npm ci
npm run check        # lint, typecheck, test, build cho API, Worker, web
npm run dev:web      # web local, cần apps/web/.env.local
npm run start:dev    # Worker local, cần .env (mẫu .env.example)
```

## Phạm vi

**Vai trò:** Customer, Driver, Admin (Admin kiêm điều phối và gán tài xế).

**Trạng thái đơn:**

```
CREATED → ASSIGNED → PICKED_UP → DELIVERED / DELIVERY_FAILED
```

**Chức năng chính:**

| # | Chức năng |
| --- | --- |
| 1 | Tạo đơn |
| 2 | Gán tài xế cho đơn |
| 3 | Cập nhật lấy hàng, giao hàng |
| 4 | Tài xế gửi vị trí định kỳ (bất đồng bộ) |
| 5 | Theo dõi trạng thái và vị trí |
| 6 | Xem lịch sử giao nhận |
| 7 | Xử lý giao thất bại, giao trễ |
| 8 | Thông báo cho khách |
| 9 | Ước tính thời gian đến (Haversine) |

**Ngoài phạm vi:** giao lại nhiều lần, hoàn hàng, COD, nhiều kho, Machine Learning cho ETA, gợi ý tuyến đường, PostGIS.

## Luồng GPS

- **Ghi:** Driver gọi `POST /v1/locations`. API chỉ publish lên Pub/Sub và trả `202` sau khi broker xác nhận, không chờ ghi DB.
- **Xử lý nền:** GPS Worker (Cloud Run riêng) nhận message, ghi `location_history` và `current_locations` trong một transaction, ACK sau khi commit.
- **Đọc:** Customer polling API mỗi 5–10 giây, API đọc `current_locations`.
- **Toàn vẹn dữ liệu:** mẫu trùng khóa (`"driverId"`, `"clientTimestamp"`) bị bỏ qua; mẫu đến muộn vẫn vào lịch sử nhưng không làm vị trí hiện tại lùi lại.
- **Phục hồi:** Worker ngừng thì message nằm lại trong hàng đợi và được xử lý khi Worker chạy lại; message lỗi chuyển sang dead-letter subscription.

## Công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React + Vite + TypeScript, Leaflet + OpenStreetMap |
| Backend | NestJS trên Cloud Run |
| GPS Worker | NestJS, Cloud Run riêng |
| Hàng đợi | Google Cloud Pub/Sub |
| Cơ sở dữ liệu | PostgreSQL trên Cloud SQL |
| Xác thực | Firebase Authentication |
| Giám sát | Cloud Monitoring |

## Yêu cầu phi chức năng

Giả định thiết kế: khoảng 300–500 đơn đang giao cùng lúc, tài xế gửi GPS mỗi 8 giây.

| Chỉ số | Mục tiêu | Lý do |
| --- | --- | --- |
| Thông lượng bình thường | ~60 sự kiện/giây | 500 tài xế × 1 sự kiện / 8 giây |
| Thông lượng khi thử tải | ~300 sự kiện/giây | Gấp khoảng 5 lần để chứng minh khả năng mở rộng |
| p95 tạo đơn, gán tài xế | < 500 ms | Ghi đồng bộ có transaction |
| p95 đọc tracking | < 300 ms | Đọc bảng có index |
| p95 nhận GPS | < 150 ms | Chỉ tính thời gian publish Pub/Sub, không phụ thuộc DB |
| Thời gian Worker phục hồi | < 60 giây | Xử lý hết backlog sau khi Worker dừng rồi chạy lại |
| Chi phí Cloud | < 50 USD/tháng | Cloud Run scale về 0, Cloud SQL gói thấp nhất, Pub/Sub trong hạn mức miễn phí |

Các con số trên là mục tiêu. Kết quả đo thật ghi trong báo cáo thử tải (tuần 9).

## Kế hoạch

Kế hoạch 10 tuần và việc từng thành viên nằm ở [sheet chia việc](https://docs.google.com/spreadsheets/d/1OD9vEnT2ElFshA_2l66qCfMbiayibnajvy3BjrrLIrw/edit) và [điều phối theo tuần](docs/coordination/README.md). Mỗi tuần chốt bằng PR `week/NN` → `main`.
