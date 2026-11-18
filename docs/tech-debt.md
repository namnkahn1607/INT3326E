# Nợ kỹ thuật

Việc đã biết nhưng cố ý để sau. Thêm dòng khi hoãn một việc; xóa dòng khi đã xử lý (ghi PR vào file tuần).

| Ngày | Khu vực | Nợ | Lý do để sau | Rủi ro | Xem lại khi |
| --- | --- | --- | --- | --- | --- |
| 18/11/2026 | Triển khai frontend | Chưa deploy và kiểm Cloud hai bản sửa tracking | Local đã đạt check/integration/browser: tile CARTO thật tải được, detail đồng bộ status/driver và khóa action cũ. [Báo cáo mới](evidence/tv3-tracking-cloud-week8/report.md) | Hosting còn bản cũ tới khi deploy; máy build cần cấu hình CARTO key | TV3/TV5 deploy FE được cho phép, kiểm lại Customer/Admin trên Hosting trước khi đóng lỗi Cloud |
| 18/11/2026 | Worker/Cloud | Chưa đủ deployment record và kiểm chi phí cho cấu hình chạy nền ổn định | Người dùng báo đã cấu hình lại và GPS mới đã tới Customer/Admin; chưa đọc lại revision/config đầy đủ | Không suy rộng ca kiểm sang vận hành liên tục hoặc NF11; 9 bản gốc DLQ trước đó chưa xác minh dọn | TV5/TV2 ghi billing/CPU/min/max, revision/source và chi phí thực; dọn bản DLQ đã xác minh theo quy trình nhóm |
| 17/11/2026 | Worker | Worker NACK cả lỗi vĩnh viễn khi ghi DB (khóa ngoại `23503`, `driverId` không có trong `users`) | Phát hiện trên Cloud 16/11, chưa sửa | Message sai bị gửi lại liên tục, tốn tài nguyên Worker | Tuần 9 (TV2) |
| 14/11/2026 | Triển khai | Image Cloud Build chỉ gắn tag `:latest` | Chưa cần rollback | Không rollback được về đúng bản cũ | Khi làm CI/CD tuần 9 |
| 14/11/2026 | CI | Chưa có GitHub Actions chạy `npm run check` trên mỗi PR | Việc tuần 9 của TV5 | PR lỗi lọt vào `develop` | Tuần 9 |
| 14/11/2026 | Cloud | Topic `int3326e_pubsub` và subscription `int3326e_subcription` thử nghiệm từ tuần 4 còn trên GCP | Cần quyền GCP, chờ nhóm xác nhận không dùng | Nhầm topic khi cấu hình | Khi TV5 dọn GCP |
| 14/11/2026 | API | Chưa có báo giao thất bại (API07) | Việc tuần 9 của TV1 | AC07 chưa đạt | Tuần 9 |
| 14/11/2026 | Test | Test PostgreSQL thật bị bỏ qua khi thiếu biến môi trường, `npm run check` vẫn báo đạt | Không có DB trong máy mọi người | Lỗi SQL thật không bị phát hiện | Khi có CI với service PostgreSQL |
