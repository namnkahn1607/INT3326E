# Customer integration contract

Nguồn [baseline](../../../docs/spec-baseline.md), VI.API00–03/SC01–03.

- Base VITE_API_URL chứa /v1; token lấy session reader, không lưu bản sao riêng.
- POST /shipments: Bearer + Idempotency-Key UUIDv4, JSON Create theo data-model.
  Không senderName/senderPhone/customerId/role. 201 SC02; replay 24h giữ snapshot gốc.
- GET /shipments?limit=20[&status=ENUM][&cursor=opaque]: 200 SC01.
- GET /shipments/{sh_ULID}: 200 SC02 + statusHistory SC03; scope server kiểm tra.
- ProblemDetails: HTTP status/code quyết định hành vi; errors [{field,message}]
  chỉ gắn field biết; không đưa raw detail/stack/token vào UI.
- 400 sửa input; 401 login lại; 403 sai quyền; 409 USER_NOT_PROVISIONED liên hệ vận hành;
  IDEMPOTENCY_KEY_CONFLICT đối chiếu không tự đổi key. 429/5xx/network/timeout giữ intent.
  404 Create/list là backend chưa sẵn sàng, không giả success.
- GET abort khi đổi query/unmount. POST timeout/abort không chứng minh rollback.
  Timeout 15 giây là chi tiết client, không thay SLA server.
- /customer/shipments/:id là UI route dưới CUSTOMER, không API mới.

Provider TV1/6/5 xác nhận API/cloud; mock chỉ kiểm tra consumer.
