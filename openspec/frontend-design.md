# Thiết Kế Kiến Trúc (Design) — ParcelFlow Frontend

## 1. Kiến trúc hệ thống

Theo [PF SPEC 01 nội dung v1.3](../docs/spec-baseline.md), V/VI. Tài liệu này mô tả
kiến trúc đích, không chứng minh pipeline đã chạy. Tuần 1 giữ scaffold và Hosting;
phần nghiệm thu cụ thể nằm ở [week1-reacceptance](week1-reacceptance/plan.md).
```text
Customer / Admin / Driver (React SPA)
            │ REST
            ▼
Google Cloud Run (NestJS Modular Monolith)
     │ Sync CRUD                  │ Async Publish
     ▼                            ▼
Cloud SQL (PostgreSQL)      Cloud Pub/Sub (topic hiện có)
     ▲                            │ Subscribe
     │ Update current_location    ▼
     └───────────────────── GPS Worker (Cloud Run)
```
- Frontend chỉ giao tiếp qua REST API (không truy cập trực tiếp DB hay Pub/Sub).
- Customer tracking polling vị trí tài xế mỗi 5–10 giây từ REST API.

---

## 2. Cấu trúc thư mục (`apps/web/src/`)
```text
src/
├── types/                # Types dùng chung (shipment.ts)
├── components/
│   ├── ui/               # Navigation, StatusBadge, StatCard, NotFoundPage
│   └── map/              # Leaflet/OpenStreetMap
├── layouts/              # CustomerLayout, AdminLayout, DriverLayout
├── features/
│   ├── customer/         # 5 trang Customer (Thành viên 3)
│   ├── admin/            # Các trang Admin/điều phối (Thành viên 3)
│   └── driver/           # Khung trang Driver (Thành viên 4)
├── App.tsx               # Khai báo React Router
├── main.tsx              # Root React & BrowserRouter
└── index.css             # Theme, design tokens, responsive
```

---

## 3. Quy chuẩn giao diện (Design Tokens)

### Tông màu theo vai trò
- **Customer**: Tím (`#7c3aed`, `#f5f3ff`) — giữ theme hiện có.
- **Admin**: Slate/Dark (`#0f172a`, `#1e293b`) — chuyên nghiệp, giám sát.
- **Driver**: Green (`#15803d`, `#dcfce7`) — vận hành, di động.

### Bảng màu trạng thái đơn hàng (StatusBadge)
| Trạng thái | Màu chữ | Màu nền |
| :--- | :--- | :--- |
| **CREATED** | `#1d4ed8` | `#eff6ff` |
| **ASSIGNED** | `#b45309` | `#fef3c7` |
| **PICKED_UP** | `#4338ca` | `#e0e7ff` |
| **DELIVERED** | `#15803d` | `#dcfce7` |
| **DELIVERY_FAILED** | `#b91c1c` | `#fee2e2` |

---

## 4. Cấu hình Firebase Hosting
File `apps/web/firebase.json` cấu hình rewrite SPA để hỗ trợ HTML5 History API:
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```
Project ID mặc định đặt tại `apps/web/.firebaserc`: `int3326e`.

## 5. Hợp đồng tích hợp từ tuần 2

Theo VI.API00/SC01–08: JSON `trackingNumber/customerId/dropoff*`, list `data/pagination`,
prefixed ULID; API client/mapper không dùng UI type cũ như wire schema mặc định.
Auth lấy Firebase custom claim và business user linkage; không role picker production.
Create giữ Idempotency-Key, xử lý ProblemDetails theo HTTP status/code và hiển thị trackingNumber.
GPS đích là `POST /v1/locations`, broker-confirmed 202; Worker pull persist rồi ACK.
Không nối hoặc đo NFR của các luồng này để nghiệm thu tuần 1.
