# Tuần 10 (23/11–29/11)

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: FALSE. Checkpoint nhóm: ETA hoạt động cùng tracking.

## Việc của TV6 theo sheet

QA tính năng ETA, test phân quyền chéo (ranh giới customer/driver/dispatcher/admin).

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W10-TV6-01a | Kiểm ETA cơ bản: đơn vị mét/giây, kết quả hợp lý theo hai điểm | W10-TV2-02 | Kết quả TC09.1 | AC09 | Chưa bắt đầu |
| W10-TV6-01b | Hai điểm giống nhau cho ETA 0; thiếu GPS hoặc GPS cũ cho `null` kèm lý do | W10-TV6-01a | Kết quả TC09.2–09.3 | AC09 | Chưa bắt đầu |
| W10-TV6-01c | Biên tuổi mẫu 0 và 30 giây; chỉ PICKED_UP có ETA; ETA không đổi `expectedDeliveryAt`; không NaN hay Infinity | W10-TV6-01a | Kết quả TC09.4 | AC09 | Chưa bắt đầu |
| W10-TV6-02a | Lập ma trận role × API × quan hệ (chủ đơn, driver được gán) | Toàn bộ API | Bảng ma trận | FR10, AC10, NF09 | Chưa bắt đầu; nền là bảng quyền trong FRD |
| W10-TV6-02b | Thử đoán ID, giả actor trong body, Customer khác, Driver sau reassign | W10-TV6-02a | Kết quả TC10.1–10.3 | AC10, NF09 | Chưa bắt đầu |
| W10-TV6-02c | Token thiếu, hỏng, hết hạn cho 401; sai role cho 403; health vẫn public | Auth tuần 5 | Kết quả theo từng API | AC10 | Test mock đã có, chưa chạy trên Cloud |

## Đã làm được

- Auth đã có test 401/403 ở mức mock và Emulator (tuần 5).
- Bảng quyền và mã TC09, TC10 đã nằm trong ma trận QA.

## Còn thiếu và rủi ro

- ETA phụ thuộc Haversine của TV2 và UI của TV3.
- Ma trận quyền chéo cần đầy đủ API; các API vòng đời chưa có thì ghi BLOCKED.
