# Implementation Plan: Nghiệm thu lại frontend tuần 1

**Branch**: `feature/frontend` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

## Summary

Nghiệm thu lại baseline TV3 theo PF SPEC 01 v1.3/VII.2; kiểm tra phối hợp emitter TV4,
đối chiếu checkpoint chung chỉ đọc và chuẩn bị phụ thuộc tuần 2. Tái sử dụng app/code và
bộ frontend-*.md hiện có. Folder này chỉ quản lý lượt audit bằng Spec Kit, không là
đặc tả nghiệp vụ thứ hai. Không tạo tính năng Auth/Create/GPS hoặc deployment mới.

## Technical Context

- **Language/Version**: Node hiện tại 24.21.0; root/Worker yêu cầu >=22.12,
  API >=20.12; TypeScript 6.0.3 root/FE và 5.7.3 API theo package/lockfile local.
- **Dependencies**: React/Vite/React Router, Leaflet/OSM; API NestJS 11/Express,
  Worker NestJS 12/Express/PubSub. Không đổi dependency, compiler hoặc adapter.
- **Storage**: Không sửa DB. Các evidence record là Markdown/JSON báo cáo, không migration.
- **Testing**: Script package thật; HTTP GET local/cloud; browser headless với profile tạm
  riêng và kiểm tra DOM/timer/keyboard/responsive. Không dùng profile cá nhân hoặc gửi GPS thật.
- **Target**: Một SPA `apps/web` trên Hosting `int3326e`; hai Cloud Run hiện có.
- **Performance**: Chỉ kiểm tra interval mẫu 8000 ms; không chạy hoặc suy ra NFR/load test.
- **Scope**: Ba cổng chính, route con hiện có, emitter mẫu; documentation và bằng chứng.

## Constitution Check

| Nguyên tắc | Gate trước và sau design |
| --- | --- |
| I — công nghệ/build | Giữ app, package và lockfile; lint/build theo package hiện có. |
| II — kiến trúc GPS | Không nối GPS/DB; emitter chỉ là mẫu tuần 1, không coi ACK Hello World là commit GPS. |
| III — API | Chỉ sửa tham chiếu tài liệu `/v1/locations`; không thêm endpoint/type/role/state. |
| IV — trách nhiệm/quyền | TV3 và phối hợp TV4; cloud/API/Worker chỉ kiểm tra, không nhận thay implementation. |
| V — bằng chứng | Phân biệt local/cloud, mock/thật, version/source; không tự đánh dấu checkpoint chung từ FE pass. |

Không sửa constitution. Khác biệt về geocoding và các quyết định cũ được lưu ở research.md;
không có xung đột nguyên tắc phải thay đổi để nghiệm thu stub tuần 1. Mọi thay đổi nguyên tắc
thực sự cần thiết khi triển khai tuần 2 phải xử lý riêng, không âm thầm viết lại constitution.

## Project Structure

- Code tái sử dụng: `apps/web/src/App.tsx`, `layouts/`, `features/customer`, `features/admin`,
  `features/driver/GpsEmitter.tsx`, `apps/web/firebase.json`, `.firebaserc`.
- Regression scaffold: `apps/api/package.json`, `apps/api/src/health/`, `apps/worker/src/health/`.
- Hồ sơ audit: `spec.md`, `research.md`, `data-model.md`, `contracts/week1.md`,
  `quickstart.md`, `checklists/`, `tasks.md`, `acceptance.md` trong folder này.
- Nguồn/bàn giao: `docs/spec-baseline.md`, cập nhật frontend-*.md và emitter draft hiện có,
  thêm liên kết ở README; không sao chép toàn bộ Google Doc hoặc tạo lại frontend.

## Phases

1. Ghi nguồn chính thức và phân biệt yêu cầu mới với implementation hiện có.
2. Review chất lượng yêu cầu riêng, sinh tasks và analyze read-only; sửa finding trước implement.
3. Chạy lint/build FE, kiểm tra role/route/config, browser direct/refresh/mobile/keyboard.
4. Kiểm tra emitter mẫu và cleanup; so sánh Hosting asset với local build bằng hash.
5. Chạy regression API/Worker và local health; kiểm tra public health đúng URL từ issue #9,
   dùng lại Hello World/resources/budget đã có, không phát message hay thay cloud.
6. Đồng bộ tài liệu, lập acceptance và phụ thuộc tuần 2; converge theo spec này.

## Giới hạn và dependencies

- SHA local `360a24b` khác snapshot S4 `da5e7cd`; `origin/develop` cached `d38c598` mới hơn
  14 commit. Không auto merge. Trước tuần 2 cần kiểm tra bản tích hợp mới và dependency thực tế.
- Browser quan sát ở 390x844 và 1280x900 là phương pháp kiểm tra responsive, không thêm NFR mới.
- Dùng một request/timer mẫu, test thời gian trong tab foreground, không hứa GPS nền.
- Source/revision của cloud chỉ kết luận nếu đọc được metadata tương ứng; health không chứng minh SHA.
- Nếu phát hiện gap tuần 1 trong phạm vi, bổ sung task sửa nhỏ và kiểm tra lại; việc ngoài quyền
  hoặc thuộc tuần sau được ghi rõ owner/giới hạn, không mở rộng scope.
