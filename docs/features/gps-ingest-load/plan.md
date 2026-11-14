# Kế hoạch GPS ingest k6

1. Đọc contract API08/EVT01 và benchmark hiện có; tạo nhánh từ develop sạch.
2. Tạo script k6 độc lập, không import Node/shared TS để tránh bundler/dependency.
   Tách cấu hình/payload/response thành module JS thuần có thể test trên Node.
3. Dùng SharedArray đọc token file trong init; validate sub/role/exp và mapping
   Driver theo VU id. Metric không có token, UID hoặc eventId làm tag.
4. Thêm smoke runner Node, load API đã build bằng createRequire của API để dùng
   đúng Nest 11. Override đúng Firebase/token verifier, business lookup và topic;
   bind loopback port ngẫu nhiên. Sinh JWT fixture không có giá trị ngoài test.
5. Spawn binary k6 thật; kiểm 2 Driver, mapping của broker mock, seq/timestamp/
   payload và report. Chạy thêm HTTP lỗi/response sai và config thiếu token.
   Xóa token file tạm trong finally; không sửa bảng hoặc cấu hình Cloud.
6. Kiểm tra chuẩn toàn repo, lưu report đã bỏ bí mật và hướng dẫn chạy lại;
   cập nhật features/điều phối theo bằng chứng, giữ checkpoint Cloud mở.

Analyze chỉ đọc trước implement: không có xung đột L1–L6 với contract hiện hành.
Constant-vus đáp ứng mô phỏng số Driver; không chứng minh offered load cố định.
JWT decode không chứng minh quyền, API vẫn kiểm thật khi chạy môi trường thật.
Chạy smoke Nest HTTP với broker mock không phải benchmark Pub/Sub/Worker/SQL.
Không có yêu cầu nghiêm trọng chưa rõ chặn triển khai phạm vi tuần 8.
