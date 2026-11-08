# Implementation Plan: Admin assignment

**Branch**: `feature/frontend` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

## Summary

TV3 nối Admin đơn hàng/phân công/tài xế vào API thật theo FR02/UI03/VII.4;
tái dùng Auth, apiClient, Shipment parser và shell, không sửa nghiệp vụ backend.
Mỗi lần Assign chỉ một POST, lỗi chưa xác định phải GET Detail và xác nhận mới.

## Technical Context

- React 19, TypeScript 6, Vite 8, React Router 8 theo apps/web/package.json.
- CSS hiện có, không thêm thư viện, không có DB/storage mới trong FE.
- Vitest/jsdom + React DOM act; kiểm tra browser mobile/desktop nếu khả dụng.
- Paginated REST limit 20; không tự scan tất cả, không polling trong phần này.
- Chỉ frontend Admin, shared API additions additive; không sửa Auth/Customer behavior.

## Constitution Check

Trước/sau thiết kế: giữ một app apps/web, ba role, /admin; feature-based boundaries;
không secret/DB/cloud writes; contract từ nguồn chính không phải báo cáo AI.
Không sửa AGENTS.md/constitution, không tạo lại Auth hay Driver, không thêm endpoint.
Constitution có ghi chú draft cũ; dùng quyết định mới đã được người dùng chỉ định
trong PF SPEC 01, không sửa constitution để hợp thức hóa code.
Không có vi phạm cần ngoại lệ. Nghiệm thu cloud vẫn là gate riêng SC006.

## Project Structure

```text
specs/001-admin-assignment/
  spec.md plan.md research.md data-model.md quickstart.md tasks.md
  checklists/requirements.md checklists/integration.md contracts/admin.md
apps/web/src/
  api/endpoints/drivers.ts drivers.spec.ts shipments.ts shipments.spec.ts
  types/driver-api.ts
  features/admin/
    useAdminPage.ts AdminPageFeedback.tsx AdminShipmentDetail.tsx admin-errors.ts
    AdminShipmentsPage.tsx AdminAssignmentPage.tsx AdminDriversPage.tsx
    AdminUi.spec.tsx AdminAssignmentPage.spec.tsx admin-api.css
  layouts/AdminLayout.tsx
```

## Design and dependencies

1. Runtime parser cho DriverResponse/SC01, reused apiClient token và no retry.
   Assign helper dùng body duy nhất {driverId}, 200 ShipmentResponse; validate ID,
   response identity/status/driver, không chấp nhận malformed response là thành công.
2. Hook tải từng trang giữ cursor history, abort và ignore stale, xóa data khi lỗi,
   không biến lỗi thành empty. Dùng lại cho shipments/drivers và selector.
3. AdminShipments filters theo server status/exact tracking, link phân công chứa
   shipmentId. Chi tiết hiển thị trong flow phân công, gồm state/driver/history.
4. Assignment state: chọn → GET Detail → chọn tài xế → review → POST → server result.
   Disable lựa chọn lúc gửi. 409/network/timeout/5xx/malformed success → clear intent,
   GET Detail, vẫn yêu cầu chọn/xác nhận mới. GET lỗi → khóa ghi, chỉ retry GET.
   Không suy từ GET thành POST đã thành công; nói rõ đây là dữ liệu hiện hành.
5. DemoNotice theo route: giữ cho Overview/Accounts/LiveMap, bỏ ở trang đã nối thật.
   Không phát minh online/status/phone/vehicle trong driver list.
6. Unit/contract + UI tests trước implementation; API TV6 HTTP test chạy riêng,
   không gọi DB/cloud thật. Browser có mock in-memory để kiểm UX, không ghi nghiệp vụ.

## Delivery gates

Lint/build/test frontend, targeted API directory test, git diff/check và SHA256 AGENTS.
SC006 chờ TV1 APIs/deploy/fixture ADMIN+DRIVER được phép thao tác; không tự seed,
assign cloud hoặc kết luận đã hoàn tất tuần 3 khi thiếu bằng chứng này.
