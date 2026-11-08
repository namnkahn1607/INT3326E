# Contract kiểm tra tuần 1

Nguồn: PF SPEC 01 VII.2, V.8 và VI.API00; contract nghiệp vụ từ tuần 2 chỉ tham chiếu
Google Doc, không định nghĩa lại REST/event trong hồ sơ này.

| Interface | Kết quả tuần 1 |
| --- | --- |
| `/customer`, `/admin`, `/driver` | Một SPA trên Hosting; mở trực tiếp/tải lại đúng trang; chưa bắt buộc login thật. |
| `/admin/accounts` | Scaffold đã có; không nghiệm thu CRUD hoặc cấp role. |
| Driver emitter | Mẫu cố định mỗi 8000 ms; driverId demo, lat/lng và clientTimestamp; không là API08/EVT01 production payload. |
| API `/healthz` hoặc `/healthz/` | 200 JSON `{"status":"ok","service":"api"}`, public ngoài `/v1`, không dependency check. |
| Worker `/healthz` hoặc `/healthz/` | 200 JSON `{"status":"ok"}`; không chứng minh consume/persist nghiệp vụ. |

Đường tích hợp đích là `POST /v1/locations`, không `/location`. Chưa yêu cầu handler
đó, Firebase login, Create persistence hoặc Driver→Admin tracking để nghiệm thu tuần 1.
