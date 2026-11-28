# TV4 tuần 10 — Dry-run GPS ingest trên Cloud

Ngày 28/11/2026, k6 v2.4.0 gọi `POST /v1/locations` tại dự án `int3326e`,
vùng `asia-southeast1`. API `backend-service-00041-g24` và Worker
`worker-service-00033-jlq` nhận 100% traffic. Worker dùng Instance-based billing
và `PUBSUB_SUB_GPS_EVENTS=gps-events-sub`. TV4 chạy độc lập theo trao đổi với
người dùng, không có xác nhận chạy chung từ TV5. [API Cloud Run](https://console.cloud.google.com/run/detail/asia-southeast1/backend-service/revisions?project=int3326e) ·
[Worker Cloud Run](https://console.cloud.google.com/run/detail/asia-southeast1/worker-service/revisions?project=int3326e)

## Kết quả HTTP

Cloud SQL hoàn tất bật lúc **09:51:45 ICT**. `GET /v1/shipments?status=PICKED_UP&limit=1`
trả 200 và danh sách rỗng cho Driver demo. K6 dùng 1 Driver, chu kỳ 8 giây,
duration 90 giây và timeout HTTP 7 giây. Cửa sổ trên đồng hồ máy chạy k6
là **09:52:43,258–09:54:19,754 ICT** (02:52:43,258–02:54:19,754 UTC),
gồm thời gian chờ iteration cuối kết thúc.

| Chỉ số | Kết quả |
| --- | ---: |
| Offered | 12 |
| Accepted (HTTP 202, body đúng API08) | 12 |
| Lỗi transport, HTTP hoặc body 202 sai | 0 |
| Request chưa có kết quả | 0 |
| Offered / accepted mỗi giây theo elapsed k6 | 0,125 / 0,125 |
| p95 HTTP | 805,96251 ms |
| Exit code | 0 |

p95 quan sát cao hơn mốc 150 ms. Lượt tải nhỏ không áp dụng cổng NF05, chưa
đo baseline LT01 và chưa có kết luận nghiệm thu NF05.

## Backlog và Worker

Metrics Explorer xuất ba chuỗi của `gps-events-sub` ở độ phân giải 1 phút.
Các mốc bên dưới lấy theo đồng hồ Cloud. Lấy mẫu theo phút có thể bỏ qua
backlog tồn tại giữa hai điểm. [Cloud Monitoring](https://console.cloud.google.com/monitoring/metrics-explorer?project=int3326e) ·
[Định nghĩa metric Pub/Sub](https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z#pubsub)

| Mốc ICT | Tổng tin chưa ACK | Tuổi tin chưa ACK lâu nhất | Streaming Pull mở (`ok`) |
| --- | ---: | ---: | ---: |
| Trước, 09:52 | 0 | 0 giây | 5 |
| Trong, 09:53 | 0 | 0 giây | 5 |
| Trong, 09:54 | 0 | 0 giây | 5 |
| Sau, 09:55 | 0 | 0 giây | 5 |
| Sau, 09:56 | 0 | 0 giây | 5 |

Worker nhận 12 `eventId` khác nhau lúc **09:52:37,621–09:54:04,592 ICT**.
Cả 12 đi nhánh `history-only: clock_skew`. Timestamp từ máy chạy k6 nhanh hơn
thời điểm Worker nhận khoảng 6–7 giây; repository ghi bỏ qua
`current_locations` cho cả 12 mẫu. Không thấy lỗi persistence của revision
trong cửa sổ truy vấn. Chưa đối chiếu transaction bằng truy vấn SQL.
[Logs Explorer](https://console.cloud.google.com/run/detail/asia-southeast1/worker-service/logs?project=int3326e)

Cloud SQL ban đầu ở trạng thái `Stopped`. Lệnh bật lúc 09:48:23 ICT hoàn tất
lúc 09:51:45. Sau khi Worker nhận đủ mẫu, lệnh tắt lúc 09:57:31 hoàn tất lúc
09:58:03. Console xác nhận `Stopped` lúc 09:58:06.
[Cloud SQL Overview](https://console.cloud.google.com/sql/instances/int3326esql/overview?project=int3326e)

## Token và kiểm tra local

Tài khoản demo đăng nhập Firebase để lấy 1 ID token `DRIVER`. File tạm trong
`.vitest/` đã được xóa sau khi chạy. Firebase Auth liệt kê 8 tài khoản tổng cộng
lúc kiểm tra, nên chưa có pool 500 Driver cho baseline Cloud. Không có token
hay mật khẩu trong dữ liệu báo cáo/Git.

Local: `k6 inspect` với 500 token fixture xác nhận 3.750 lượt/phút, 500 VU,
12 phút phát tải và ngưỡng `p(95)<150` trong cửa sổ đo. 51 test cấu hình/hợp đồng
và 9 kịch bản k6 thật qua Nest HTTP đạt với Firebase, lookup và Pub/Sub mock.
`npm run check` exit 0: 201 Worker/shared/load, 2 health, 487 API và 635 web
đạt, 137 ca môi trường riêng bị bỏ qua. [Cấu hình và cách chạy](../../../infra/load/README.md)
