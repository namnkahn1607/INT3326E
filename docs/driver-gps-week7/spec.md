# TV4 tuần 7 — nguồn vị trí Driver

Ngày: 08/11/2026. Nhánh: `feature/driver-dashboard-gps`; base `develop@c0f8c8b`.
Người dùng cho phép quy trình spec/review/code/test tương đương, không dùng skill
Spec Kit đang thiếu. Không tạo constitution hoặc đổi nguyên tắc dự án.

## Nguồn và phạm vi

- Yêu cầu người dùng: hoàn thiện phần TV4 tuần 7.
- Sheet `Tiến độ 10 Tuần`, B22/E25 trong `ParcelFlow - Bảng theo dõi tiến độ.xlsx`
  do người dùng cung cấp: kết nối Driver gửi GPS từ trình duyệt hoặc simulator.
- `ParcelFlow v1.4.md` do người dùng cung cấp là tài liệu tổng quan có liên kết
  các phần FRD/App Design; không chứa đầy đủ nội dung các phần đó.
- [Contract hiện hành](../gps-event-contract.md), shared type và OpenAPI xác định
  payload/identity. [Bàn giao Driver](../driver-dashboard-gps.md) là bằng chứng
  hiện trạng. Phân rã W7-TV4-01/02 trong `docs/tv6/week-task-breakdown.md` được
  đối chiếu với sheet, không tự nâng báo cáo AI thành yêu cầu mới.

Không thêm retry/offline queue/load test của các tuần sau. Không thêm API,
migration hoặc UI pickup/delivery từ đề xuất QA khi chưa có yêu cầu tương ứng.

## Yêu cầu và tiêu chí chấp nhận

- R1 (W7-TV4-01): chọn nguồn có nhãn `Mô phỏng` hoặc `Vị trí trình duyệt`.
  Mặc định mô phỏng; không hỏi quyền hoặc gửi dữ liệu khi mở trang/chọn nguồn.
  Simulator đi qua các tọa độ mẫu khác nhau, hiển thị rõ không phải vị trí thật.
- R2 (W7-TV4-01): nguồn trình duyệt dùng Geolocation API, không dùng tọa độ mẫu
  làm fallback. Mỗi mẫu giữ timestamp đo của `GeolocationPosition`, đổi sang UTC ms.
- R3 (W7-TV4-02): sau Start, mỗi 8 giây tạo mẫu mô phỏng hoặc yêu cầu lấy vị trí.
  Không có mẫu trước 8 giây; vị trí trình duyệt chỉ gửi khi lấy được kết quả.
  Mỗi lần lấy vị trí có hạn 7 giây và không chồng lấn. Stop/restart tiếp tục seq;
  chỉ đổi nguồn khi đã dừng, mẫu cũ không mang nhãn nguồn mới.
- R4 (W7-TV4-02): thiếu HTTPS/secure context, API không hỗ trợ, từ chối quyền,
  không có vị trí, hết hạn hoặc dữ liệu đo sai phải báo lỗi tiếng Việt và dừng.
  Người dùng có thể xử lý quyền rồi Start lại hoặc tự chọn simulator.
- R5 (W7-TV4-02): chỉ gửi `lat/lng/clientTimestamp/seq` qua adapter và phiên Driver
  hiện hành. Kiểm tra dữ liệu trước callback; không tăng seq cho mẫu không hợp lệ.
  Giữ timeout HTTP 7 giây, một request HTTP mỗi lúc và chỉ đếm HTTP 202 hợp lệ.
- R6 (W7-TV4-01/02): Stop/rời trang/đổi tài khoản/hết phiên dọn timer, bỏ callback
  định vị đến muộn. Stop không hủy HTTP đã gửi, như hành vi tuần 6 đã chốt.
- R7: kiểm thử phân biệt mock, browser local và Cloud. Không coi 202/mock là
  bằng chứng Worker đã ghi SQL. Tài khoản/config/revision và nghiệm thu Cloud
  do TV2/5/6 phối hợp; giữ mục nghiệm thu thật mở nếu chưa có bằng chứng.

Chi tiết kỹ thuật R2/R4 đối chiếu [W3C Geolocation](https://www.w3.org/TR/geolocation/):
`getCurrentPosition`, `maximumAge`, `timeout`, timestamp đo và mã lỗi.
