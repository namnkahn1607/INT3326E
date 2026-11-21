# Tuần 6 (26/10–01/11)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: TRUE. Checkpoint nhóm: Dispatcher gán được tài xế; message GPS test thấy trong Pub/Sub console.

## Việc của TV6 theo sheet

Backend Admin skeleton (danh sách driver/customer), phác thảo QA test plan.

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W6-TV6-01 | `GET /v1/drivers` (API11): số đơn đang chạy và vị trí GPS theo quyền | `current_locations`, `shipments` | Endpoint, DTO, truy vấn một câu SQL | FR02, FR10 | Đã có, SQL qua PGlite |
| W6-TV6-02 | `GET /v1/admin/customers` | W6-TV6-01 | Endpoint chỉ đọc | FR10 | Đã có |
| W6-TV6-03 | Phân trang bằng cursor không trùng, không sót | W6-TV6-01 | `admin-list-query` | ADM06–ADM08 | Đã có |
| W6-TV6-04 | Phác thảo QA test plan | Đặc tả v1.4 | [qa-test-plan.md](../qa/test-plan.md) | ADM01–ADM17 | Kế hoạch đã có; kết quả chạy Create và Assign ở [week-07](week-07.md#kết-quả-chạy-07112026) |
| W6-TV6-05 | Đọc cột GPS theo DATA04 (camelCase) | Đặc tả v1.4 DATA04/05, Worker của Na | Truy vấn đọc `"driverId"`, `"clientTimestamp"`, `"receivedAt"` | AC04 | Đã sửa 07/11, chưa kiểm trên Cloud |

## Đã làm được

- Commit `1063cf1` (24/10, PR #19): Admin directory chỉ đọc kèm bản nháp QA. Hợp đồng ở [admin-directory.md](../features/admin-directory.md).
- Kết quả 23/10: 179 test API đạt; ngày 07/11 chạy lại với PostgreSQL thật trên máy: 406 test đạt, 73 skip, typecheck đạt. Chi tiết ở [bàn giao Admin directory](admin-directory-handoff.md).
- Commit `c9f7441` (07/11): sửa lệch cột GPS, gom repository vào `admin/repositories/`, sửa test SQL dùng `search_path`.
- Ghi chú: API đọc đơn và gán tài xế trong tuần này do Đạt làm hộ TV1, không thuộc phần việc của TV6.

## Còn thiếu và rủi ro

- Chưa chạy trên Cloud SQL; ADM12 (race, snapshot giữa nhiều kết nối) cần PostgreSQL đa kết nối thật.
- Tên cột GPS theo Worker và Prisma, chưa đối chiếu với DB đã deploy.
- `qa-test-plan.md` là kế hoạch, không phải kết quả. Ca Admin directory chạy trên Cloud (ADM01–ADM04, ADM17) vẫn chưa có kết quả; kết quả local nằm ở [bàn giao Admin directory](admin-directory-handoff.md).
