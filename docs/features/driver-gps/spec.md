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
- [Contract hiện hành](../../contracts/gps-event-contract.md), shared type và OpenAPI xác định
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

## Bổ sung Driver nhận/giao — 08/11/2026

Nguồn chính thức là yêu cầu mới của người dùng: làm phần TV4 có thể làm của
danh sách đơn và nhận/giao, trên nhánh lấy từ develop. Phần này bổ sung phạm vi
lifecycle đã loại trừ trong lượt GPS trước; không thay yêu cầu GPS R1–R7.
Nhánh `feature/driver-shipments`, base `origin/develop@cbec8fb` sau fetch.
Repo không có `.specify/memory/constitution.md` hoặc skill Spec Kit đã cài;
không tạo constitution. Tiếp tục review artifact và kiểm chứng trong repo.

- D1: `/driver` tải danh sách qua GET `/v1/shipments` bằng client/Auth hiện có,
  phân trang cursor và lọc trạng thái; có loading, rỗng, lỗi và thử đọc lại.
  Server giới hạn đơn theo Driver; không gửi hoặc so sánh Firebase UID với
  `driverId` nghiệp vụ. Không dùng dữ liệu mẫu hoặc tự lọc một trang để giả scope.
- D2: chi tiết `/driver/shipments/:id` dùng GET Detail hiện có, hiển thị mã đơn,
  trạng thái, địa chỉ lấy/giao, người nhận/liên hệ, ghi chú và statusHistory.
  Không hiển thị snapshot cũ sau lỗi quyền hoặc đổi tài khoản/đơn.
- D3: theo OpenAPI API05/06: ASSIGNED mới được xác nhận đã lấy hàng (POST pickup,
  không body); PICKED_UP mới được xác nhận giao thành công (POST deliver, body
  chỉ có `proofOfDeliveryNotes` tùy chọn, tối đa 255 Unicode code point).
  Có bước xem lại/xác nhận, hủy, khóa khi gửi; không tự chuyển trạng thái.
  Adapter chỉ nhận HTTP 200 và ShipmentResponse đúng ID/trạng thái đích.
- D4: không tự retry POST. Sau thành công đọc lại Detail để lấy history. Khi
  timeout/network/409/5xx/response sai hoặc API chưa sẵn sàng, chỉ đọc lại;
  GET không chứng minh POST thành công. Nếu GET lỗi thì khóa thao tác và bỏ
  snapshot cũ, trừ response POST đã được xác nhận hợp lệ. Ý định/ghi chú cũ
  bị xóa trước một xác nhận mới. Rời trang/đổi phiên hủy request, bỏ kết quả muộn.
- D5: giữ GPS và role gate hiện hành; không sửa backend, schema, role, API
  contract, dependency hoặc triển khai. Backend pickup/deliver chưa có ở base;
  test frontend/mock không đóng nghiệm thu thực tế với TV1/TV5/TV6 hoặc W707.

## Bổ sung độ tin cậy emitter tuần 8 — 15/11/2026

Nguồn: yêu cầu người dùng hoàn thiện emitter; bảng tuần 8, ô E31 và mục GPS
emitter trang 3–4 của `giao-viec-tuan-8.pdf`, được chép vào
`docs/coordination/week-08.md`. Nhánh `feature/gps-emitter-reliability`, base
`develop@f28365d`. Tiếp tục bộ artifact này; máy không có `.specify/` hoặc skill
Spec Kit, không tạo constitution hay chạy script tạo feature. Script k6 và
nghiệm thu Cloud không nằm trong lượt triển khai emitter này.

Phần này thay giới hạn không queue/retry của mốc tuần 7 và quy tắc dừng khi
mẫu đo sai ở R4; giữ các hành vi R1–R3, R5–R7 và D1–D5 còn lại.

- E1: bỏ qua tọa độ sai, timestamp sai, mẫu mới lấy quá cũ, timestamp trùng/lùi
  và accuracy không hợp lệ/quá kém; không tăng seq hoặc gọi adapter. Hiển thị
  lý do tiếng Việt, tiếp tục đo ở tick sau. Lỗi quyền/timeout/unsupported vẫn dừng.
- E2: giữ mẫu hợp lệ trong buffer RAM của dashboard. Một request mỗi lúc, FIFO,
  chỉ bỏ mẫu sau 202 hợp lệ hoặc lỗi không thể retry. Retry giữ nguyên tọa độ,
  timestamp và seq; không tự thêm driverId/accuracy vào body.
- E3: offline giữ buffer; online thử gửi ngay. Network/timeout/429/5xx retry
  với backoff có giới hạn kể cả khi navigator vẫn báo online. Không retry lỗi
  dữ liệu/quyền/response sai; lỗi 401/403/USER_NOT_PROVISIONED xóa buffer và
  chặn gửi cho đến khi remount phiên. Đếm 202 hợp lệ riêng với mẫu chờ/bị bỏ.
- E4: buffer có giới hạn số lượng và thời gian; khi đầy bỏ mẫu chờ cũ nhất,
  không bỏ request đang gửi. Loại mẫu hết hạn trước enqueue/replay. Mẫu replay
  cũ hơn ngưỡng tracking vẫn giữ timestamp thật để Worker lưu history đúng.
- E5: Stop tạm dừng replay/timer và phát mẫu, giữ buffer cho Start trong cùng
  dashboard; request đã gửi được hoàn tất. Rời trang/đăng xuất/đổi tài khoản
  hủy request, xóa buffer/listener/timer và bỏ response muộn. Không lưu vào
  localStorage hoặc chuyển mẫu sang phiên mới.
  Adapter lấy token của mount tài khoản sở hữu buffer; token refresh cùng tài
  khoản không xóa buffer, không fallback sang token tài khoản toàn cục khác.
- E6: ghi rõ quyền vị trí, HTTPS/localhost, tab nền có thể bị throttle và không
  đảm bảo nhịp 8 giây. Không cam kết ghi SQL từ HTTP 202 hoặc test mock.

Làm rõ kỹ thuật trước implement: tài liệu không quy định con số cho accuracy,
tuổi mẫu emitter hoặc buffer. Chọn hằng số client dễ điều chỉnh: accuracy
0–100 m; mẫu mới lấy có tuổi tối đa 30 s, tương lai tối đa 60 s theo contract
clock skew; tối đa 100 mẫu gồm request đang gửi; giữ tối đa 5 phút theo timestamp
đo; backoff 1/2/4/8/16/30 s. Đây là chính sách client, không sửa NFR/API hay
ngưỡng stale server. Timestamp trùng/lùi so với mẫu đã phát trong mount bị bỏ.
