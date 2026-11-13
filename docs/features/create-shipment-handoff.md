# Tạo đơn hàng — kiểm chứng và bàn giao

> Báo cáo lịch sử theo ngày và source ghi bên dưới. Kết quả mock/local không xác nhận revision Cloud hiện tại; các script browser riêng không được phát hành cùng tài liệu.

Mốc kiểm tra ban đầu: 2026-10-24. Bản triển khai để test dựa trên `915e5ed` (đã tích hợp develop tại `a2c245f`). Ở mốc đó, phần triển khai chưa commit; chưa push, merge vào develop, chạy migration dùng chung, seed, thay đổi IAM hay deploy. Nguồn: PF SPEC 01 **nội dung v1.3**, đọc qua Drive vào ngày này; tên file vẫn ghi v1.2. Báo cáo này ghi nhận bằng chứng, không bổ sung yêu cầu.

## Mốc kiểm tra bổ sung — 2026-10-25

Các yêu cầu tiếp theo của người dùng đã cập nhật form/hộp thoại địa chỉ của Customer và
bản đồ nền raster nhẹ CARTO/OSM, độc lập với mốc ban đầu chỉ có backend.
Người dùng cho phép tạm gọi VIETMAP trực tiếp bằng key demo hiển thị trên trình duyệt;
xem `docs/contracts/api-contract.md` để biết ngoại lệ bảo mật đã được chấp thuận và hướng dùng proxy sau này.
Không commit giá trị key thật. Auth hiện có và AGENTS.md giữ nguyên.

Trước khi tách commit: typecheck/build API đạt; test API **259 đạt, 43 bỏ qua**
(chưa cấu hình PostgreSQL native và Firebase emulator cho lượt chạy này). Frontend
lint/build đạt và **293 test đạt**. Các lời gọi Search/Place/Reverse thật từ trình duyệt
đến VIETMAP và việc hiển thị raster CARTO đạt; test tranh chấp và bố cục thích ứng của UI dùng mock
Firebase và danh mục hành chính, không tạo đơn hàng thật.
Kết quả PostgreSQL native cũ bên dưới vẫn là bằng chứng lịch sử, không khẳng định
database dùng chung, route đơn hàng đã deploy hay luồng tạo đơn từ Firebase thật đến DB đã hoạt động.

## Phần đã bàn giao

- Module Shipment hiện có đã cung cấp POST `/v1/shipments` chỉ cho CUSTOMER, dùng các guard Firebase/nghiệp vụ hiện tại và pool pg của TV6. Không đổi phần triển khai auth hay mã frontend.
- Chuẩn hóa/kiểm tra trường nghiêm ngặt; từ chối trường lạ trong body/query; key UUIDv4; payload chuẩn hóa băm SHA256; đủ các key bắt buộc của SC02, gồm cả null và ánh xạ lưu trữ rõ ràng.
- Khóa dòng DB native giữa các kết nối xử lý tuần tự cùng chủ thể/thao tác/key. Gửi lại trả snapshot 201 gốc trước khi kiểm tra deadline tương lai; xung đột trả 409; TTL mặc định 86400s có thể cấu hình, key hết hạn được gia hạn an toàn khi đang giữ khóa.
- Transaction trên cùng client ghi đơn CREATED, lịch sử, thông báo Customer tối thiểu và snapshot idempotency. Không commit một phần hay tự thử tạo lại khi chưa rõ kết quả commit. Số lần thử lại khi trùng mã theo dõi duy nhất giới hạn ở 5.
- Chỉ có mốc SQL cho schema mới; các file Prisma và GPS giữ nguyên như tài liệu lịch sử, hướng dẫn đối chiếu nằm trong README database. Không có DDL tự chạy khi khởi động.
- OpenAPI và hợp đồng tạo đơn hiện tại đã đồng bộ, giữ các phần nháp lịch sử. Chỉ thêm dependency phát triển: ghim PGlite0.5.11, tám dòng lockfile; dependency production không đổi.

## Bằng chứng kiểm chứng

Các lệnh đã chạy từ `apps/api` sau khi cài sạch:

| Kiểm tra | Kết quả quan sát |
| --- | --- |
| `npm ci --workspaces=false --ignore-scripts --no-audit --no-fund` | Mã thoát 0, 328 package; có sẵn cảnh báo dependency gián tiếp bị ngừng khuyến nghị, không thử nâng phiên bản |
| `npm run typecheck` | Mã thoát 0, cấu hình TypeScript cho runtime và test |
| `npm test` với SHIPMENT_TEST_DATABASE_URL cô lập | **266 đạt, 15 bỏ qua, 20 file**, mã thoát 0 |
| `npm run build` | Mã thoát 0 |
| Riêng bộ test SQL Shipment, cả hai engine | **55 đạt, 1 bỏ qua**; 27 PGlite +28 native; chỉ ca khóa native được chủ động bỏ qua trên PGlite |
| Client tạo đơn frontend hiện có → HTTP Nest local thật → SQL | Tạo và gửi lại được chấp nhận mà không đổi adapter API; phần đọc token và Firebase dùng mock |
| `git diff --check` | Mã thoát 0, không lỗi khoảng trắng; cảnh báo thông tin LF→CRLF của Git |

Toàn bộ API có 15 ca bỏ qua: bảy ca Firebase emulator hiện có (emulator không chạy), bảy ca Admin PostgreSQL native hiện có (chưa cấu hình URL database riêng của TV6), một ca quan sát khóa chủ động không chạy trên PGlite. 28 ca tạo đơn native **đã chạy**, không bị bỏ qua. Các test này không khẳng định Firebase/Cloud SQL đã hoạt động.

Engine native: `@embedded-postgres/windows-x64@18.4.0-beta.17`, binary báo PostgreSQL18.4. Được tải vào thư mục tạm của hệ điều hành dành riêng cho tác vụ, không thêm vào dependency dự án; khởi tạo cluster mới chỉ lắng nghe tại `127.0.0.1:55439`, database `parcelflow_shipments_test`. Bộ test chỉ tạo/xóa schema ngẫu nhiên của nó, dùng pool sáu kết nối. Một điểm chặn giữ transaction 1 trong khi transaction 2 chờ; đã quan sát `pg_stat_activity.wait_event_type='Lock'` và ít nhất hai kết nối pool trước khi nhả. Sau khi nhả, cả hai request trả 201/cùng snapshot và đúng một bộ gồm bốn dòng. PostgreSQL tạm được dừng bằng pg_ctl sau khi xác minh PID/đường dẫn thuộc tác vụ. Không dừng hay sửa DB/dịch vụ nào khác.

Kiểm tra frontend từ `apps/web`: `npm test` **223 đạt/20 file**, `npm run lint` mã thoát 0, `npm run build` mã thoát 0. Cảnh báo chunk JS 640.74kB>500kB có sẵn vẫn còn; không thử tách chunk/đổi UX ngoài phạm vi. Không chạy phiên trình duyệt/Firebase tương tác trong tác vụ backend này.

## Truy vết đến tiêu chí nghiệm thu chính thức

| Nguồn | Bằng chứng và giới hạn |
| --- | --- |
| TC01.1 | HTTP201 đúng SC02 và đối chiếu key bắt buộc trong OpenAPI; SQL kiểm tra đơn/sự kiện/thông báo/key, chủ thể đáng tin cậy, ánh xạ, giá trị nullable tường minh, lưu trường tùy chọn |
| TC01.2 | Sáu request đồng thời cùng key, snapshot bằng nhau khi so sánh sâu và đúng một bộ dữ liệu; quan sát được chờ khóa dòng native, hai payload khác nhau cạnh tranh trả một 201/một 409 |
| TC01.3 | Payload chuẩn hóa thay đổi trả 409 IDEMPOTENCY_KEY_CONFLICT, không ghi dữ liệu; gửi lại tương đương sau đổi thứ tự key/trim/null/offset trả 201 |
| TC01.4 |27 ca chuẩn hóa DTO/key, các ca HTTP về key/trường/query/deadline và từ chối danh tính; không có dòng nào được commit |
| TC01.5 | Giả lập lỗi sự kiện/thông báo/snapshot và một vi phạm CHECK thông báo thật; bốn lần ghi rollback, thử lại cùng key phục hồi; ca chưa rõ phản hồi COMMIT lưu một bộ dữ liệu và thử lại trả snapshot |
| TC01.6 phần API01 | Fixture đổi trạng thái đã lưu thành ASSIGNED; đồng hồ repository tiến qua deadline gốc nhưng vẫn trong TTL; gửi lại vẫn trả CREATED201, key mới với deadline đã qua trả 400. SQL chứng minh trạng thái hiện tại vẫn là ASSIGNED. **Không khẳng định phần GET chi tiết: API03 vẫn chưa có và nằm ngoài phạm vi tạo đơn.** |

## Phần còn mở ngoài bản triển khai trên nhánh test này

1. **TV1 + TV6** kiểm tra schema và dữ liệu users/shipments dùng chung thực tế, đối chiếu Prisma/bản nháp và phụ trách kế hoạch migration/cấp phát tại chỗ không phá hủy dữ liệu. Không áp dụng mốc dành cho schema rỗng lên database dùng chung hiện có. ID nghiệp vụ UUID hiện tại không tương thích với usr_ULID và không được âm thầm đổi nhãn.
2. **TV5/người phụ trách backend** review, chỉ deploy nhánh khi được yêu cầu, cấu hình DATABASE_URL/Firebase/CORS và TTL cho runtime hiện tại; test liên kết UID Customer và việc ghi thật trên môi trường được duyệt. Chỉ deploy Hosting không thể đưa mã backend này ra sử dụng.
3. **TV1** triển khai API02/03 và API04 riêng; chúng vẫn là khung rỗng. Form có thể POST đến bản triển khai local đã cấu hình sau khi thiết lập đúng DB/Auth, nhưng điều hướng đến chi tiết/danh sách đơn vẫn có thể lỗi cho đến khi có API đọc.
4. **TV3 + TV1 + TV6** thực hiện luồng tạo đơn/thử lại đầu-cuối với Firebase/trình duyệt/Cloud SQL thật và nghiệm thu phần chi tiết TC01.6 sau tích hợp; NF03 p95<500ms phải được đo theo tải đã thống nhất, không suy ra từ thời gian chạy test đơn vị/HTTP.

Hướng dẫn chạy lại: [quickstart.md](create-shipment.md). Công cụ hỗ trợ DB native không phải dịch vụ production hay dependency mới lâu dài của dự án; tự cung cấp URL DB loopback cô lập khi chạy lại test native.
