# Bàn giao Driver dashboard và gửi GPS thử

Phạm vi: TV4 tuần 6 lịch nhóm (26/10–01/11/2026), tương ứng VII.4/tuần 3
lộ trình sản phẩm. Branch `feature/driver-dashboard-gps`, base develop `8038c83`.
Yêu cầu và tasks: mục 11 của [đặc tả Driver](../openspec/driver-gps-emitter-draft.md).

## Hành vi

- Login/role gate và đăng xuất tái sử dụng phần Auth có sẵn. `/driver` chỉ dành
  cho DRIVER; danh tính hiển thị từ phiên, không dùng `demo-driver-1`.
- Dashboard có khung đơn được phân công, ghi rõ chưa kết nối danh sách đơn.
- Start tạo tọa độ mô phỏng đầu tiên sau 8 giây, gửi mỗi 8 giây qua API client
  chung. Body có `lat/lng/clientTimestamp/seq`, không có `driverId` hoặc role.
  Backend phải lấy driver từ Bearer token, enrich và publish theo contract.
- Chỉ đếm thành công với HTTP 202 và JSON `{status:"ACCEPTED",eventId,receivedAt}`
  đúng schema. Hiển thị mã sự kiện/thời điểm gần nhất. Không tuyên bố đã lưu SQL.
- Một request mỗi lúc, timeout 7 giây; không retry hoặc lưu queue tự động.
  Mẫu tới khi request còn chờ được bỏ qua và có thông báo số lượng.
- Stop ngừng tạo mẫu mới, không hủy yêu cầu đã gửi. Restart tiếp tục sequence.
  Rời trang/hết phiên/đổi tài khoản hủy request và timer; không hiển thị kết quả cũ.
- Emitter dùng độc lập không có callback vẫn chỉ hiển thị payload mẫu.

## Kiểm chứng local ngày 24/10/2026

| Kiểm tra | Kết quả | Mức bằng chứng |
| --- | --- | --- |
| Test Driver + adapter + emitter | 43/43 đạt, 3 file | jsdom, fetch/API mock, fake timers, StrictMode |
| Toàn bộ test frontend | 219/219 đạt, 20 file | Local; không phải Firebase/Pub/Sub thật |
| `npm run lint:web` | Exit 0 | Local ESLint |
| `npm run build:web` | Exit 0 | TypeScript + Vite production build |
| `git diff --check` | Exit 0 | Whitespace của diff |

Test mới kiểm tra Bearer token và URL `/v1/locations`, body, HTTP status/response,
invalid payload, timeout/cancel; Driver route và phiên, timer/Stop/restart,
request không chồng lấn, lỗi API, unmount và thay tài khoản.
Build có cảnh báo chunk JS lớn hơn 500 kB; build vẫn đạt. Lần test sandbox ban đầu
bị `spawn EPERM`, chạy lại bằng quyền cho phép tạo process thì đạt.

Chạy lại từ gốc repo:

```powershell
npm run test --workspace=@parcelflow/web -- src/api/endpoints/locations.spec.ts src/features/driver/DriverPlaceholderPage.spec.tsx src/features/driver/GpsEmitter.spec.tsx
npm run test --workspace=@parcelflow/web
npm run lint:web
npm run build:web
```

## Tích hợp và nghiệm thu thật còn mở

Chưa kiểm tra trực quan trong trình duyệt, đăng nhập Firebase thật hoặc pipeline
Driver → API → Pub/Sub cloud trong lượt này. Trong checkout, controller/service
GPS của API còn trống; mock không chứng minh endpoint đó hoạt động.
Review contract độc lập G206 vẫn chờ người phụ trách. Chưa deploy. Người dùng đã
cho phép commit/push nhánh tính năng và mở Draft PR vào develop; chưa cho phép merge.

1. TV2 cung cấp `POST /v1/locations`, xác thực DRIVER, validation, enrich và trả
   202 sau broker-confirmed publish; response theo `AsyncAcceptedResponse` trong
   `docs/openapi.json`. Không cần Worker/SQL để kiểm tra riêng mốc publish này.
2. TV6 chuẩn bị tài khoản Firebase có claim DRIVER và business identity đúng;
   TV5 cấu hình API URL/CORS/credentials backend. Không đưa Google credentials
   vào frontend. `VITE_API_URL` là base có `/v1`; giữ cấu hình Firebase hiện có.
3. Chạy `npm run dev:web`, đăng nhập rồi vào `/driver`. Kiểm tra giao diện ở màn
   hình hẹp, nội dung tài khoản, tab/keyboard và đăng xuất. Chưa bấm Start thì
   không có request GPS.
4. Mở Network, bấm Start. Sau 8 giây kiểm tra POST đúng URL/body, có Bearer token
   (không lưu token trong ảnh/báo cáo), HTTP 202 và JSON hợp lệ; UI tăng đúng một.
   Không chấp nhận chỉ thấy JSON trên trang làm bằng chứng đã publish.
5. Phối hợp TV5 chuẩn bị kênh quan sát test riêng trước khi gửi, đối chiếu eventId
   từ response với message GPS trên Pub/Sub. Không pull/ACK subscription nghiệp
   vụ để lấy ảnh vì có thể lấy mất message của Worker. Lưu thời điểm, môi trường,
   eventId và kết quả thật, không dùng ảnh Hello World cũ thay cho lượt này.
6. Stop rồi chờ hơn 8 giây: không có mẫu mới; Restart tiếp tục sequence. Rời route
   thì không gửi tiếp. Thử sai role, mất mạng và API không sẵn sàng; UI báo lỗi,
   không tăng số chấp nhận. `202` chưa chứng minh Worker đã ghi SQL.

W605 còn mở đến khi có bằng chứng này. Không đánh dấu toàn bộ tuần 6 hoàn tất
chỉ dựa vào kết quả local.
