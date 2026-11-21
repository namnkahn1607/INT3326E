# Điều phối nhóm theo tuần

Mỗi tuần có một file: việc của 6 thành viên, checkpoint, tình hình thực tế và PR chốt tuần. Nguồn giao việc gốc là sheet chia việc và roadmap trong đặc tả v1.4. File ở đây ghi phần điều phối thêm (thứ tự, hạn, phụ thuộc) và kết quả cuối tuần.

Quy ước chốt tuần:
- Cả nhóm xong việc của tuần trên `develop`, rồi mở PR `week/NN` → `main`, chọn "Create a merge commit".
- Deploy một lần, từ một SHA, sau khi chốt code.
- Mỗi PR của thành viên kèm kết quả test phần mình. Kết quả trên Cloud kèm URL hoặc revision.

| Tuần | Thời gian | Checkpoint | PR chốt tuần |
| --- | --- | --- | --- |
| [Week 4](week-04.md) | 12/10–18/10 | Health check 2 service Cloud Run, Pub/Sub có topic/subscription | #23 |
| [Week 5](week-05.md) | 19/10–25/10 | Customer đăng nhập, tạo và xem đơn trên Cloud SQL | #24 |
| [Week 6](week-06.md) | 26/10–01/11 | Dispatcher gán tài xế; GPS test thấy trong Pub/Sub | #25 |
| [Week 7](week-07.md) | 02/11–08/11 | Luồng tạo đơn đến giao hàng; GPS ghi qua Worker | #26 (chờ duyệt) |
| [Week 8](week-08.md) | 09/11–15/11 | Customer thấy vị trí tài xế gần real-time trên Cloud | Chưa |
