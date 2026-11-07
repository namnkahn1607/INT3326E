# TV6: công việc theo tuần

Người phụ trách: Đỗ Đức Đạt (GitHub `datdooo`). Soạn ngày 05/11/2026, đối chiếu với `origin/develop` tại `ea0b74d`.

Mỗi tuần ghi bốn thứ: việc theo sheet, việc thực tế có commit, bằng chứng, phần còn thiếu. Checkbox trong sheet không thay bằng chứng. Local/mock và Cloud được ghi riêng. Chưa có mục nào ở đây được kiểm trực tiếp trên Cloud.

Mã việc tuần 7 trở đi lấy từ [week-task-breakdown.md](week-task-breakdown.md).

## Lưu ý về mốc ngày

Code của TV6 chạy sớm hơn lịch sheet khoảng một tuần. Ví dụ Firebase Auth đủ ba role nằm ở tuần 5 của sheet (19/10–25/10) nhưng commit ngày 17/10, thuộc tuần 4 theo lịch. Bảng dưới ghi ngày commit thật, không sửa ngược sheet.

## Tuần 1–3: tài liệu

Trạng thái sheet: Chưa cập nhật. Không tự xác nhận đã được duyệt.

| Tuần | Việc theo sheet | Có trong repo |
| --- | --- | --- |
| 1 | Tổng hợp vai trò, quyền, tiêu chí nghiệm thu, danh mục tài liệu | Chưa đối chiếu được với file cụ thể |
| 2 | Soạn Auth/RBAC, liên kết người dùng, thông báo, ma trận QA | [auth-rbac.md](../auth-rbac.md) (hợp đồng), commit `bf93103` (05/10); [qa-test-plan.md](../qa-test-plan.md) bản nháp |
| 3 | Tổng hợp constitution, hướng dẫn agent, traceability, phân công tuần 4–13 | [AGENTS.md](../../AGENTS.md), [week-task-breakdown.md](week-task-breakdown.md); constitution nằm trong checkout `parcelflow-docs-revision`, chưa commit |

## Tuần 4 (12/10–18/10)

**Theo sheet (TRUE):** scaffold Auth module (Firebase Auth), phác thảo module Admin.

**Thực tế**
- 05/10 đến 09/10: token verifier, guard xác thực, role decorator, guard phân quyền, scaffold Admin (`691ae07`, `649a4f5`, `d82e0b9`, `a409693`, `1883408`).
- 09/10: bỏ role DISPATCHER, dùng ADMIN cho quyền điều phối, đồng bộ README, ARCHITECTURE, auth-rbac (`73b998c`, `d266269`, `b09462a` và các commit cùng PR #4, #11).
- 17/10: Firebase login và RBAC ba role (`fe0b6e2`), ràng buộc liên kết user nghiệp vụ và lỗi dependency (`16f0cb1`). Hai commit này do Đạt thực hiện bằng Codex nên Git ghi tác giả là `Codex`. Kết quả ở [auth-rbac-handoff.md](auth-rbac-handoff.md).
- 18/10: [frontend-config-handoff.md](../frontend-config-handoff.md) cho cấu hình frontend (`87bb551`, PR #16).

**Bằng chứng:** các PR trên đã vào `develop`. Test Auth chạy với Firebase Emulator và mock. Chưa có bằng chứng đăng nhập thật trên Cloud trong repo.

**Còn thiếu:** không có việc mở của sheet. Cần nhắc rằng Auth chưa kiểm tài khoản thật cho cả ba role trên Cloud.

## Tuần 5 (19/10–25/10)

**Theo sheet (TRUE):** tích hợp Firebase Auth đầy đủ (custom claims ba role), auth guard.

**Thực tế:** phần này đã làm ở tuần 4 theo lịch (`fe0b6e2`, `16f0cb1`). Tuần 5 chạm thêm 24/10: Admin directory chỉ đọc và bản nháp QA plan (`1063cf1`, PR #19). Hợp đồng ở [admin-directory.md](../admin-directory.md), kết quả ở [admin-directory-handoff.md](admin-directory-handoff.md).

**Bằng chứng:** `GET /v1/drivers`, `GET /v1/admin/customers`, `GET /v1/admin/me`. Bộ test mock, HTTP và SQL cục bộ có trong `admin-directory.spec.ts` và `admin-directory.postgres.spec.ts`. Ca ADM12 (race/snapshot) cần PostgreSQL đa kết nối thật, chưa chạy.

**Còn thiếu:** kiểm directory trên revision đã deploy (ADM01–ADM04, ADM17).

## Tuần 6 (26/10–01/11)

**Theo sheet (TRUE):** backend Admin skeleton (danh sách driver/customer), phác thảo QA test plan. Hai việc này đã xong ngày 24/10.

**Thực tế thêm:** làm thay TV1 phần API gán tài xế.
- 01/11: đọc đơn theo quyền, gán tài xế trong transaction kèm history và notification (`7b5754f`).
- 01/11: Việt hóa chú thích và thông báo lỗi (`4b6c56a`).

**Bằng chứng:** `assignments.postgres.spec.ts`, `shipments.postgres.spec.ts` (SQL local). Ghi trong báo cáo: người được giao là TV1, người làm là Đạt.

**Còn thiếu:** kiểm Assign trên Cloud (TC02.1–02.4, NF03).

## Tuần 7 (02/11–08/11)

**Theo sheet (FALSE):** QA luồng create, assign, pickup, deliver.
**Checkpoint:** luồng tạo đơn đến giao hàng hoạt động; vị trí driver ghi được qua Worker.

02/11: tích hợp nhánh GPS của Na vào develop (`ea0b74d`), kiểm thử local.

| Mã | Việc | Trạng thái hiện tại |
| --- | --- | --- |
| W7-TV6-01 | Chuẩn bị tài khoản Customer/Admin/Driver và đơn test | Chưa làm. Cần tài khoản demo có role đúng, không đưa mật khẩu hay token vào Git |
| W7-TV6-02 | Chạy create, assign, pickup, deliver, sai quyền, history, đối chiếu SQL | BLOCKED: chưa thấy handler pickup/deliver/fail trên `develop`, chưa có endpoint history riêng (TV1) |

**Có thể làm trước:** ca create và assign (AC01, AC02), sai quyền (AC10), kiểm cột GPS giữa Worker và API directory khi có schema thật.

**Rủi ro:** Worker có chế độ bộ nhớ, log ACK chưa chứng minh đã ghi SQL. Sheet ghi push subscription, code dùng pull.

## Tuần 8 (09/11–15/11)

Checkpoint: Customer thấy vị trí tài xế gần real-time trên cloud. Ưu tiên cao nhất.

| Mã | Việc | Tiêu chí |
| --- | --- | --- |
| W8-TV6-01 | QA tracking: owner, driver sau reassign, GPS terminal không lộ | AC05, NF09, TC05.1–05.3 |
| W8-TV6-02 | Thủ công duplicate và out-of-order GPS, đối chiếu manifest với SQL | AC04, LT06, TC04.3–04.5 |

## Tuần 9 (16/11–22/11)

Checkpoint: đủ 8 use case bắt buộc (nhóm cần chốt danh sách).

| Mã | Việc | Tiêu chí |
| --- | --- | --- |
| W9-TV6-01 | Backend notification: mỗi event thật đúng một thông báo, đúng chủ đơn | FR08, AC08, TC08.1–08.2 |
| W9-TV6-02 | Admin cơ bản (driver/account) trong phạm vi đã chốt, không thêm CRUD hay cấp role | FR10, AC10, ADM15 |

## Tuần 10 (23/11–29/11)

Checkpoint: ETA hoạt động cùng tracking.

| Mã | Việc | Tiêu chí |
| --- | --- | --- |
| W10-TV6-01 | QA ETA | AC09, TC09.1–09.4 |
| W10-TV6-02 | Phân quyền chéo customer/driver/dispatcher/admin: đoán ID, giả actor, driver sau reassign | FR10, AC10, NF09, TC10.1–10.3 |

## Tuần 11 (30/11–06/12)

Checkpoint: hệ thống ổn định trên cloud, demo recovery sẵn sàng.

| Mã | Việc | Tiêu chí |
| --- | --- | --- |
| W11-TV6-01 | QA toàn diện, tách kết quả local/mock khỏi Cloud | AC01–AC10 |
| W11-TV6-02 | Dry-run backup-deploy cùng TV5 | NF07, NF12 |

## Tuần 12 (07/12–13/12)

Checkpoint: có bộ số liệu performance thật, release candidate sẵn sàng.

| Mã | Việc | Tiêu chí |
| --- | --- | --- |
| W12-TV6-01 | Tổng hợp kết quả load test và QA theo mẫu Phần IV mục 9 | NF03, NF04, NF05, NF06, NF11 |
| W12-TV6-02 | Tiếp tục sửa bug, xác nhận release candidate | AC01–AC10 |

## Tuần 13 (14/12–20/12)

Cả nhóm: dự phòng sửa bug, hoàn thiện báo cáo và ADR của module mình, chuẩn bị Architecture Defense (câu 6 về tải 5×/10×, câu 11 về chi phí). Phần của TV6: báo cáo Auth, Admin, notification và QA, ghi đúng người có commit và đúng môi trường.

## Mẫu ghi kết quả mỗi ca

| Case/version | Môi trường, source, revision | Fixture và actor | Expected / actual | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| | | | | PASS / FAIL / BLOCKED / NOT RUN | |
