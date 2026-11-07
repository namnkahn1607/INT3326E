# Customer home — visual handoff

Nguồn: prompt JSON trực tiếp của Tuấn, 2026-10-18. Thay home cũ theo phong cách
minimal/premium, không sao chép ứng dụng. Chỉ trang /customer: cam ấm solid,
trắng/cream, Satoshi/Inter, radius16–24px, container1200px, hai cột desktop,
quick actions4 cột desktop/2 cột mobile. Các trang khác giữ màu/layout trước đó.
Đây là override màu Home được người dùng yêu cầu, không đổi constitution/API nghiệp vụ.

## Ranh giới dữ liệu

Greeting lấy tên tài khoản hiện tại. Không hardcode Tega/mã TRK mẫu. Active card
dùng API02, chọn bản ghi active trong 20 đơn gần nhất, ghi rõ scope và không GPS live.
Năm state backend không đổi; timeline bốn bước tổng quan bỏ riêng nhánh thất bại
vì card chỉ chọn active, không thêm Out-for-delivery. Error/empty có link thật.
Search giữ trackingNumber vào URL/list/filter exact theo contract đã có.
Schedule/Locations/Profile không có API/route mới; controls disabled có lý do.
More chỉ dẫn History/Notifications hiện có, không coi chúng là inbox đã tích hợp.

## Asset và font

- Built-in imagegen: PNG nguồn tại apps/web/src/assets/delivery-parcels.png;
  bản WebP apps/web/src/assets/delivery-parcels.webp giữ kích thước1536×1024/alpha
  và dùng trong UI. Không đổi hero.png cũ. WebP là export định dạng từ cùng ảnh,
  không tạo asset mới bằng dependency hoặc gọi API bên ngoài.
- Final prompt (built-in imagegen, nguyên văn):

```text
Use case: stylized-concept. Asset type: transparent promotional illustration for a premium delivery web dashboard. Create two beautifully rendered realistic 3D cardboard delivery boxes, one large grounded rectangular shipping box and a smaller upright box slightly behind it, warm natural kraft paper with vivid warm orange packing tape. A single small orange 3D location pin floats above/right, with one subtle dotted route curling around the boxes. Front three-quarter view, gentle isometric perspective, centered compact composition with generous transparent margins. Soft bright studio lighting, believable cardboard texture, refined soft contact shadows, understated premium fintech aesthetic. Palette only kraft tan, warm orange, cream and soft charcoal details. No text, letters, shipping labels, numbers, logos, watermarks, people, background, floor plane, gradients, UI or buttons. Genuine transparent background. This will sit to the right of banner copy on a solid warm cream web panel; show only the illustration.
```

- Satoshi via api.fontshare.com, Inter via fonts.googleapis.com. Font-display swap,
  system fallback nếu mạng/font provider lỗi; không coi font CDN là dependency API nghiệp vụ.
- ui-ux-pro-max search đầu lệch liquid-glass nên bỏ; retry minimalism phù hợp,
  chỉ áp hierarchy/whitespace, không gợi ý blue/gold vì prompt đã chốt orange.
- Không thêm motion: keyboard/action tần suất cao tức thời; reduced-motion scoped.

## Kiểm chứng

85 tests/9 files và lint/build pass ở lượt Home đầu; browser local/mock đạt 5 route
× 4 viewport, gồm route refresh, search URL và regression Create/retry. Đã xem ảnh
Home desktop1440/mobile390; tăng input từ15→16px sau lần browser phát hiện.
PNG corner alpha0 được kiểm tra; UI dùng bản WebP nhỏ hơn (kích thước xem build log).
Cloud gate T016/T017 không đổi. Bản đẹp không chứng minh có tài khoản/API thật.
