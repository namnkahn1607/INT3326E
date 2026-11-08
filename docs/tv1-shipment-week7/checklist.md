# Checklist chất lượng yêu cầu — TV1 tuần 7

Checklist này đánh giá chất lượng và tính nhất quán của yêu cầu trước khi implement, không dùng để thay thế bằng chứng kiểm thử code.

- [x] C01: Nguồn yêu cầu chính thức (Đặc tả v1.4, OpenAPI, API contract) và tài liệu hỗ trợ được phân biệt rõ ràng (spec: Nguồn yêu cầu và phạm vi).
- [x] C02: Thứ tự kiểm tra `401 -> 403 -> 404 -> 200 No-op / 409` được định nghĩa không nhập nhằng cho cả `pickup` và `deliver` (R1–R3).
- [x] C03: Quy tắc chuẩn hóa body của `pickup` (rỗng/không body) và `deliver` (`proofOfDeliveryNotes` tùy chọn, trim, tối đa 255 ký tự Unicode) được xác định đầy đủ (R2, R3).
- [x] C04: Yêu cầu nguyên tử trong một SQL transaction cho `shipments`, `shipment_status_events` (`previousDriverId = newDriverId = driverId`), `notifications` và xử lý No-op giữ nguyên dữ liệu gốc được quy định rõ (R2, R3, R4).
- [x] C05: Hành vi khóa dòng chống race condition giữa `Assign` và `Pickup` (`TC02.5`) và tích hợp chuỗi lịch sử `statusHistory` (`TC06.1`) có tiêu chí kiểm chứng cụ thể (R4, R5).
- [x] C06: Giới hạn phạm vi tuần 7 tách bạch với tuần 8–10 (`tracking`, `fail`, `ETA`) và tách bạch kết quả kiểm thử local với nghiệm thu Cloud.

Review riêng trước implement ngày 08/11/2026: C01–C06 đạt khi đối chiếu với Đặc tả v1.4 (mục 2.2, 4.3, 4.4, 4.6, 4.7, 7, 8) và OpenAPI. Analyze không phát hiện mâu thuẫn nghiêm trọng.
