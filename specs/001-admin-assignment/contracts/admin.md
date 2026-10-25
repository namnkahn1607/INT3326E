# Consumer contract — Admin week 3

Source: PF SPEC 01 API00/02/03/04/11, SC01–04/06 và TV6 DTO/code.
Base apiClient đã chứa /v1; các helper không thêm /v1 lần hai.

| Helper path | Request | Response |
| --- | --- | --- |
| GET /shipments | limit/cursor, optional status/trackingNumber exact | 200 {data: ShipmentResponse[], pagination} |
| GET /shipments/{id} | ID sh_ + ULID | 200 ShipmentDetail (kèm statusHistory) |
| GET /drivers | chỉ limit/cursor | 200 {data: DriverResponse[], pagination} |
| POST /shipments/{id}/assign | JSON chỉ {driverId: usr_ + ULID} | 200 ShipmentResponse |

Bearer do apiClient/session hiện có; không actor, token, role hoặc timestamp trong
body, không Create Idempotency-Key trên Assign. Assign response phải đúng shipment
và driver đích, status ASSIGNED. Cùng driver hiện hành là no-op phía server.

Lỗi: 400 validation, 401 phiên, 403 quyền, 404 resource/API chưa có,
409 state conflict hoặc USER_NOT_PROVISIONED, 5xx dependency. Dùng status/code,
không parse message làm nghiệp vụ. Không hiện diagnostic nội bộ từ server.
409 state/network/timeout/5xx/INVALID_RESPONSE cần đọc lại, không tự retry POST.
USER_NOT_PROVISIONED báo liên hệ quản trị viên; không gọi nó là conflict pickup.

Không thêm endpoint /shipments/unassigned, /admin/drivers hoặc PATCH enum.
