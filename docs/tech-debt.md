# Nợ kỹ thuật

Việc đã biết nhưng cố ý để sau. Thêm dòng khi hoãn một việc; xóa dòng khi đã xử lý (ghi PR vào file tuần).

| Ngày | Khu vực | Nợ | Lý do để sau | Rủi ro | Xem lại khi |
| --- | --- | --- | --- | --- | --- |
| 25/11/2026 | ETA/triển khai | Chưa nghiệm thu panel ETA mới trên Hosting/Cloud | TV3 đã kiểm local/mock; TV2 còn gom hàm/config tốc độ và cần deploy cùng SHA | Không suy rộng 17 integration/ảnh local thành checkpoint ETA Cloud | TV2/TV3 tích hợp, TV5 deploy, TV6 kiểm fresh/stale/null/terminal và quyền chéo, lưu revision; [bàn giao](features/tracking-eta-handoff.md) |
| 23/11/2026 | Phân quyền | Chưa chạy trên Cloud ca Customer khác và tài xế khác sau gán lại mở đơn (AC10, 403) | Tài khoản thứ hai đăng nhập được mới có ngày 23/11 | Chưa có bằng chứng Cloud cho ranh giới quyền giữa hai Customer, hai Driver | Tuần 10 (TV6), cùng QA phân quyền chéo |
| 23/11/2026 | Triển khai frontend | Key basemap CARTO chưa giới hạn domain; hai API Access Token `eyJh…` từng nằm trong bundle chưa xác nhận đã xóa | Key mới đã chạy trên Hosting 23/11 | Người khác dùng ké key; token cũ có quyền SQL API | Tuần 10 (TV5) |
| 23/11/2026 | Worker/Cloud | Chưa xác nhận Worker có quyền publish lên `gps-events-dlq` | Code PR #57 đã deploy | Lỗi vĩnh viễn bị NACK tới hết 5 lần rồi mới vào DLQ, tốn lượt thử | Tuần 10 (TV5) |
| 18/11/2026 | Tracking/NF04 | Chưa đo LT04 đầy đủ trên Cloud | Công cụ, hook stress, HTTP smoke và browser local đã có; chờ cửa sổ đo với TV4/TV5 | Không biết p95/đủ offered load khi 500 poller dùng API/SQL thật | Hai lượt 5s/10s, mỗi lượt 10 phút; lưu config/revision, raw JSON và stale/null trong tải; TV6 đối chiếu NFR |
| 18/11/2026 | Worker/Cloud | Chưa đủ deployment record và kiểm chi phí cho cấu hình chạy nền ổn định | Người dùng báo đã cấu hình lại và GPS mới đã tới Customer/Admin; chưa đọc lại revision/config đầy đủ | Không suy rộng ca kiểm sang vận hành liên tục hoặc NF11; 9 bản gốc DLQ trước đó chưa xác minh dọn | TV5/TV2 ghi billing/CPU/min/max, revision/source và chi phí thực; dọn bản DLQ đã xác minh theo quy trình nhóm |
| 14/11/2026 | Triển khai | Image Cloud Build chỉ gắn tag `:latest` | Chưa cần rollback | Không rollback được về đúng bản cũ | Khi làm CI/CD tuần 9 |
| 14/11/2026 | CI | Chưa có GitHub Actions chạy `npm run check` trên mỗi PR | Việc tuần 9 của TV5, chưa làm | PR lỗi lọt vào `develop` | Tuần 10 (TV5) |
| 14/11/2026 | Cloud | Topic `int3326e_pubsub` và subscription `int3326e_subcription` thử nghiệm từ tuần 4 còn trên GCP | Cần quyền GCP, chờ nhóm xác nhận không dùng | Nhầm topic khi cấu hình | Khi TV5 dọn GCP |
| 14/11/2026 | Test | Test PostgreSQL thật bị bỏ qua khi thiếu biến môi trường, `npm run check` vẫn báo đạt | Không có DB trong máy mọi người | Lỗi SQL thật không bị phát hiện | Khi có CI với service PostgreSQL |
