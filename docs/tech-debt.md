# Nợ kỹ thuật

Việc đã biết nhưng cố ý để sau. Thêm dòng khi hoãn một việc; xóa dòng khi đã xử lý (ghi PR vào file tuần).

| Ngày | Khu vực | Nợ | Lý do để sau | Rủi ro | Xem lại khi |
| --- | --- | --- | --- | --- | --- |
| 18/11/2026 | Tracking UI | Tile OpenStreetMap lỗi `ERR_CONNECTION_REFUSED` trong phiên nghiệm thu | Chưa xác định lỗi mạng/chặn dịch vụ; không tự đổi provider hoặc deploy trong lượt kiểm | Marker/GPS cập nhật nhưng nền map trống; chưa chốt nghiệm thu hiển thị đầy đủ | TV3 đối chiếu mạng và provider, kiểm lại Customer/Admin 390/1440px; [bằng chứng](evidence/tv3-tracking-cloud-week8/report.md#kiểm-lại-buổi-tối--gps-mới-và-terminal) |
| 18/11/2026 | Customer/Admin detail | Panel API09 thấy DELIVERED và dừng nhưng header/detail/history giữ PICKED_UP; Admin còn form báo thất bại theo snapshot cũ | Ghi nhận trong lượt nghiệm thu, chưa sửa runtime | Hai trạng thái trên cùng trang gây hiểu nhầm, cần đọc lại detail trước thao tác | TV3 đồng bộ detail khi tracking phát hiện thay đổi trạng thái, giữ quyền và tránh vòng lặp tải; [bằng chứng](evidence/tv3-tracking-cloud-week8/evening-observations.json) |
| 18/11/2026 | Worker/Cloud | Chưa đủ deployment record và kiểm chi phí cho cấu hình chạy nền ổn định | Buổi sáng đã hoàn nguyên min 0/Request-based sau lượt tạm. Buổi tối người dùng báo chỉnh lại theo đặc tả, GPS mới đã tới Customer/Admin; chưa đọc lại revision/config đầy đủ. [Bằng chứng mới](evidence/tv3-tracking-cloud-week8/report.md#kiểm-lại-buổi-tối--gps-mới-và-terminal) | Không suy rộng ca kiểm sang vận hành liên tục hoặc NF11; 9 bản gốc DLQ trước đó chưa xác minh dọn | TV5/TV2 ghi billing/CPU/min/max, revision/source và chi phí thực; dọn bản DLQ đã xác minh theo quy trình nhóm |
| 17/11/2026 | Worker | Worker NACK cả lỗi vĩnh viễn khi ghi DB (khóa ngoại `23503`, `driverId` không có trong `users`) | Phát hiện trên Cloud 16/11, chưa sửa | Message sai bị gửi lại liên tục, tốn tài nguyên Worker | Tuần 9 (TV2) |
| 14/11/2026 | Triển khai | Image Cloud Build chỉ gắn tag `:latest` | Chưa cần rollback | Không rollback được về đúng bản cũ | Khi làm CI/CD tuần 9 |
| 14/11/2026 | CI | Chưa có GitHub Actions chạy `npm run check` trên mỗi PR | Việc tuần 9 của TV5 | PR lỗi lọt vào `develop` | Tuần 9 |
| 14/11/2026 | Cloud | Topic `int3326e_pubsub` và subscription `int3326e_subcription` thử nghiệm từ tuần 4 còn trên GCP | Cần quyền GCP, chờ nhóm xác nhận không dùng | Nhầm topic khi cấu hình | Khi TV5 dọn GCP |
| 14/11/2026 | API | Chưa có báo giao thất bại (API07) | Việc tuần 9 của TV1 | AC07 chưa đạt | Tuần 9 |
| 14/11/2026 | Test | Test PostgreSQL thật bị bỏ qua khi thiếu biến môi trường, `npm run check` vẫn báo đạt | Không có DB trong máy mọi người | Lỗi SQL thật không bị phát hiện | Khi có CI với service PostgreSQL |
