# ParcelFlow – hướng dẫn cho agent

## Tổng quan

ParcelFlow là ứng dụng giao nhận: Customer tạo đơn, Admin gán tài xế, Driver nhận và giao hàng, Customer theo dõi vị trí tài xế.
Monorepo npm workspaces:

| Thư mục | Vai trò |
| --- | --- |
| `apps/api` | NestJS API (`/v1`), Firebase Auth, PostgreSQL qua `pg` |
| `apps/worker` | GPS Worker: nhận Pub/Sub, ghi `location_history` và `current_locations` |
| `apps/web` | React + Vite cho Customer, Admin, Driver; deploy Firebase Hosting |
| `packages/types` | Kiểu và hợp đồng dùng chung (GPS, ETA) |
| `packages/database` | SQL tạo bảng (`sql/001`, `sql/002`) |
| `infra/` | Pub/Sub, Firebase |

Đặc tả gốc là PF SPEC 01 v1.4 (ngoài repo). Đọc [nguồn yêu cầu](docs/contracts/spec-baseline.md) để biết phiên bản và thứ tự ưu tiên.

## Lệnh

```sh
npm ci              # cài một lần ở gốc repo
npm run check       # kiểm tra chuẩn: lint, typecheck, test, build cho API, Worker, web
npm run dev:web     # web local, cần apps/web/.env.local
npm run start:dev   # Worker local, cần .env
```

`npm run check` là lệnh duy nhất dùng để kết luận repo đạt; chạy riêng từng phần xem `package.json`.
Node 26 cần `NODE_OPTIONS=--no-experimental-webstorage` cho test web.
Test trên PostgreSQL thật chỉ chạy khi có biến môi trường trỏ tới DB loopback tên `parcelflow_*_test`, xem README của từng package.

## Đầu phiên làm việc

1. `git pull` trên `develop`, đọc commit gần đây (`git log --oneline -10`).
2. Đọc [danh sách tính năng](docs/features.md) và file tuần hiện tại trong [điều phối](docs/coordination/README.md) để biết việc đang dở.
3. Chạy `npm run check`. Nếu đang đỏ, sửa cho xanh trước, không chồng việc mới lên.
4. Chọn một việc, làm xong việc đó rồi mới sang việc khác.

## Ràng buộc cứng

- Cột SQL dùng camelCase có ngoặc kép (`"driverId"`, `"clientTimestamp"`) theo DATA01–DATA07.
- Worker chỉ ACK message sau khi transaction commit. GPS: mẫu đầu tiên thắng theo (`driverId`, `clientTimestamp`), `current_locations` không lùi về mẫu cũ.
- Mọi API (trừ health) qua `FirebaseAuthGuard` và `RolesGuard`; 3 role `CUSTOMER`, `DRIVER`, `ADMIN`.
- Không commit `.env`, key, token hay mật khẩu. Biến mẫu nằm trong `.env.example`.
- `apps/api` và `apps/worker` giữ lockfile riêng vì Dockerfile build độc lập (`npm ci --workspaces=false`). Đổi dependency thì cập nhật cả lockfile gốc và lockfile của app.
- Diff nhỏ nhất giải quyết vấn đề. Không đổi tên, format lại hay refactor code ngoài phạm vi. Grep trước khi dùng API, flag hay tên job; chưa chắc thì nói rõ.
- Chú thích chỉ giải thích lý do hoặc bất biến không hiển nhiên, không lặp lại code làm gì.

## Thế nào là xong

Một việc chỉ xong khi:

- hành vi đã được triển khai đúng đặc tả;
- `npm run check` đạt, và test của chính việc đó đã chạy (không chỉ "code trông ổn");
- `docs/features.md` cập nhật trạng thái kèm môi trường đã kiểm (local hay Cloud);
- tài liệu bị ảnh hưởng đã sửa trong cùng PR.

Không xóa hoặc nới test để cho qua. Không ghi "đạt" khi chưa chạy.

## Cuối phiên làm việc

1. Cập nhật `docs/features.md` và file tuần trong `docs/coordination/`.
2. Việc cố ý để sau thì ghi vào [nợ kỹ thuật](docs/tech-debt.md), kèm rủi ro.
3. Commit, mở PR vào `develop`; ghi rõ cái gì chưa kiểm.

## Quy trình nhóm

- Mỗi thay đổi đi qua nhánh riêng và PR vào `develop`. Cuối tuần chốt bằng PR `week/NN` → `main` (merge commit).
- Báo kết quả kiểm tra kèm môi trường: mock, local hay Cloud.
- Ai dùng Spec Kit thì theo [quy trình Spec Kit](docs/agents/spec-kit-workflow.md).

## Tài liệu

- [Mục lục tài liệu](docs/README.md)
- [Danh sách tính năng và trạng thái](docs/features.md)
- Hợp đồng: [API](docs/contracts/api-contract.md) · [OpenAPI](docs/openapi.json) · [Auth/RBAC](docs/contracts/auth-rbac.md) · [GPS event](docs/contracts/gps-event-contract.md)
- [Kiến trúc](ARCHITECTURE.md) · [Độ tin cậy](docs/RELIABILITY.md) · [Nợ kỹ thuật](docs/tech-debt.md) · [Triển khai](docs/features/deploy.md)
- [Điều phối theo tuần](docs/coordination/README.md) · [QA test plan](docs/qa/test-plan.md)
