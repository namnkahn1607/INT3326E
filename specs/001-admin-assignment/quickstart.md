# Validation guide

Từ root: `npm run lint:web`, `npm run build:web`,
`npm run test --workspace=@parcelflow/web`.
TV6 provider: từ apps/api, `npm test -- --run src/modules/admin/admin-directory.spec.ts src/modules/admin/dto/admin-list-query.spec.ts`.

Local UI: `npm run dev:web`; dùng tài khoản ADMIN đã provision và VITE_API_URL
trỏ backend của nhóm. Không ghi credentials trong spec/test. Danh sách/Assign sẽ
báo lỗi nếu TV1 chưa cung cấp handlers; đây không phải dữ liệu rỗng.

Case matrix: created→assign; assigned→reassign; cùng driver; picked/terminal bị khóa;
409→Detail; timeout/5xx/malformed response→Detail, không POST lần hai; GET recovery
lỗi→chỉ đọc lại; load/empty/error/401/403/USER_NOT_PROVISIONED; paginated drivers
và shipments độc lập; switch selection/unmount stale response; no overflow375/1440;
keyboard review/cancel/confirm và live announcements.

Cloud gate (operator phối hợp, chưa tự chạy): TV1 API02/03/04, TV6 API11, TV5 deploy
và schema/user linkage sẵn sàng. ADMIN phân công fixture đã được phép và DRIVER
thấy đúng đơn; lưu source/revision/request outcome đã redact. Không dùng mock để
đóng gate này, không tự seed/migrate/deploy.
