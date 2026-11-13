# Week 4 (12/10–18/10)

Mục lục: [Điều phối theo tuần](README.md)

**Checkpoint:** URL chung truy cập được, health check cả 2 service Cloud Run (backend và worker) trả 200, Pub/Sub có topic và subscription.

**Trạng thái sheet:** TRUE cho cả 6 dòng.

## Giao việc theo sheet

| TV | Người | Việc |
| --- | --- | --- |
| TV1 | Nguyễn Lê Nam Khánh (nhóm trưởng) | Scaffold NestJS, phác thảo module Shipment (chưa có logic), góp ý API contract draft |
| TV2 | Nguyễn Thị Lê Na | Scaffold GPS Worker (chỉ health check), phối hợp tạo Pub/Sub topic và subscription |
| TV3 | Lê Đình Anh Tuấn | Scaffold React + Vite, routing cơ bản theo role (stub), deploy thử lên Firebase Hosting |
| TV4 | Nguyễn Minh Anh | Pair với TV2 thử publish/consume "hello world" qua Pub/Sub; phác thảo component GPS emitter |
| TV5 | Trần Đại Quang | Tạo GCP project, 2 service Cloud Run (backend, worker rỗng), Cloud SQL, Pub/Sub topic/subscription, đặt budget alert |
| TV6 | Đỗ Đức Đạt | Scaffold Auth (Firebase Auth), phác thảo module Admin |

## Thực tế từng người

Commit tính theo tài khoản GitHub, ngày theo commit. Nhiều việc làm sớm từ đầu tháng 10, trước khung tuần của sheet.

**TV1 (`namnkahn1607`)**
- 02/10–05/10: dựng cấu trúc thư mục backend, đề xuất phân cấp project, định nghĩa API contract, sửa lỗi liên quan contract.
- Phần scaffold API tuần đầu được hoàn thiện thêm trong commit `feat(tv1): complete week 1 API scaffold and contract draft` (10/10).

**TV2 (`LeNa11-mia`)**
- 04/10: scaffold service GPS Worker, endpoint `healthz`.
- 05/10–06/10: chuyển Worker về cấu trúc monorepo, sửa build.
- 10/10: health check, sửa cấu hình build và lint.

**TV3 (`Dinh Tuan`)**
- 05/10: scaffold portal Customer và Admin, tài liệu openspec cho frontend.
- 06/10–07/10: thiết kế lại UI Customer, dashboard Admin có bản đồ tài xế, gộp thư mục admin và dispatcher.
- 10/10: sửa role Admin trên frontend, đồng bộ lockfile và cấu hình TypeScript, dọn `.gitignore`.

**Phần Driver của TV4 (commit tài khoản `AkaLissandra` của Trần Đại Quang, ghi nhận cho Quang)**
- 08/10–09/10: component GPS emitter cho Driver (bản tuần đầu).
- Bằng chứng Pub/Sub hello world (publish, pull, topic, subscription) nằm trong `docs/evidence/week-1/`.

**TV5**
- Hạ tầng GCP (project, Cloud Run, Cloud SQL, Pub/Sub, budget) làm trên console, không có commit trong repo.

**TV6 (`datdooo`)**
- 05/10: hợp đồng Firebase Auth và RBAC, guard xác thực, decorator role, guard phân quyền, scaffold module Admin.
- 09/10: bỏ role DISPATCHER, gộp quyền điều phối vào ADMIN, test từ chối claim không hợp lệ, đồng bộ tài liệu `auth-rbac.md` và `ARCHITECTURE.md`.

## Chốt tuần

- PR #23: `week/04` → `main`, merge commit `7c17b6a`. Ranh giới tuần là commit `360a24b` trên `develop`.
- Merge bằng "Create a merge commit", có người duyệt.

## Ghi chú

- Ranh giới tuần cắt theo đồ thị commit trên `develop`, không theo ngày commit, vì có việc nộp trễ hoặc sớm so với sheet.
- Tài liệu của tuần dùng tên "week 1" ở vài chỗ (ví dụ `docs/evidence/week-1/`, commit "Week 1") vì nhóm đánh số theo giai đoạn code, không theo sheet.
