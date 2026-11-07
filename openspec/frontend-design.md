# Thiết Kế Kiến Trúc (Design) — ParcelFlow Frontend

## 1. Kiến trúc hệ thống
```text
Customer / Admin / Driver (React SPA)
            │ REST
            ▼
Google Cloud Run (NestJS Modular Monolith)
     │ Sync CRUD                  │ Async Publish
     ▼                            ▼
Cloud SQL (PostgreSQL)      Cloud Pub/Sub (Topic: gps-events)
     ▲                            │ Subscribe
     │ Update current_location    ▼
     └───────────────────── GPS Worker (Cloud Run)
```
- Frontend chỉ giao tiếp qua REST API (không truy cập trực tiếp DB hay Pub/Sub).
- Customer tracking polling vị trí tài xế mỗi 5–10 giây từ REST API.

---

## 2. Cấu trúc thư mục (`frontend/src/`)
```text
src/
├── types/                # Types dùng chung (shipment.ts)
├── components/common/    # UI dùng chung (Navigation, StatusBadge, StatCard)
├── layouts/              # CustomerLayout, AdminLayout, DriverLayout
├── pages/
│   ├── customer/         # 5 trang Customer (Thành viên 3)
│   ├── admin/            # 5 trang Admin (Thành viên 3)
│   ├── driver/           # Khung trang Driver (Thành viên 4)
│   └── common/           # NotFoundPage
├── App.tsx               # Khai báo React Router
├── main.tsx              # Root React & BrowserRouter
└── index.css             # Theme, design tokens, responsive
```

---

## 3. Quy chuẩn giao diện (Design Tokens)

### Tông màu theo vai trò
- **Customer**: Blue (`#2563eb`, `#eff6ff`) — thân thiện, tin cậy.
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
File `frontend/firebase.json` cấu hình rewrite SPA để hỗ trợ HTML5 History API:
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```
Project ID mặc định đặt tại `frontend/.firebaserc`: `int3326e`.
