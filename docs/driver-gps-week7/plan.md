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
