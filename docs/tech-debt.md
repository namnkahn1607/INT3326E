# Nợ kỹ thuật

Việc đã biết nhưng cố ý để sau. Thêm dòng khi hoãn một việc; xóa dòng khi đã xử lý (ghi PR vào file tuần).

| Ngày | Khu vực | Nợ | Lý do để sau | Rủi ro | Xem lại khi |
| --- | --- | --- | --- | --- | --- |
| 18/11/2026 | Driver/Tracking Cloud | Lượt TV3: simulator tăng mẫu 17 → 28 nhưng accepted vẫn 17; Customer chỉ nhận GPS ngày 17/11 | Đã hết lượt bật tài nguyên tạm; GPS dừng, Worker/SQL đã dọn. Chưa xác định nguyên nhân; xem [báo cáo](evidence/tv3-tracking-cloud-week8/report.md) | Chưa chứng minh marker Customer/Admin di chuyển hoặc ẩn sau giao, checkpoint tuần 8 còn mở | TV4/TV3 đối chiếu Network POST mới và Worker/SQL trước khi kiểm tiếp đơn mô phỏng PF2026111812SYSK |
| 18/11/2026 | Worker/Cloud | Streaming Pull đang để min 0, Request-based sau nghiệm thu tạm | W707 đã đối chiếu đủ 17 mẫu trong SQL sau replay 9 mẫu DLQ. Người dùng chỉ cho min 1/Instance-based tối đa 20 phút; đã hoàn nguyên trước 08:08:33. Cấu hình thực tế khác ghi nhận bàn giao cũ. Xem [bằng chứng và giới hạn](evidence/driver-cloud-week8/evening-report.md) | Worker có thể mất CPU nền hoặc về 0 instance, message trễ/đi DLQ; không bảo đảm checkpoint tracking liên tục. 9 bản gốc DLQ đã replay thành công nhưng chưa ACK/xóa | TV5/TV2 thống nhất phương án vận hành và chi phí trước demo/load test; dọn bản DLQ đã xác minh theo quy trình nhóm |
| 14/11/2026 | API | Chưa có `GET /v1/shipments/{id}/tracking` (API09); web đã gọi, Cloud trả 404 | Việc tuần 8 của TV1 | Chặn checkpoint tuần 8 (AC05) và ETA (AC09) | Ngay trong tuần 8 |
| 17/11/2026 | Worker | Worker NACK cả lỗi vĩnh viễn khi ghi DB (khóa ngoại `23503`, `driverId` không có trong `users`) | Phát hiện trên Cloud 16/11, chưa sửa | Message sai bị gửi lại liên tục, tốn tài nguyên Worker | Tuần 9 (TV2) |
| 14/11/2026 | Triển khai | Image Cloud Build chỉ gắn tag `:latest` | Chưa cần rollback | Không rollback được về đúng bản cũ | Khi làm CI/CD tuần 9 |
| 14/11/2026 | CI | Chưa có GitHub Actions chạy `npm run check` trên mỗi PR | Việc tuần 9 của TV5 | PR lỗi lọt vào `develop` | Tuần 9 |
| 14/11/2026 | Cloud | Topic `int3326e_pubsub` và subscription `int3326e_subcription` thử nghiệm từ tuần 4 còn trên GCP | Cần quyền GCP, chờ nhóm xác nhận không dùng | Nhầm topic khi cấu hình | Khi TV5 dọn GCP |
| 14/11/2026 | API | Chưa có báo giao thất bại (API07) | Việc tuần 9 của TV1 | AC07 chưa đạt | Tuần 9 |
| 14/11/2026 | Test | Test PostgreSQL thật bị bỏ qua khi thiếu biến môi trường, `npm run check` vẫn báo đạt | Không có DB trong máy mọi người | Lỗi SQL thật không bị phát hiện | Khi có CI với service PostgreSQL |
