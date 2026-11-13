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
npm ci                                   # cài một lần ở gốc repo
npm run typecheck                        # API + Worker
npm test                                 # Worker, types, infra
npm test --workspace=@parcelflow/api     # API
npm test --workspace=@parcelflow/web     # web
npm run build && npm run build:web       # Worker, web
npm run build --workspace=@parcelflow/api
npm run dev:web                          # web local, cần apps/web/.env.local
```

Node 26 cần `NODE_OPTIONS=--no-experimental-webstorage` khi chạy test web.
Test trên PostgreSQL thật chỉ chạy khi có biến môi trường trỏ tới DB loopback tên `parcelflow_*_test`, xem README của từng package.

## Ràng buộc cứng

- Cột SQL dùng camelCase có ngoặc kép (`"driverId"`, `"clientTimestamp"`) theo DATA01–DATA07.
- Worker chỉ ACK message sau khi transaction commit. GPS: mẫu đầu tiên thắng theo (`driverId`, `clientTimestamp`), `current_locations` không lùi về mẫu cũ.
- Mọi API (trừ health) qua `FirebaseAuthGuard` và `RolesGuard`; 3 role `CUSTOMER`, `DRIVER`, `ADMIN`.
- Không commit `.env`, key, token hay mật khẩu. Biến mẫu nằm trong `.env.example`.
- `apps/api` và `apps/worker` giữ lockfile riêng vì Dockerfile build độc lập (`npm ci --workspaces=false`). Đổi dependency thì cập nhật cả lockfile gốc và lockfile của app.
- Diff nhỏ nhất giải quyết vấn đề. Không đổi tên, format lại hay refactor code ngoài phạm vi. Grep trước khi dùng API, flag hay tên job; chưa chắc thì nói rõ.
- Chú thích chỉ giải thích lý do hoặc bất biến không hiển nhiên, không lặp lại code làm gì.

## Quy trình nhóm

- Mỗi thay đổi đi qua nhánh riêng và PR vào `develop`. Cuối tuần chốt bằng PR `week/NN` → `main` (merge commit).
- Báo kết quả kiểm tra kèm môi trường: mock, local hay Cloud. Không ghi "đạt" khi chưa chạy.
- Ai dùng Spec Kit thì theo [quy trình Spec Kit](docs/agents/spec-kit-workflow.md).

## Tài liệu

- [Mục lục tài liệu](docs/README.md)
- [Danh sách tính năng và trạng thái](docs/features.md)
- Hợp đồng: [API](docs/contracts/api-contract.md) · [OpenAPI](docs/openapi.json) · [Auth/RBAC](docs/contracts/auth-rbac.md) · [GPS event](docs/contracts/gps-event-contract.md)
- [Kiến trúc](ARCHITECTURE.md) · [Điều phối theo tuần](docs/coordination/README.md) · [QA test plan](docs/qa/test-plan.md)
