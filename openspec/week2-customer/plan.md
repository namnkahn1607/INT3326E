# Implementation Plan: TV3 Customer tuần 2

Branch: feature/tuan/week2-customer | 2026-10-18 | [Spec](spec.md)

## Summary
Reuse Auth PR #15; nối Customer Create/List/Detail theo contract đích.
Không có handler thì hiện lỗi thật, không fallback mock hoặc làm backend thay TV1.

## Technical Context
TypeScript 6 / React 19 / Vite 8 / router 8 / Firebase 13 đã có; fetch,
AbortController, Vitest/jsdom. CSS hiện có + file scoped; không dependency mới.
Browser hiện đại, Firebase Hosting SPA; chưa deploy. State RAM, không PII/token
localStorage. Một POST in-flight; GET cleanup. NFR server <500ms chưa đo cloud.

## Constitution Check
- I: một apps/web, stack/CSS/dependencies hiện có; ci riêng web theo lockfile.
- II: REST only, không DB/PubSub/GPS/Worker changes.
- III: D01/D07/D09 wire riêng, không cast UI type cũ.
- IV: TV3 Customer/Auth integration, không nghiệp vụ TV1/4/6. UI01 cho phép
  nhập tọa độ; chưa chọn provider; giữ ranh giới địa chỉ client, không tự geocode.
  Nguồn mới người dùng chỉ định thay kỳ vọng geocoding cũ; không sửa constitution.
- V: tests/lint/build/browser và cloud gate riêng. Thiếu đầu vào cloud để task mở.
Pre/post-design: không vi phạm nguyên tắc công nghệ/quyền, không tạo Auth trùng.

## Research/design
[Research](research.md), [data](data-model.md), [contract](contracts/customer.md).
Research agent chỉ đọc code, không là nguồn yêu cầu.
UI UX Pro Max: error-summary/inline-validation và React cleanup phù hợp.
Hai design-system query trả landing/education lệch context sau một lần retry:
không persist/apply; fallback minh bạch giữ theme tím, font/tokens hiện có.
Hai cột desktop/một cột mobile, 16px input, lỗi inline+summary, h1/h2/fieldset.
Motion Emil primary/Jakub secondary: không animation thao tác thường xuyên,
không loop/pulse; scoped transition:none, không thêm animation dependency.

## Project Structure
- apps/web/src/api/client.ts: ApiError status/code/field errors, timeout/abort/token.
- apps/web/src/api/endpoints/shipments.ts: API01–03 và parser wire.
- apps/web/src/types/shipment-api.ts: wire riêng, không đổi legacy Shipment.
- apps/web/src/features/customer/shipment-form.ts: validation/normalization/intent.
- CustomerCreatePage.tsx, CustomerShipmentsPage.tsx, CustomerShipmentDetailPage.tsx
  và customer-api.css trong cùng features/customer.
- App.tsx: /customer/shipments/:id dưới CUSTOMER.
- features/auth/LoginPage.tsx/auth.css: polish UI only; giữ SDK/AuthProvider.
- Colocated .spec.ts(x); docs/quickstart/acceptance trong bộ này.

Intent RAM immutable key/payload/startedAt. Timeout/5xx lock fields, retry key cũ;
không validate lại deadline đã gửi; quá 24h đối chiếu chứ không đổi key.
GET query limit/status/cursor; bỏ dữ liệu cũ khi đổi query/user. Detail đọc lại server,
không dùng Create snapshot làm state mới. Không PII log/localStorage.

## Verification
Contract/client + form/retry/deadline/double-submit + list/detail states/cleanup;
Auth regression còn đạt; lint/build; browser mock journey 390/768/1280px keyboard,
direct/refresh/reduced-motion. Mock không chứng minh cloud persistence.
Cloud cần TV1 API01–03, TV6 linkage/claims, TV5 SQL/CORS và account đã provision.
Không cấp role, migration, deploy hoặc tự mark cloud pass.

## Home visual update — FR-010

Prompt JSON mới chỉ thay Home: CustomerLayout chọn CustomerHomeHeader ở route
index, giữ header/layout các route khác. CustomerOverviewPage + customer-home.css
dùng cam solid, nền trắng/cream, không gradients; CustomerHomeIcon SVG native.
Font Satoshi qua Fontshare/Inter qua Google Fonts, font-display swap và fallback.
Hình imagegen lưu PNG nguồn + WebP (giữ alpha/dimensions); UI dùng WebP.
Active card gọi API02 limit20, chọn active row đầu, có loading/error/empty và abort.
Không polling/tracking GPS hoặc số liệu toàn cục; bốn nhãn tiến độ ánh xạ các state
đã có (không tạo OUT_FOR_DELIVERY). Search truyền trackingNumber exact theo API02
sang URL/list, không bỏ qua input. More dùng native details dẫn các route hiện có;
Schedule/Locations/Profile disabled và nói rõ chưa có nghiệp vụ.
Thêm home tests và browser mock 390/768/1280/1440px; giữ regression Create/Auth.
