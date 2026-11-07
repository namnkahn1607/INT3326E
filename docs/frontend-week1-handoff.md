# Kết quả tái nghiệm thu tuần 1 — TV3 và phối hợp frontend

> B?o c?o l?ch s? theo ng?y v? source ghi b?n d??i. K?t qu? mock/local kh?ng x?c nh?n revision Cloud hi?n t?i; c?c script browser ri?ng kh?ng ???c ph?t h?nh c?ng t?i li?u.

**Ngày kiểm tra**: 2026-10-18, Asia/Saigon.
**Nguồn yêu cầu**: [PF SPEC 01, nội dung v1.3 ngày 11/10/2026](https://docs.google.com/document/d/1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8/edit),
đặc biệt VII.2; [chỉ dẫn nguồn](spec-baseline.md).
**Scope**: Công việc TV3 tuần 1, emitter mẫu phối hợp TV4 và đối chiếu checkpoint chung chỉ đọc.

## 1. Kết luận

**ĐẠT phần frontend TV3 tuần 1 theo đặc tả mới**: một React/Vite/TypeScript app,
ba cổng role dạng stub và bản Firebase Hosting truy cập được. Emitter đã gắn vào Driver,
Start/Stop/Restart/cleanup đạt trên trình duyệt. Không yêu cầu nối GPS tới Admin/backend,
đăng nhập thật, Create persistence hoặc tracking nghiệp vụ để đạt tuần 1.

Checkpoint chung đã được nhóm chốt tại [#10](https://github.com/namnkahn1607/INT3326E/issues/10),
source `da5e7cdae3618dcfc4d200a9470f728d09338df5`; lần này đọc lại health cloud đúng JSON.
Resource/budget/Hello World dùng lại evidence tại #8/#9, không yêu cầu nộp/chạy lại.
Không kết luận toàn bộ sản phẩm đã hoàn thành hoặc nghiệp vụ tuần 2 đã chạy.

## 2. Snapshot và nguồn bằng chứng

| Thuộc tính | Giá trị đã đối chiếu |
| --- | --- |
| Workspace được test | `feature/frontend`, HEAD `360a24bdfbaa7286cd49f6f7736b7c90daef29ef` |
| Trạng thái khi bắt đầu | Git sạch, không staged/unstaged changes |
| Runtime kiểm tra | Node 24.21.0; TS 6.0.3 root/FE, TS 5.7.3 API |
| Source S4 của đặc tả/checkpoint | `da5e7cd`, khác local; không tự chuyển nhánh/merge |
| Remote-tracking develop đã có trong máy | `d38c598`, local develop cũ hơn 14 commit; đây không phải live fetch lần này |
| Hosting | `https://int3326e.web.app` |
| Bundle kiểm tra | `/assets/index-CCoMdCpR.js`, bytes khớp local build |
| SHA256 bundle | `09d0183d58c4ffa0b3ce42e951ac4f68c64909de76c76df6d8807fb188b4b3cd` |
| Cloud source/revision metadata hiện tại | Chưa đọc trực tiếp; không suy ra source SHA từ health 200 hoặc hash FE |

Nguồn Google Doc đã đọc đủ bảy tab để phân biệt yêu cầu toàn dự án và mốc tuần 1.
Revision nguồn được ghi trong [t?i li?u chung](README.md); tên file v1.2 không thay phiên bản nội dung 1.3.
Không sửa Google Doc, repo remote hoặc resource cloud trong lượt nghiệm thu.

## 3. Ma trận yêu cầu audit

| Mã | Nguồn | Actual/evidence | Kết luận |
| --- | --- | --- | --- |
| FR-001 | PF SPEC 01 I/VII.2 | Source/version/ưu tiên được ghi ở docs/spec-baseline.md; không dùng báo cáo AI làm yêu cầu | PASS |
| FR-002 | VII.2, VI.UI01–03 | Một `apps/web`, App.tsx có ba cổng; context/shared/Prisma giữ ba role, Admin gồm điều phối | PASS |
| FR-003 | VII.2, Constitution V | Hosting GET 7 route trả 200 cùng index; bundle khớp local; browser ba cổng direct/refresh đạt | PASS |
| FR-004 | VII.2, Driver stub đã có | Hai mẫu 8 giây, timestamp mới; Start/Stop/Restart/unmount/remount đạt; không GPS request/quyền vị trí | PASS |
| FR-005 | VII.2, phạm vi audit | Không sửa apps/, package/lockfile/config runtime, constitution; không Auth/Create/migration/deploy mới | PASS |
| FR-006 | Constitution V | Ba cổng tại 1280x900 và 390x844 không tràn ngang; main font 16px; Tab focus được, Enter bật emitter | PASS trong matrix đã chạy |
| FR-007 | I.7, VII.2 | Local API/Worker và public cloud health tách riêng; evidence #8/#9/#10 có nguồn/ngày; giới hạn tại mục 6 | PASS hồ sơ, không chứng minh dependency/business |
| FR-008 | VI.API08, VII.3 | Frontend docs/path/scope được đồng bộ; emitter draft dùng /v1/locations; readiness tuần 2 ở mục 7 | PASS |

SC-001 đạt ba cổng direct/refresh; SC-002 đạt emitter mẫu; SC-003 có evidence/giới hạn cho
8/8 FR; SC-004 các chỉ dẫn frontend đang áp dụng đã tách mốc nghiệp vụ khỏi tuần 1;
SC-005 có danh sách phụ thuộc nhưng chưa thực thi tuần 2.

## 4. Kiểm tra đã thực thi lại ngày 18/10

| Lệnh / phép thử | Actual | Kết quả |
| --- | --- | --- |
| Root `npm run lint:web` | ESLint hoàn tất không lỗi | PASS |
| Root `npm run build:web` | TypeScript + Vite 8.3.2, 158 modules; JS 467.66 kB, CSS 61.28 kB | PASS |
| Root `npm run typecheck` | Worker/config và production build config typecheck | PASS |
| Root `npm run build` | Nest build Worker | PASS |
| Root `npm test` | Worker 1 test/1 file | PASS |
| Root `npm run test:e2e` | Worker 1 test/1 file | PASS |
| `apps/api`: `npm run typecheck` | Source + test typecheck với compiler package | PASS |
| `apps/api`: `npm test` | 63 tests/8 files, test Auth dùng mock | PASS |
| `apps/api`: `npm run build` | TypeScript build riêng API | PASS |
| `node specs/week1-reacceptance/verify-browser.mjs` | HTTP/hash/browser/emitter matrix bên dưới | PASS sau sửa mô phỏng focus/Enter của test harness |

Tổng regression API/Worker: **65 test đạt**. Không chạy lại clean install trong lượt này:
cài sạch đã được ghi ở #10; source không đổi dependency/lockfile. Lệnh tái hiện theo
[quickstart.md](frontend-guide.md), không giả là mọi phiên bản trên develop mới đều đã được test.

### Browser/Hosting

- GET `/customer`, `/admin`, `/driver`, `/customer/create`, `/admin/assignment`,
  `/admin/accounts`, `/admin/live-map`: HTTP 200; index trùng local build.
- Ba cổng chính: mở trực tiếp + reload qua browser; desktop/mobile không tràn ngang,
  nội dung chính có tiêu đề, font kế thừa 16px; Tab tới control/link được.
- Driver: trạng thái 0/dừng, Enter bắt đầu một timer; bấm lại không nhân timer;
  hai mẫu liên tiếp có tọa độ demo và timestamp khác nhau; Stop giữ nguyên sau hơn 8 giây;
  Restart tiếp tục đếm; chuyển Customer trong SPA xóa timer; quay lại Driver reset về 0/dừng.
- Không có JavaScript exception, request `/v1/locations` hoặc lời gọi geolocation trong test.
- Kiểm tra bàn phím ban đầu của harness thiếu focus/text cho Enter; đã chỉnh harness,
  chạy lại toàn bộ matrix đạt. Không thay code ứng dụng để làm test qua.

### Local liveness

| URL | HTTP/body thực tế |
| --- | --- |
| `http://127.0.0.1:18081/healthz` | 200 `{"status":"ok","service":"api"}` |
| `http://127.0.0.1:18081/healthz/` | 200 cùng payload API |
| `http://127.0.0.1:18080/healthz` | 200 `{"status":"ok"}` |

Chạy Worker bằng env mẫu trỏ emulator local, API bằng project mẫu và PORT tạm.
Worker có cảnh báo metadata/emulator; không coi đó là kết quả consume GPS. Không sửa `.env` cá nhân.
Các tiến trình smoke/browser tạm được dừng sau kiểm tra.

## 5. Cloud và evidence dùng lại

Quan sát public GET ngày 18/10/2026 khoảng 03:40 +07, không dùng token đăng nhập:

| URL | HTTP/body | Kết luận |
| --- | --- | --- |
| `https://backend-service-wcvss3dnxa-as.a.run.app/healthz/` | 200 application/json; `{"status":"ok","service":"api"}` | Đúng public liveness API |
| `https://worker-service-wcvss3dnxa-as.a.run.app/healthz/` | 200 application/json; `{"status":"ok"}` | Đúng public liveness Worker |
| Hai URL trên bỏ slash cuối `/healthz` | 404, Google HTML | Dùng `/healthz/` theo biên bản #9, không coi HTML mẫu là health |

- [#8](https://github.com/namnkahn1607/INT3326E/issues/8): nhóm đã nghiệm thu Hello World
  trên `int3326e`, `hello-test/hello-test-sub`, emitter và bằng chứng PR #13 ngày 11/10.
  Không publish/pull hoặc đòi ảnh/ACK mới trong lần này.
- [#9](https://github.com/namnkahn1607/INT3326E/issues/9): ghi nhận Cloud SQL `int3326esql`,
  topic `int3326e_pubsub`, subscription `int3326e_pubsub-sub`, hai Cloud Run và budget
  `INT3326E_budget` 7.790.000 VND/quý, ngưỡng 30/50/70/90/100%.
  Đây là evidence lịch sử của TV5, không phải lần đọc Console mới.
- [#10](https://github.com/namnkahn1607/INT3326E/issues/10): checkpoint chung tuần 1 đã đóng,
  source `da5e7cd`, clean install/build/65 test và Hosting/health được ghi nhận.
  Không yêu cầu nhóm tạo thêm `docs/week1-checkpoint.md` hoặc làm lại Hello World.

## 6. Giới hạn, không được suy ra

- Chưa xác minh trực tiếp Cloud Run revision↔source SHA, SQL runtime, IAM/subscription runtime,
  budget trong Console, Firebase token thật, schema/migration hoặc nghiệp vụ đầu-cuối.
- API mock tests và health không chứng minh đăng nhập thật, ghi Cloud SQL hoặc thông báo.
- Admin map/metrics, form Create và user demo trên nhánh này vẫn là scaffold/mock.
  Lời nhắc geocoding tuần 2 trong UI cũ không phải requirement mới; xử lý copy/luồng theo UI01
  khi tích hợp tuần 2, không thêm provider tự động trong audit.
- Matrix browser giới hạn Edge desktop headless mô phỏng viewport; không tuyên bố kiểm thử
  toàn bộ trình duyệt/điện thoại thật, screen reader hoặc đạt chuẩn accessibility đầy đủ.
- Cảnh báo Vitest về loader/tsconfig-paths và npm có phiên bản mới không làm test fail;
  không nâng dependency hoặc đổi tooling chỉ để hết cảnh báo trong lượt audit.

## 7. Sẵn sàng và phụ thuộc tuần 2

Tuần 1 đạt, có thể chuyển sang **đối chiếu tích hợp tuần 2**, không cần nối GPS để đóng tuần 1.
Trước khi code phải đọc lại develop mới: bản cached `d38c598` đã có Firebase Auth/LoginPage,
ProtectedRoute/session tests trong FE, user linkage/error handling và CORS ở API, package Worker
riêng. Các phần này do thành viên khác đã làm; **không tạo Auth/Login trùng** từ nhánh cũ này.
Lần audit không tự merge hoặc nghiệm thu implementation trên SHA mới đó.

| Đầu việc theo VII.3 | Đầu mối | Cần đối chiếu trước tích hợp |
| --- | --- | --- |
| Reuse Auth/route/API client đã có trên develop | TV3 + TV6/TV4 | SHA tích hợp mới, kiểm chứng lại tests, Firebase config và demo account/claim/linkage; không tự cấp role |
| API01/02/03 + SC01–03 | TV1 + TV3 | Handler/cloud URL thực, `trackingNumber/customerId/dropoff*`, ULID, envelope/pagination và mapper |
| Create/retry | TV1 + TV3 + TV6 | UUID v4 Idempotency-Key, cùng ý định giữ key, lỗi 400/409/503, snapshot replay 201, loading/error/tracking number; TC01.1/01.4/01.6 |
| Địa chỉ/tọa độ | TV3 + TV1 | API01 validation; nhập/chọn tọa độ đúng UI01, không provider geocoding mới; ghi nhận khác biệt issue #3/Constitution cũ nếu cần amendment riêng |
| SQL/schema/seed | TV1 + TV5 + TV6 | Mapping/migration prefixed ULID và user linkage; seed/account thật ngoài repo; không chạy migration trong audit |
| CORS/Hosting→API | TV5 + TV6 + TV3 | Cấu hình đã có cần kiểm chứng origin/header/method theo VI.15.1, Idempotency-Key preflight, không cho mock test thay bằng chứng cloud |
| GPS payload chuẩn hóa (không phải việc Create của TV3) | TV2 + TV4, TV1 phối hợp | EVT01/timestamp; không ép draft bốn field tuần 1 thành production request |

Chưa bắt đầu tuần 2: không thêm Firebase SDK hoặc login mới trên nhánh này, không nối form/DB,
không đổi contract runtime, không chạy seed/migration, không commit/push/deploy.
