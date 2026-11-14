# GPS ingest k6 — tuần 8

Ngày 15/11/2026, nhánh `test/gps-ingest-load`, base `develop@f28365d`.
Nguồn chính thức: yêu cầu hiện tại của người dùng và mục load test trong
`docs/coordination/week-08.md` (từ giao việc tuần 8). Benchmark Worker hiện có
chỉ mô phỏng Map trong process; tham khảo 500 Driver/nhịp 8 giây, không dùng
kết quả đó làm phép đo HTTP hoặc Cloud. Không phụ thuộc PR emitter chưa merge.

- L1: script k6 trong `infra/` thực sự POST `/v1/locations`; cấu hình BASE_URL,
  DRIVERS, SEND_INTERVAL_SECONDS, DURATION_SECONDS, REQUEST_TIMEOUT_SECONDS,
  DRIVER_TOKENS_FILE và SUMMARY_PATH qua biến môi trường. Mặc định 2 Driver,
  8 giây/mẫu/Driver, 16 giây; URL và token phải được chỉ định.
- L2: mỗi VU gắn một Driver/token riêng; chỉ gửi lat/lng/clientTimestamp/seq.
  Tọa độ mô phỏng xác định, timestamp UTC mili giây hiện tại và tăng theo Driver;
  mỗi VU một request mỗi lúc, không retry. Không giả Driver bằng trường driverId.
- L3: kiểm tra cấu hình trước gửi; token JWT phải có sub khác nhau, role DRIVER,
  exp còn đủ cho lượt chạy. Decode chỉ để kiểm tra fixture, không thay xác thực
  Firebase của API. Token không nằm trong repo, report, log hoặc metric tag.
- L4: chỉ tính accepted khi HTTP 202 và body ACCEPTED/eventId/receivedAt hợp lệ.
  Test fail khi HTTP/response sai, hoặc không có request accepted; lưu số gửi/
  accepted/lỗi và HTTP latency p95/p99. Chưa áp ngưỡng NFR hiệu năng tuần 9.
- L5: hướng dẫn cài k6, chuẩn bị Driver có linkage, chạy PowerShell và đọc JSON;
  nói rõ nominal rate DRIVERS/interval của closed model giảm khi API chậm,
  không nhầm http latency với end-to-end Worker/SQL.
- L6: chạy thử nhỏ bằng k6 thật với ít nhất 2 Driver, kiểm tra mapping và payload
  qua Nest HTTP local. Có fixture cô lập Firebase/PubSub, không đổi auth runtime
  hoặc gửi vào Cloud. Lưu bằng chứng ghi rõ mức mock; kiểm lỗi config/HTTP/
  response để chứng minh script không báo PASS giả.

Chi tiết thông thường: constant-vus với elapsed-time pacing để không cộng
thêm HTTP latency vào interval khi request hoàn thành kịp. Hết thời gian chỉ
chờ request hiện hành theo timeout, không retry. Lượt local dùng 2 Driver,
interval 1 giây, duration 3 giây; không chạy baseline 62.5/peak 300 events/s.
Máy không có `.specify/` hay skill Spec Kit; review artifact tương đương, không
tạo constitution. Không commit/push/deploy trong nhiệm vụ này.

Sau bàn giao phần triển khai, người dùng yêu cầu commit và push nhánh
`test/gps-ingest-load`; chưa cấp yêu cầu merge hoặc deploy.
