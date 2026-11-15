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

## Bổ sung frontend tuần lịch 7 — 09/11/2026

Nền tích hợp `e0c8a09`, nhánh `feature/frontend`; giữ các sửa UI Admin đang có.
Phần Customer/Admin được bổ sung và kiểm tra local; chưa commit/push/deploy.

- History Customer đã bỏ dữ liệu mẫu, dùng API02 theo trạng thái DELIVERED hoặc
  DELIVERY_FAILED, tìm mã chính xác, phân trang cursor và mở Detail API03.
- Tái dùng list/theme hiện có, giữ keyboard, error/retry/abort/stale guard và
  xóa dữ liệu khi đổi tài khoản. updatedAt ghi là cập nhật, không suy thời điểm giao.
- Xác minh Admin và Customer đọc cùng history sau pickup/deliver. Admin không
  có nút lấy/giao của Driver; quyền và các thao tác hiện hành được giữ nguyên.
- Sửa Vite dev xử lý linked CommonJS `@parcelflow/types` bằng optimizeDeps.include.
  Browser trước sửa trắng trang với lỗi thiếu named export GPS; sau sửa mount
  được app. Không đổi package dùng chung, backend, API hoặc dependency.

| Kiểm tra vừa chạy | Kết quả và giới hạn |
| --- | --- |
| History và Orders unit/UI | 29/29 đạt; API fixture |
| Toàn bộ frontend | 520/520 đạt, 38 file; jsdom/API fixture |
| UI → Nest HTTP → SQL PGlite | 11/11 đạt; gồm tạo → phân công → Driver lấy/giao → Customer history/detail → Admin detail, Customer khác bị chặn |
| Lint và build frontend | Exit 0; build gồm TypeScript, còn cảnh báo main chunk 512.19 kB, không tăng ngưỡng để che cảnh báo |
| Edge headless 390/768/1440, dark/light | 6/6 bố cục không tràn ngang trang; đã xem ảnh mobile tối và desktop sáng |
| Browser tương tác | 7 ca đạt: Tab, Enter tìm kiếm, đổi trạng thái, rỗng, 503, tải chậm/thử lại, reduced motion; 0 runtime exception |

Browser dùng profile riêng, Auth/API intercept và chặn request ngoài origin thử;
không có chế độ đăng nhập giả trong ứng dụng thật. Screenshot/báo cáo browser
và log test ở thư mục TEMP của máy kiểm tra; không chứa tài khoản thật/token.
Lệnh test ở gốc: `npm.cmd run test --workspace=@parcelflow/web`,
`npm.cmd run test:integration --workspace=@parcelflow/web`, `npm.cmd run lint:web`
và `npm.cmd run build:web`.

Phần nghiệm thu Cloud vẫn mở: cần đúng revision API/Hosting và tài khoản ba role
có linkage để chạy lại luồng thật, đối chiếu dữ liệu SQL. Test local không đóng
gate Cloud. API07 Fail vẫn thuộc phụ thuộc backend của phần vòng đời trước,
không được triển khai thêm trong lượt hoàn thiện frontend tuần 7.

Rà soát Spec Kit cuối: phần code local lịch sử/trạng thái không còn thiếu sót
trong phạm vi đã chốt; gate môi trường thật vẫn mở, không đánh dấu hoàn tất
tuần 7 toàn hệ thống. AGENTS.md, cấu hình môi trường và các sửa UI Admin có
trước được giữ nguyên. Cấu hình linked CommonJS theo [hướng dẫn Vite](https://vite.dev/guide/dep-pre-bundling.html#monorepos-and-linked-dependencies).

## Tái nghiệm thu tuần 7 — 10/11/2026

Đã chạy request thật tới backend Cloud Run bằng ba tài khoản demo có sẵn,
không tạo tài khoản hoặc sửa quyền. Đây là kiểm thử HTTP có Firebase thật;
không phải thao tác UI trên Hosting hoặc truy vấn SQL trực tiếp. Chưa xác nhận
SHA/revision của backend Cloud. Nền local vẫn là `e0c8a09` cộng các sửa frontend.

| Ca | Quan sát |
| --- | --- |
| Health, Auth | `/healthz/` 200; Firebase đăng nhập và `/v1/auth/me` 200, đúng CUSTOMER/ADMIN/DRIVER |
| Create | Customer POST `/v1/shipments` 201; đơn thử `PF20261109KYCJ3R`, ID `sh_01M70MA9T85GR25ESQD1P0NP8D` |
| Assign | Admin POST assign 200; Driver business ID lấy từ các đơn thuộc chính phiên Driver, không dùng UID Firebase hoặc đoán mapping |
| Pickup/deliver | Driver được phân công POST pickup 200, POST deliver 200; đơn đạt DELIVERED |
| Trạng thái/lịch sử | Admin đọc PICKED_UP trước giao; Customer và Admin đọc DELIVERED sau giao, đủ CREATED → ASSIGNED → PICKED_UP → DELIVERED; lịch sử Customer lọc đúng mã trả lại đơn thử |
| CORS Hosting | OPTIONS Create/Pickup/Deliver/Locations đều 204, cho đúng origin Hosting và Authorization/Content-Type/Idempotency-Key |
| GPS Cloud | POST `/v1/locations` bằng Driver hợp lệ trả 503 SERVICE_UNAVAILABLE lúc khoảng 00:07:44 ICT; chưa có broker-confirmed 202, chưa nghiệm thu được Pub/Sub → Worker → SQL |
| Hosting | Đang phục vụ `index-CCoMdCpR.js`, khác build local `index-QyoPzraa.js`; chưa triển khai frontend mới |
| Kiểm tra local chạy lại | Frontend 520/520; API 446 đạt, 99 skip; Worker/shared 122/122; UI → Nest → PGlite 11/11; Worker SQL/ACK/rollback/Admin đọc qua PGlite 4/4 |

Đơn thử có ghi chú nghiệm thu, không giao nhận thực tế; được giữ ở DELIVERED
để nhóm tra lại trên UI. Một mẫu GPS mô phỏng đã gửi nhưng nhận 503; không tự
gửi lại khi chưa rõ kết quả. Không pull subscription nghiệp vụ hoặc đổi IAM,
topic, tài khoản, database hay triển khai dịch vụ trong lượt này.

Chưa đạt checkpoint tuần 7 toàn nhóm. TV2/TV5 cần xem log Cloud Run của request
GPS để xác định dependency lỗi; code local dùng LocationService publish Pub/Sub,
nhưng response 503 chưa đủ kết luận nguyên nhân cụ thể. Máy kiểm tra không có
gcloud/ADC và Docker daemon chưa chạy nên không truy cập được log/SQL Cloud hoặc
chạy lại broker emulator. TV3/TV5 cần triển khai frontend đã kiểm tra rồi TV4/TV6
nghiệm thu Start/Stop và luồng UI trên Hosting. Không đóng gate bằng kết quả local.

Bằng chứng HTTP không chứa token/mật khẩu được giữ trong TEMP:
`parcelflow-week7-cloud-20261110.json`, `parcelflow-week7-gps-cloud-20261110.json`;
log local theo tên `parcelflow-w7-20261110-*.log`. Các hướng dẫn chạy lại phía trên
giữ nguyên. Không commit/push; AGENTS.md và cấu hình môi trường không đổi.

## Tích hợp frontend sau cập nhật develop — 12/11/2026

Theo xác nhận người dùng, frontend được đưa vào `develop` khi build/test local
đạt; nghiệm thu Cloud thực hiện sau đợt deploy chung của TV5. Không coi merge
frontend là đã hoàn thành checkpoint tuần 7 của toàn nhóm.

Nền tích hợp mới: `7430a5f`. Code frontend tại commit `a404730` gồm lịch sử
Customer từ API, workspace/phân công/biểu đồ Admin, dark/light và sửa Vite dev.
Giữ các thay đổi có sẵn; không đổi nghiệp vụ backend, Driver hoặc contract.

| Kiểm tra ngày 12/11 | Kết quả |
| --- | --- |
| Frontend unit/UI | 520/520 đạt, 38 file |
| Lint, TypeScript và Vite build | Exit 0; main chunk 512.19 kB còn cảnh báo, không tăng ngưỡng để che |
| UI → Nest HTTP → SQL PGlite | 11/11 đạt; test chờ GET history sau POST thay vì kiểm quá sớm; giữ nguyên timeout và nghiệp vụ |
| API sau nhận QA từ develop | 446 đạt, 104 skip theo điều kiện PostgreSQL/emulator; 31 file, không có ca lỗi ở lượt cuối |
| Typecheck API và root; build Worker | Exit 0 |

Một số lượt test đầu bị timeout khởi tạo hoặc kiểm lịch sử trước khi GET hoàn
tất. Fixture Node độc lập khởi tạo được trong khoảng 4,5 giây; lượt integration
cuối đạt sau khi sửa điều kiện chờ trong test. Chạy Node hiện tại với
`NODE_OPTIONS=--no-experimental-webstorage` như hướng dẫn runtime trước đó.

Thăm dò Cloud khoảng 00:34:26–00:34:35 ICT ngày 12/11: health 200, cả ba role
đăng nhập và đọc `/v1/auth/me` 200. Tuy nhiên Driver GET `/v1/shipments?limit=20`
và Admin GET `/v1/drivers?limit=100` đều 503 SERVICE_UNAVAILABLE. Lượt này dừng
trước khi tạo đơn, phân công hoặc gửi GPS vì không đọc được mapping Driver.
Không suy kết quả thành công ngày 10/11 là kết quả của bản Cloud hiện tại.

Trace để TV1/TV2/TV5 đối chiếu: đọc đơn Driver
`d459a54d724f18c09c68ccb8000e8e4d`; đọc directory
`af8f32a937375ffd71840170fe84ab16`. Chưa có quyền đọc log/runtime/SQL Cloud
trong môi trường kiểm tra; chưa kết luận nguyên nhân 503 là schema hay quyền.

Sau merge, TV5 dùng cùng bản nguồn để triển khai theo kế hoạch nhóm, kiểm
DDL GPS, thống nhất runtime với quyết định D03 và chạy lại UI cùng GPS → Worker → SQL.
Các mục Cloud tiếp tục mở. Cấu hình môi trường cá nhân và Spec Kit giữ local;
không triển khai dịch vụ hoặc thay IAM/database trong lượt tích hợp này.
