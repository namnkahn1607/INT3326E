# Bàn giao frontend vòng đời đơn — tuần 4

Ngày kiểm tra: 30/10/2026. Nền tích hợp `6d75d53`; phần frontend tuần 4 đang ở
working tree, chưa commit/push/deploy. [Đặc tả chức năng](shipment-lifecycle.md)
tham chiếu PF SPEC 01 v1.3. Không sửa backend, Driver, database hoặc tài nguyên Cloud.

## Đã triển khai

- Customer Detail và Admin Detail dùng chung lịch sử trạng thái tiếng Việt,
  actor/thời gian/tài xế/reason từ server; hiển thị failure audit và delivery notes.
- Route Admin `/admin/shipments/:id`, link riêng từ danh sách; tải code khi mở trang.
- Admin báo thất bại chỉ khi PICKED_UP, reason trim 5–500 ký tự, xem lại rồi xác
  nhận riêng. Body chỉ reason; chặn gửi lặp, không PATCH trạng thái.
- Timeout/network/409 state/5xx/response sai chỉ GET lại, không tự gửi lại POST.
  Đọc lại lỗi giữ khóa ghi. Kết quả POST đã xác nhận vẫn được giữ nếu tải lại
  history lỗi, kể cả khi người dùng thử đọc lại nhiều lần.
- Rời route/đổi tài khoản hủy request và bỏ response cũ. Customer không có action
  ghi; Admin không có pickup/deliver; không thêm GPS/polling/late/inbox.

## Kiểm chứng

| Kiểm tra | Kết quả và giới hạn |
| --- | --- |
| `npm run test --workspace=@parcelflow/web` | 379/379 đạt, 29 file; test local/mock |
| `npm run lint:web` | Exit 0 |
| `npm run build:web` | Exit 0, gồm TypeScript; main JS 498.53 kB, trang chi tiết 5.78 kB; không cảnh báo chunk >500 kB |
| Browser local 375×812 và 1440×900 | Review/confirm, lịch sử, focus/cancel, Customer read-only và role guard đạt; không tràn ngang trang |
| Browser recovery | 409/503 chỉ đọc lại, đọc lỗi khóa ghi; 5 POST được intercept và trả mock, không gửi backend thật |
| Accessibility | Kiểm tra reduced motion, chữ 200%, label/error/focus; 0 runtime exceptions trong lượt browser cuối |

Đã xem ảnh giao diện mobile. Auth và toàn bộ API trong browser review đều được
mock riêng tại tab kiểm thử; app thật tiếp tục dùng Firebase/API client hiện có.
Không dùng kết quả này để xác nhận Cloud SQL, IAM hoặc transaction đã hoạt động.

## Phụ thuộc để nghiệm thu thật

1. Backend hoàn thiện tuần 3: API02 danh sách, API03 Detail/statusHistory,
   API04 Assign và quyền từng tài nguyên; Driver cần thấy đúng đơn được gán.
2. Backend tuần 4 cung cấp API05/06 cho Driver và API07 Fail theo FR07: chỉ
   PICKED_UP, lock/transaction, audit/notification nguyên tử, no-op giữ dữ liệu gốc.
3. Sau khi nhóm bàn giao revision và fixture được phép thao tác, kiểm tra
   Customer/Admin đọc cùng trạng thái, Admin Fail, race Deliver/Fail, quyền,
   mất response và đối chiếu SQL. Chưa thực hiện các ca đó trên môi trường thật.

Chạy lại lint/build/test bằng các lệnh trong bảng. Chưa đánh dấu tuần 4 toàn hệ
thống hoàn thành; chỉ xác nhận frontend đã qua các phép kiểm tra local nêu trên.
