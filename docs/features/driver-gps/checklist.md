# Review chất lượng yêu cầu

Checklist này đánh giá spec trước implement, không chứng minh code hoàn tất.

- [x] C01: nguồn chính thức và tài liệu hỗ trợ được phân biệt (spec: Nguồn).
- [x] C02: hai nguồn, mặc định và thời điểm xin quyền rõ ràng (R1–R2).
- [x] C03: cadence, timestamp, timeout và Stop/restart có tiêu chí đo được (R2–R3/R6).
- [x] C04: permission/error/unsupported/invalid và cách phục hồi rõ (R4–R5).
- [x] C05: Auth/payload/202 tái sử dụng contract, không phát sinh API (R5).
- [x] C06: không mở rộng queue/load test/lifecycle, không gộp local với Cloud (R7).

Review riêng ngày 08/11/2026: mỗi mục đối chiếu các R được dẫn và contract GPS.
Analyze chỉ đọc không phát hiện mâu thuẫn nghiêm trọng; các giới hạn ghi tại plan.
Các dấu đạt ở đây chỉ xác nhận chất lượng yêu cầu trước triển khai.

## Checklist bổ sung nhận/giao

- [x] C07: D1–D2 xác định nguồn dữ liệu, scope Driver, cursor và trạng thái lỗi.
- [x] C08: D3 xác định điều kiện trạng thái, xác nhận, body và response theo OpenAPI.
- [x] C09: D4 phân biệt POST xác nhận, GET đối chiếu và kết quả chưa xác định.
- [x] C10: D5 tách phạm vi frontend khỏi backend/Cloud; giữ GPS và auth hiện có.

Review riêng trước implement ngày 08/11/2026: C07 đối chiếu D1/D2 và repository
scope Driver; C08 đối chiếu D3 với method/body/200 của OpenAPI; C09 đối chiếu
D4 và cơ chế đối chiếu hiện có của Admin; C10 đối chiếu D5 và base cbec8fb.
Các mục đủ rõ để triển khai frontend; không xác nhận handler hoặc Cloud đã đạt.

## Checklist yêu cầu emitter tuần 8

- [x] C11: E1 xác định mẫu bị bỏ, seq và khả năng phục hồi khi lấy mẫu kế tiếp.
- [x] C12: E2–E4 xác định FIFO, retry, giới hạn và tuổi mẫu replay riêng acquisition.
- [x] C13: E3/E5 xác định lỗi quyền, Stop, phiên, request muộn và cleanup.
- [x] C14: E6 xác định giới hạn trình duyệt và phân biệt local/Cloud.

Review riêng trước implement ngày 15/11/2026: C11 đối chiếu E1 và validator
GPS; C12 đối chiếu E2–E4 và quy tắc timestamp/retry của contract; C13 đối chiếu
E3/E5 với keyed dashboard và AbortSignal; C14 đối chiếu E6/R7. Các hằng số
client và phạm vi thay thế yêu cầu tuần 7 được ghi rõ trong spec. Không có
điểm thiếu yêu cầu chặn implement; các dấu này không chứng minh code đã đạt.
