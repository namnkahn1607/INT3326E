# Nợ kỹ thuật

Việc đã biết nhưng cố ý để sau. Thêm dòng khi hoãn một việc; xóa dòng khi đã xử lý (ghi PR vào file tuần).

| Ngày | Khu vực | Nợ | Lý do để sau | Rủi ro | Xem lại khi |
| --- | --- | --- | --- | --- | --- |
| 20/11/2026 | Triển khai frontend | BUG-W8-02: `VITE_CARTO_API_KEY` trên Hosting là API Access Token, không phải key basemap; nền bản đồ báo "API KEY REQUIRED" | Nhóm chốt tuần 8 trước khi sửa | Bản đồ trống khi demo; token có quyền SQL API nằm trong bundle công khai | Ngay đầu tuần 9 (TV5): key basemap, deploy lại Hosting, xóa token cũ |
| 20/11/2026 | Web | BUG-W8-03: trang Thông báo của Customer còn dữ liệu minh họa, chưa gọi `GET /v1/notifications` | Không thuộc checkpoint tuần 8 | AC08 không đạt trên giao diện dù API đã có | Tuần 9 (TV3) |
| 18/11/2026 | Worker/Cloud | Chưa đủ deployment record và kiểm chi phí cho cấu hình chạy nền ổn định | Người dùng báo đã cấu hình lại và GPS mới đã tới Customer/Admin; chưa đọc lại revision/config đầy đủ | Không suy rộng ca kiểm sang vận hành liên tục hoặc NF11; 9 bản gốc DLQ trước đó chưa xác minh dọn | TV5/TV2 ghi billing/CPU/min/max, revision/source và chi phí thực; dọn bản DLQ đã xác minh theo quy trình nhóm |
| 17/11/2026 | Worker | Worker NACK cả lỗi vĩnh viễn khi ghi DB (khóa ngoại `23503`, `driverId` không có trong `users`) | Phát hiện trên Cloud 16/11, chưa sửa | Message sai bị gửi lại liên tục, tốn tài nguyên Worker | Tuần 9 (TV2) |
| 14/11/2026 | Triển khai | Image Cloud Build chỉ gắn tag `:latest` | Chưa cần rollback | Không rollback được về đúng bản cũ | Khi làm CI/CD tuần 9 |
| 14/11/2026 | CI | Chưa có GitHub Actions chạy `npm run check` trên mỗi PR | Việc tuần 9 của TV5 | PR lỗi lọt vào `develop` | Tuần 9 |
| 14/11/2026 | Cloud | Topic `int3326e_pubsub` và subscription `int3326e_subcription` thử nghiệm từ tuần 4 còn trên GCP | Cần quyền GCP, chờ nhóm xác nhận không dùng | Nhầm topic khi cấu hình | Khi TV5 dọn GCP |
| 14/11/2026 | Test | Test PostgreSQL thật bị bỏ qua khi thiếu biến môi trường, `npm run check` vẫn báo đạt | Không có DB trong máy mọi người | Lỗi SQL thật không bị phát hiện | Khi có CI với service PostgreSQL |
