# Dry-run k6 GPS ingest trên Cloud, tuần 9

Ngày 21/11/2026, k6 v2.4.0 chạy từ `develop@a8a6936` vào
`POST /v1/locations` trên GCP `int3326e`, vùng `asia-southeast1`.
API `backend-service-00039-hng` và Worker `worker-service-00032-mj2`
đều nhận 100% traffic. Worker dùng Instance-based billing và subscription
`gps-events-sub`. [API Cloud Run](https://console.cloud.google.com/run/detail/asia-southeast1/backend-service/revisions?project=int3326e) · [Worker Cloud Run](https://console.cloud.google.com/run/detail/asia-southeast1/worker-service/revisions?project=int3326e)

## K6

Lượt chạy từ **20:58:13,724 đến 20:59:49,889 ICT** (13:58:13,724–13:59:49,889
UTC). Dùng một Driver test với hai đơn `ASSIGNED` đã được người dùng xác nhận
là dữ liệu test và không có đơn `PICKED_UP`. K6 gửi tọa độ mô phỏng theo
`constant-vus`, chu kỳ 8 giây, duration 90 giây và timeout HTTP 7 giây.

| Chỉ số | Kết quả Cloud |
| --- | ---: |
| Offered | 12 |
| Accepted, HTTP 202 với body đúng hợp đồng | 12 |
| Lỗi HTTP, transport hoặc body 202 sai | 0 |
| Request chưa có kết quả | 0 |
| Offered / accepted mỗi giây theo elapsed k6 | 0,125 / 0,125 |
| p95 HTTP | 1.209,90 ms |
| Exit code | 0 |

## Pub/Sub và Worker

Metrics Explorer xuất dữ liệu theo phút cho `gps-events-sub`. Thời gian trong
bảng là ICT ngày 21/11/2026. [Subscription metrics](https://console.cloud.google.com/cloudpubsub/subscription/detail/gps-events-sub?project=int3326e) · [Định nghĩa các metric](https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z#pubsub)

| Mốc | Tổng backlog `num_undelivered_messages` | Backlog vùng `asia-southeast1` | Tuổi tin chưa ACK lâu nhất | Streaming Pull mở, `ok` |
| --- | ---: | ---: | ---: | ---: |
| Trước lượt, 20:58 | 0 | Không có dữ liệu | 0 giây | 5 |
| Trong lượt, 20:59 | 0 | Không có dữ liệu | 0 giây | 5 |
| Sau lượt, 21:00 | 0 | Không có dữ liệu | 0 giây | 5 |
| Sau lượt, 21:02 | 0 | 0 | 0 giây | 5 |

Các điểm đo theo phút có thể bỏ qua backlog tồn tại giữa hai điểm. Logs
Explorer thấy 12 `eventId` riêng biệt ở Worker trong khoảng 20:58:14,513–
20:59:39,181 ICT. Cả 12 đi qua nhánh ghi lịch sử `history-only: clock_skew`,
do `clientTimestamp` lớn hơn `receivedAt`. Log của repository ghi bỏ qua
`current_locations` cho 12 mẫu và không có lỗi persistence trong cửa sổ
kiểm tra. Lượt này chưa đối chiếu 12 transaction bằng truy vấn Cloud SQL.
[Log Worker](https://console.cloud.google.com/run/detail/asia-southeast1/worker-service/logs?project=int3326e)

## Kết thúc

Cloud SQL `int3326esql` ban đầu ở trạng thái `Stopped`. Console ghi lệnh bật
lúc 20:52:44 ICT. Sau khi Worker nhận đủ mẫu, đã gửi lệnh tắt lúc 21:01:08 ICT
theo yêu cầu người dùng. Console xác nhận `Stopped` lúc 21:01:43 ICT và giữ
trạng thái đó sau khi tải lại trang. File ID token tạm của k6 đã được xóa.
[Cloud SQL Overview](https://console.cloud.google.com/sql/instances/int3326esql/overview?project=int3326e)

Kết quả là dry-run API08 ở tải nhỏ. Nghiệm thu tải baseline/peak, độ trễ đầu
cuối và xác nhận `current_locations` của AC04 thuộc các lượt kiểm riêng.
