# Tuần 11 (30/11–06/12)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: FALSE. Checkpoint nhóm: hệ thống ổn định trên cloud; kịch bản demo recovery sẵn sàng.

## Việc của TV6 theo sheet

QA toàn diện (đủ 8 use case + phân quyền), dry-run backup-deploy cùng TV5.

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W11-TV6-01a | Chốt danh sách 8 use case bắt buộc cùng nhóm | Checkpoint tuần 9 | Danh sách có chữ ký của nhóm | Phần VII | Chưa bắt đầu |
| W11-TV6-01b | Chạy lại toàn bộ ca AC01–AC10 trên bản đã deploy | Revision Cloud | Bảng kết quả theo ca | AC01–AC10 | Chưa bắt đầu |
| W11-TV6-01c | Tách rõ kết quả mock, local, SQL local và Cloud trong báo cáo | W11-TV6-01b | Báo cáo QA | Phần VII | Chưa bắt đầu |
| W11-TV6-02a | Cùng TV5 chạy backup rồi restore Cloud SQL thủ công | W11-TV5-01 | Biên bản dry-run | NF07 | Chưa bắt đầu |
| W11-TV6-02b | Deploy lại từ revision đã ghi, smoke sau khi khôi phục | W11-TV6-02a | Biên bản gồm SHA và revision | NF12 | Chưa bắt đầu |

## Đã làm được

- Chưa có việc nào của tuần này.

## Còn thiếu và rủi ro

- Phụ thuộc môi trường Cloud ổn định từ TV5 và CI/CD.
- Danh sách 8 use case chưa được chốt, cần xử lý đầu tuần 11 hoặc sớm hơn.
