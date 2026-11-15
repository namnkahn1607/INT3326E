# Tuần 12 (07/12–13/12)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: FALSE. Checkpoint nhóm: có bộ số liệu performance/scalability thật, release candidate sẵn sàng.

## Việc của TV6 theo sheet

Tổng hợp kết quả load test + QA vào format báo cáo, tiếp tục sửa bug.

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W12-TV6-01a | Thu số đo LT01–LT05 từ TV4 và dashboard TV5 | W12-TV4-01, W12-TV5-01 | Bảng số đo thô, kèm config và revision | NF01–NF06 | Chưa bắt đầu |
| W12-TV6-01b | Điền mẫu kết luận NFR (Phần IV mục 9): config, số đo, target, đạt hoặc chưa đạt | W12-TV6-01a | Bảng NF03, NF04, NF05, NF06, NF11 | NFR | Chưa bắt đầu |
| W12-TV6-01c | Ghi rõ đã đo ở môi trường nào; không dùng số của emulator hoặc mock thay số Cloud | W12-TV6-01b | Phần giới hạn trong báo cáo | NFR | Chưa bắt đầu |
| W12-TV6-02a | Tiếp tục kiểm hồi quy các lỗi được sửa | Danh sách lỗi | Danh sách lỗi mở và đã đóng | AC01–AC10 | Chưa bắt đầu |
| W12-TV6-02b | Xác nhận release candidate | W12-TV6-02a | Biên bản RC | Phần VII | Chưa bắt đầu |

## Đã làm được

- Chưa có việc nào của tuần này.

## Còn thiếu và rủi ro

- Phụ thuộc số đo thật của TV4 và TV5. Không có số đo thì ghi "chưa đạt/chưa đo", không làm tròn.
- Mức p95 xác thực Firebase (hai lượt tra mỗi request) là điểm cần đo ở NF03 và NF04.
