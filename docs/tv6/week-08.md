# Tuần 8 (09/11–15/11)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: FALSE. Checkpoint nhóm: Customer thấy vị trí tài xế cập nhật gần real-time trên cloud. Trễ ở đây thì load test tuần 8–9 gặp rủi ro, ưu tiên cao nhất.

## Việc của TV6 theo sheet

QA tính năng tracking; test thủ công kịch bản duplicate/out-of-order GPS.

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W8-TV6-01a | QA tracking: Customer đúng owner xem được; Customer khác và driver khác nhận 403 | W8-TV3-02, API tracking | Kết quả TC05.1 | AC05, NF09 | Chưa bắt đầu |
| W8-TV6-01b | Chưa có GPS thì map không lỗi; terminal không lộ GPS; reassign không dùng current của driver cũ | W8-TV6-01a | Kết quả TC05.2–05.3 | AC05 | Chưa bắt đầu |
| W8-TV6-01c | Kiểm polling dừng khi rời trang; loading, rỗng, lỗi phân biệt được | UI tracking của TV3 | Ghi chú trình duyệt | AC05 | Chưa bắt đầu |
| W8-TV6-02a | Lập manifest mẫu: mới, cũ, trùng khóa, tương lai (LT06) | Worker tuần 8 | Manifest có kết quả mong đợi | LT06, TC04.3–04.5 | Chưa bắt đầu |
| W8-TV6-02b | Gửi duplicate và out-of-order, đối chiếu history/current trong SQL | W8-TV2-02 | Một history mỗi khóa; current không lùi | AC04, NF08 | Chưa bắt đầu |
| W8-TV6-02c | Ghi kết quả theo mẫu, nêu rõ môi trường | Các bước trên | Bảng PASS/FAIL/BLOCKED | Mẫu ở [tv6-weekly.md](tv6-weekly.md) | Chưa bắt đầu |

## Đã làm được

- Chưa có việc nào của tuần này (tuần bắt đầu 09/11).
- Chuẩn bị sẵn: truy vấn Admin directory đã đọc đúng cột GPS của Worker, và mã TC04.x, TC05.x đã gắn vào ma trận QA.

## Còn thiếu và rủi ro

- Phụ thuộc vào Worker dedupe/ordering (TV2), UI tracking (TV3) và Cloud (TV5). Nếu tuần 7 chưa ghi được một mẫu vào SQL thì các ca này không chạy được.
- Dedupe và ordering cần kiểm trên PostgreSQL thật, không dùng bộ nhớ của Worker.
