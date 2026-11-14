# Nợ kỹ thuật

Việc đã biết nhưng cố ý để sau. Thêm dòng khi hoãn một việc; xóa dòng khi đã xử lý (ghi PR vào file tuần).

| Ngày | Khu vực | Nợ | Lý do để sau | Rủi ro | Xem lại khi |
| --- | --- | --- | --- | --- | --- |
| 14/11/2026 | API | Chưa có `GET /v1/shipments/{id}/tracking` (API09); web đã gọi, Cloud trả 404 | Việc tuần 8 của TV1 | Chặn checkpoint tuần 8 (AC05) và ETA (AC09) | Ngay trong tuần 8 |
| 14/11/2026 | Worker | Sheet ghi push subscription, code dùng pull | Pull đang chạy được trên Cloud | Chi phí khi Worker luôn chạy; cấu hình scale khi thử tải | Trước load test tuần 9 |
| 14/11/2026 | Triển khai | Image Cloud Build chỉ gắn tag `:latest` | Chưa cần rollback | Không rollback được về đúng bản cũ | Khi làm CI/CD tuần 9 |
| 14/11/2026 | CI | Chưa có GitHub Actions chạy `npm run check` trên mỗi PR | Việc tuần 9 của TV5 | PR lỗi lọt vào `develop` | Tuần 9 |
| 14/11/2026 | Cloud | Topic `int3326e_pubsub` và subscription `int3326e_subcription` thử nghiệm từ tuần 4 còn trên GCP | Cần quyền GCP, chờ nhóm xác nhận không dùng | Nhầm topic khi cấu hình | Khi TV5 dọn GCP |
| 14/11/2026 | API | Chưa có báo giao thất bại (API07) | Việc tuần 9 của TV1 | AC07 chưa đạt | Tuần 9 |
| 14/11/2026 | Test | Test PostgreSQL thật bị bỏ qua khi thiếu biến môi trường, `npm run check` vẫn báo đạt | Không có DB trong máy mọi người | Lỗi SQL thật không bị phát hiện | Khi có CI với service PostgreSQL |
