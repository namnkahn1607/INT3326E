# Tasks TV4 tuần 7

- [x] W701 — R1–R7: spec, clarify kỹ thuật, plan, review checklist và analyze.
  Bằng chứng: spec.md, plan.md và checklist.md đã review riêng ngày 08/11/2026.
- [x] W702 — R1/R3: chọn nguồn, tuyến simulator có nhãn, giữ seq và cadence.
  Bằng chứng: GpsEmitter.spec.tsx và browser check cadence/đổi tọa độ.
- [x] W703 — R2/R4/R6: định vị browser, timestamp đo, lỗi/quyền/deadline/cleanup.
  Bằng chứng: component/dashboard tests; native Geolocation, quyền và cleanup
  trong báo cáo browser local ngày 08/11/2026.
- [x] W704 — R5: nối dashboard hiện hành và kiểm chứng contract/phiên/202.
  Bằng chứng: locations.spec.ts, DriverPlaceholderPage.spec.tsx và harness dùng
  adapter thật, Bearer token/API mock; không tính là đăng nhập Firebase thật.
- [x] W705 — R1–R6: test component/dashboard và browser local; lint/build/frontend.
  Bằng chứng: 462/462 frontend test, 26/26 browser check; lint/build exit 0.
- [x] W706 — R7: cập nhật bàn giao, review/converge theo spec và bằng chứng.
  Bằng chứng: mục TV4 tuần 7 trong `docs/features/driver-dashboard-gps.md`, report/ảnh tại
  `docs/evidence/driver-gps-week7/`; SHA-256 trong report khớp source hiện tại.
  Converge cuối không còn thiếu sót local sau W708; W707 vẫn mở, không tuyên bố
  đã nghiệm thu GPS Cloud hoặc hoàn tất checkpoint chung tuần 7.
- [ ] W707 — R7: nghiệm thu Driver thật → API → Pub/Sub → Worker → SQL trên Cloud
  cùng TV2/5/6, lưu revision/eventId và kết quả thật; không đóng bằng test mock.
  Blocker: chưa có cấu hình/phiên Driver và record đối chiếu Cloud cho lượt này;
  xem bàn giao Driver ngày 08/11/2026. Không tự commit/push/deploy để đóng mục này.
- [x] W708 — R4/R6, finding converge: nhánh lỗi định vị cần xóa interval ngay,
  không chỉ chờ React effect cleanup. Thêm hồi quy lỗi native đồng bộ và nhiều
  tick được xử lý trong cùng lượt để bảo đảm không tự gọi định vị lại sau lỗi.
  Bằng chứng: test từng FAIL (3 lần gọi thay vì 1), sau sửa `fail` thì suite
  frontend 462/462 và browser 26/26 PASS.

- [x] W709 — D1/D2: danh sách/chi tiết Driver, scope server, trạng thái dữ liệu,
  cursor/lọc và cleanup; tái sử dụng UI/client hiện có.
  Bằng chứng: DriverShipments.spec.tsx, 2 ca Driver mới trong shipment-flow.spec.tsx.
- [x] W710 — D3/D4: adapter pickup/deliver, xác nhận/hủy, chống gửi lặp,
  đối chiếu GET sau POST và xử lý kết quả chưa rõ.
  Bằng chứng: driver-actions.spec.ts và DriverShipments.spec.tsx; browser có 404/409,
  response sai, đọc lại lỗi, xác nhận và cleanup; chưa xác nhận backend nghiệp vụ.
- [x] W711 — D1–D5: test contract/UI/cleanup, test frontend, lint/build và browser local.
  Bằng chứng: frontend 493/493, integration 10/10, lint/build exit 0, Edge 39/39;
  docs/evidence/driver-shipments/report.json và ảnh; chi tiết ở bàn giao nhận/giao.
- [x] W712 — D5: review/converge, cập nhật bằng chứng và bàn giao phụ thuộc.
  Bằng chứng: docs/features/driver-shipments-handoff.md; D1–D5 không còn thiếu sót local,
  W713/W707 giữ mở cho backend/môi trường thật. Lượt implement chưa commit/push/deploy;
  commit/push/merge được người dùng cho phép riêng sau bàn giao, không deploy.
- [ ] W713 — D5: cùng TV1/5/6 nghiệm thu list → pickup → deliver trên backend thật;
  cần handler TV1, revision/config và tài khoản có linkage. Không đóng bằng mock.
