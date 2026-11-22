# TV3 tuần 9 — kiểm tra tracking local

Ngày 18/11/2026; base `feature/frontend@aca0320`, các thay đổi tuần 9 chưa
commit. Nguồn: PF SPEC 01 v1.4, TV3 tuần 9, NF04/LT04. Không deploy; không
đổi API/backend/Worker/SQL, IAM hoặc secret.

## Kết quả đã chạy

| Kiểm tra | Môi trường / kết quả |
| --- | --- |
| `npm run check` | Exit 0: 177 Worker/shared/load, 2 health, 465 API, 592 web; 125 test cần PostgreSQL/Firebase emulator bị bỏ qua |
| Sampler tracking | 11 test: workload, fixture/quyền/hạn token, p95 raw, lỗi/timeout/dropped và HTTP loopback |
| Polling UI | Hai test với 500 hook độc lập, chu kỳ 5s/10s; chờ request 30s không gửi chồng, unmount hủy request/timer |
| HTTP smoke | 5/5 kịch bản Nest + PGlite trong RAM, Firebase mock; fresh 5s/10s, stale, missing và ownership 403 |
| Browser | Chrome headless, Customer/Admin × 390/1440px, Leaflet/CARTO thật; Auth/HTTP fixture qua CDP |

Số đo từ [raw report](smoke.json), cửa sổ đo 2s sau warm-up 1s; 10 logical
poller, timeout 5s. Request rate 2/s ở chu kỳ 5s và 1/s ở chu kỳ 10s.
Chỉ 2–4 mẫu mỗi kịch bản, **không kết luận NF04 hoặc LT04 Cloud**.

| Kịch bản | Thành công / bắt đầu | p95 HTTP hoàn tất (ms) | Dropped |
| --- | --- | --- | --- |
| Fresh / 5s | 4/4 | 11.327 | 0 |
| Fresh / 10s | 2/2 | 11.546 | 0 |
| Stale / 5s | 4/4 | 13.012 | 0 |
| Missing / 5s | 4/4 | 9.790 | 0 |
| Customer khác | 0/1; HTTP 403, dừng đúng thiết kế | 3.949 (phản hồi lỗi) | 0 |

Lượt 403 cố ý thất bại workload, không tính là đạt latency nghiệp vụ. Raw
report giữ expected/started/completed, lỗi, timeout, slot bỏ lỡ và latency từng
mẫu; không có token hoặc response body. SHA-256 sampler ở `smoke.json`.

## Browser và UI

[Kết quả 4 lượt](browser.json): phản hồi chậm 6s hiện “Đang cập nhật…”,
`aria-busy=true`, khóa nút tải lại và không tạo request chồng. Chuyển stale →
missing giữ hai điểm giao nhận, bỏ marker tài xế; 503 giữ nền map và thử lại
được. GPS không tải lại detail; đổi trạng thái cập nhật detail/lịch sử, kết
thúc giao hàng dừng polling. Không tràn ngang, không có runtime exception.

| Ảnh | Chậm | Thiếu GPS |
| --- | --- | --- |
| Customer 390px | [Ảnh](customer-390-slow.webp) | [Ảnh](customer-390-missing.webp) |
| Customer 1440px | [Ảnh](customer-1440-slow.webp) | [Ảnh](customer-1440-missing.webp) |
| Admin 390px | [Ảnh](admin-390-slow.webp) | [Ảnh](admin-390-missing.webp) |
| Admin 1440px | [Ảnh](admin-1440-slow.webp) | [Ảnh](admin-1440-missing.webp) |

Đã mở ảnh đối chiếu mobile/desktop. Không dùng phiên đăng nhập Cloud thật
hoặc thay đổi đơn đang vận hành trong lượt browser này.

## Còn mở và chạy lại

LT04 đầy đủ chưa chạy: 500 poller, 5s và 10s riêng, mỗi lượt 10 phút; chưa
kiểm stale/null trong tải Cloud và chưa có resource/config/revision của lượt
đo để TV6 kết luận NFR. Chờ nhóm deploy và thống nhất cửa sổ đo với TV4/TV5.
Kiểm 500 hook không thay thế tải HTTP hoặc 500 browser.

Build còn cảnh báo bundle chính 516.66kB; không tăng ngưỡng hoặc refactor
ngoài phạm vi. Các test môi trường bị bỏ qua cần chạy khi đủ cấu hình.

Lệnh chạy lại, fixture và cách đọc kết quả:
[tracking-read-load](../../features/tracking-read-load.md). Smoke tự đóng
Nest/PGlite; Chrome headless/Vite kiểm thử được dừng sau khi chụp bằng chứng.
