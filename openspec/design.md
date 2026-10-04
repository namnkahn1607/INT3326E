# Thiết Kế Kiến Trúc & Giao Diện (Design) — Frontend ParcelFlow

## 1. Kiến trúc tổng thể hệ thống (System Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                    ParcelFlow Frontend                      │
│             React 19 + TypeScript + Vite 8                  │
│                                                             │
│   ┌────────────────────┐ ┌───────────────────┐ ┌─────────┐ │
│   │  Customer Portal   │ │   Admin Portal    │ │ Driver  │ │
│   │  (/customer)       │ │   (/admin)        │ │ (/driver│ │
│   │  (Tuấn phụ trách)  │ │   (Tuấn phụ trách)│ │ (TV 4)  │ │
│   └─────────┬──────────┘ └─────────┬─────────┘ └────┬────┘ │
└─────────────┼──────────────────────┼────────────────┼───────┘
              │ REST (Polling 5-10s) │ REST           │ REST / POST /location (8s)
              ▼                      ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Google Cloud Run                         │
│             NestJS Modular Monolith Backend                 │
│      (Shipment, Assign, Notification, Administration)       │
└───────────────────────┬─────────────────────────────┬───────┘
                        │ Sync CRUD                   │ Async Publish
                        ▼                             ▼
┌────────────────────────────────┐   ┌────────────────────────┐
│     Google Cloud SQL           │   │ Google Cloud Pub/Sub   │
│        PostgreSQL              │   │   Topic: gps-events    │
│ (current_location, shipments)  │   └────────────┬───────────┘
└───────────────▲────────────────┘                │ Subscribe
                │ Update location                 ▼
                └───────────────────────┌─────────────────────┐
                                        │     GPS Worker      │
                                        │  Cloud Run Service  │
                                        └─────────────────────┘
```

- **Frontend**: Hoàn toàn giao tiếp với Backend qua REST API tiêu chuẩn, không truy cập trực tiếp vào DB PostgreSQL hay Cloud Pub/Sub.
- **Tracking**: Phía khách hàng sử dụng cơ chế REST polling (định kỳ mỗi 5–10 giây) để đọc dữ liệu vị trí tài xế mới nhất từ bảng `current_location`.

---

## 2. Thiết kế cấu trúc thư mục Frontend (`frontend/src/`)

```text
src/
├── types/
│   └── shipment.ts             # Định nghĩa kiểu dữ liệu Shipment & ShipmentStatus
├── components/
│   └── common/
│       ├── Navigation.tsx      # Thanh điều hướng dùng chung, hỗ trợ badge số lượng
│       ├── StatusBadge.tsx     # Nhãn màu trực quan cho 5 trạng thái đơn hàng
│       └── StatCard.tsx        # Thẻ hiển thị chỉ số đo lường KPI
├── layouts/
│   ├── CustomerLayout.tsx      # Header ngang màu xanh dương, thanh menu điều hướng
│   ├── AdminLayout.tsx         # Sidebar tối màu chuyên nghiệp (#0f172a), Topbar giám sát
│   └── DriverLayout.tsx        # Khung tối thiểu chuẩn bị cho Thành viên 4
├── pages/
│   ├── common/
│   │   └── NotFoundPage.tsx    # Trang 404 thân thiện
│   ├── customer/               # CÁC TRANG CỦA TUẤN (KHÁCH HÀNG)
│   │   ├── CustomerOverviewPage.tsx
│   │   ├── CustomerCreatePage.tsx
│   │   ├── CustomerShipmentsPage.tsx
│   │   ├── CustomerHistoryPage.tsx
│   │   └── CustomerNotificationsPage.tsx
│   ├── admin/                  # CÁC TRANG CỦA TUẤN (ADMIN & DISPATCHER)
│   │   ├── AdminOverviewPage.tsx
│   │   ├── AdminShipmentsPage.tsx
│   │   ├── AdminAssignmentPage.tsx
│   │   ├── AdminDriversPage.tsx
│   │   └── AdminAccountsPage.tsx
│   └── driver/                 # CÁC TRANG CỦA THÀNH VIÊN 4
│       └── DriverPlaceholderPage.tsx
├── App.tsx                     # Định nghĩa React Router (Nested Routes & Outlets)
├── main.tsx                    # Khởi tạo React 19 root & BrowserRouter
└── index.css                   # Thiết kế giao diện, Design tokens, Responsive
```

---

## 3. Hệ thống nhận diện & Thiết kế UI (Design Tokens)

### 3.1. Màu sắc theo vai trò
- **Customer Theme**: Tông xanh dương (`#2563eb`, `#1d4ed8`, `#eff6ff`) mang cảm giác tin cậy, dịch vụ hiện đại.
- **Admin Theme**: Tông Slate tối màu (`#0f172a`, `#1e293b`) kết hợp Indigo (`#4f46e5`) phục vụ điều hành và phân tích số liệu.
- **Driver Theme**: Tông xanh lá (`#15803d`, `#dcfce7`) biểu thị tính sẵn sàng vận hành.

### 3.2. Màu sắc chuẩn cho 5 trạng thái đơn hàng (Status Badge)
| Trạng thái | Mã màu chữ | Mã màu nền | Ý nghĩa |
| :--- | :--- | :--- | :--- |
| **CREATED** | `#1d4ed8` | `#eff6ff` | Mới tạo, chờ gán xe |
| **ASSIGNED** | `#b45309` | `#fef3c7` | Đã gán tài xế |
| **PICKED_UP** | `#4338ca` | `#e0e7ff` | Đang trên đường giao |
| **DELIVERED** | `#15803d` | `#dcfce7` | Hoàn thành giao |
| **DELIVERY_FAILED** | `#b91c1c` | `#fee2e2` | Giao thất bại |

---

## 4. Thiết kế Triển khai Hosting (Firebase Hosting SPA)

- **Cấu hình `frontend/firebase.json`**:
  ```json
  {
    "hosting": {
      "public": "dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ]
    }
  }
  ```
- **Cơ chế**: Do sử dụng `BrowserRouter` với HTML5 History API, việc cấu hình rewrite tất cả các route tĩnh (`**`) về `index.html` ngăn chặn hoàn toàn lỗi HTTP 404 khi người dùng refresh hoặc truy cập URL trực tiếp trên trình duyệt.
- **Project ID**: Được quản lý qua `frontend/.firebaserc` trỏ về dự án `int3326e`.
