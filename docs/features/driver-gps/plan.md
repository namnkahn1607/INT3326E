# Kế hoạch TV4 tuần 7

Tiếp tục component `GpsEmitter` và dashboard hiện có, giữ adapter/Auth/backend.
Không tạo app, endpoint hoặc dependency mới.

1. Thêm select nguồn, simulator theo tuyến ngắn có nhãn; mặc định simulator để
   hành vi mở trang không tự xin quyền định vị. Giữ tọa độ đầu tương thích test cũ.
2. Ở mỗi tick 8 giây của nguồn browser, gọi `getCurrentPosition` với
   `maximumAge: 0`, `enableHighAccuracy: true`, `timeout: 7000`.
   Deadline riêng 7 giây bao gồm chờ quyền, vì timeout native có thể không bao gồm
   bước đó. Dùng timestamp đo, không thay bằng thời gian HTTP gửi.
3. Hiệu lực callback gắn với lần Start/effect hiện tại; cleanup vô hiệu hóa callback
   và xóa deadline/interval. Geolocation one-shot không có API hủy; bỏ kết quả muộn.
   Kiểm tra shared validator trước phát mẫu; không nhân đôi seq dưới StrictMode.
4. Đổi lời hướng dẫn dashboard, thêm style select theo giao diện Driver đang có.
5. Mở rộng test component và dashboard cho hai nguồn, quyền/lỗi/timeout, callback
   muộn, Start/Stop và đổi phiên. Giữ các test adapter contract/auth hiện có.
6. Mở rộng harness browser local hiện có; kiểm tra Geolocation trên browser qua
   tọa độ/quyền giả lập, API/Auth mock. Không gửi tọa độ thật lên cloud để thử.
7. Chạy test frontend, lint/build và browser harness; review diff. Bàn giao lệnh
   chạy lại và các bước Cloud còn thiếu; không commit/push/deploy.

## Review và analyze trước triển khai

Chỉ đọc spec/contract/code để tìm vấn đề, sửa artifact sau lượt analyze nếu cần.
Không có mâu thuẫn nghiêm trọng trong R1–R7. Giới hạn cần ghi rõ khi bàn giao:

- R3 là nhịp yêu cầu đo 8 giây; browser có thể cần thêm thời gian để trả vị trí.
- Không thay timestamp cũ bằng timestamp hiện tại để giả mẫu mới; không triển khai
  chính sách stale/retry tuần 8 trong nhiệm vụ này.
- Bảng tồn đọng QA đề cập nhận/giao đơn rộng hơn E25 của sheet; không lấy đó làm
  phạm vi bổ sung. Nghiệm thu chuỗi GPS Cloud vẫn phụ thuộc tài khoản và runtime.

## Bổ sung theo yêu cầu nhận/giao

1. Dùng component danh sách riêng trong dashboard; route chi tiết nằm trong
   DriverLayout/ProtectedRoute hiện có. Remount theo account và ID để dọn dữ liệu.
2. Dùng getShipments/getShipmentById, StatusBadge và ShipmentLifecycleDetails.
   Thêm adapter pickup/deliver vào shipments.ts theo đúng OpenAPI đã kiểm tra.
3. Detail dùng pha loading/ready/review/submitting/reconciling/blocked; AbortController
   và khóa ref chống double click. Không PATCH enum hoặc tự tạo history.
4. Test contract, cursor/lọc, lỗi/quyền, xác nhận/cancel, lost response, đọc lại
   lỗi và account/route cleanup. Chạy suite frontend, lint/build, browser local.
5. Bàn giao tách kết quả mock/local với handler TV1 và nghiệm thu Cloud còn mở.

Analyze chỉ đọc trước implement: không có mâu thuẫn nghiêm trọng D1–D5.
Firebase UID không phải business driverId; scope do backend xác thực. OpenAPI
pickup/deliver vẫn draft nhưng đã có method/body/response; frontend có thể dùng
contract này và hiển thị lỗi thật, không giả backend thành công. Phạm vi mới
được người dùng cấp trực tiếp, không lấy bảng QA làm yêu cầu tự mở rộng.

## Kế hoạch emitter tuần 8

1. Giữ component/adapter/Auth và payload hiện hành. Bổ sung lọc acquisition
   trong GpsEmitter, giữ timestamp đo, không dừng khi chỉ mẫu đó không đạt.
2. Tách buffer/retry thành GpsDeliveryQueue, tạo theo mount DriverDashboard.
   Dashboard key theo user.id và role gate giữ nguyên; cleanup dispose queue.
   Queue sở hữu một AbortController, một timer backoff và listener online/offline.
   Adapter nhận token gắn mount tài khoản qua tùy chọn token sẵn có của apiClient;
   cập nhật token trong cùng mount khi refresh, không đọc global account lúc replay.
3. Nối Start/Stop qua callback trạng thái emitter. Hiển thị số mẫu chờ, mẫu bị
   bỏ và lỗi; không đưa token hoặc thông tin triển khai vào UI.
4. Test các biên accuracy/tuổi/thứ tự; backlog/offline/replay bất biến;
   overflow/expiry, backoff và lỗi vĩnh viễn, Stop/restart, StrictMode và phiên.
5. Chạy kiểm tra chuẩn toàn repo và harness browser local; cập nhật bàn giao,
   features và điều phối tuần. Không commit/push/deploy theo giới hạn người dùng.

Analyze trước implement (chỉ đọc, 15/11/2026): E1–E6 có truy vết tới giao việc;
buffer và mẫu mới lấy cần hai giới hạn tuổi riêng để không vô hiệu hóa gửi bù.
Không có thay đổi backend/API. Lỗi quyền phải chặn queue thay vì thử mẫu tiếp
theo; response muộn sau dispose không được tạo retry. Không có mâu thuẫn nghiêm
trọng sau khi ghi rõ phần thay thế R4 và giới hạn queue/retry tuần 7 trong spec.
