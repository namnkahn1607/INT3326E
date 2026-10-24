# Bàn giao sửa lỗi GPS sau merge

Ngày lập: 2026-10-20. Bản code đối chiếu: `9e3d65a` trên `develop`.

Đây là báo cáo rà soát hỗ trợ bàn giao, không phải đặc tả mới hay quyết định
thay đổi contract. Chưa sửa code, commit, push hoặc deploy trong lượt bàn giao này.

## 1. Nguồn đối chiếu

- [PF SPEC 01 v1.3](https://docs.google.com/document/d/1S9gY8a08d8-9Rd4bhTOeT_IAJUrYtFnZtDKjKKEpuq8/edit?tab=t.po4rmhqkefw):
  VI.API00, VI.EVT01, VII.3 và VII.4; đã đọc trực tiếp trong lượt rà soát trước.
- Code, Git diff giữa các nhánh, Git blame và các kết quả chạy local bên dưới.
- `docs/gps-event-contract.md`, `docs/api-contract.md` và `docs/openapi.json`
  còn nội dung contract cũ; không dùng chúng để phủ định đặc tả mới.

## 2. Tóm tắt dễ hiểu để gửi nhóm

Sau merge, phần GPS đang trộn hai phiên bản nên web không build được.
Nhờ TV4 sửa emitter, TV2 phối hợp thống nhất dữ liệu GPS dùng chung và TV1
đồng bộ DTO/OpenAPI. Người tích hợp chạy lại lint/build/test trước khi merge.
Đây không phải lỗi phần tạo đơn Customer của TV3 và chưa có căn cứ quy lỗi
cho Firebase hoặc cấu hình cloud.

## 3. Contract cần thống nhất theo đặc tả

Request `POST /v1/locations`:

```ts
interface LocationRequest {
  lat: number
  lng: number
  clientTimestamp: string
  sessionId?: string
  seq?: number
}
```

- `lat`, `lng`: số hữu hạn, lần lượt trong [-90, 90] và [-180, 180].
- `clientTimestamp`: chuỗi ISO 8601 có timezone. API chuẩn hóa UTC chính xác
  mili giây trước hash/dedupe/publish; cắt phần nhỏ hơn mili giây, không làm tròn.
  Output dạng `YYYY-MM-DDTHH:mm:ss.SSSZ`. Retry giữ thời điểm đo của cùng mẫu.
- `sessionId`: UUID tùy chọn nếu emitter có tạo phiên; không dùng chuỗi
  `sess_<driverId>` thay cho UUID.
- `seq`: số nguyên từ 1 nếu có; tùy chọn, chỉ dùng chẩn đoán trong phiên.
- Không nhận `driverId` hoặc role từ body. API lấy tài xế từ danh tính đã xác thực,
  bổ sung `eventId` và `receivedAt` vào event nội bộ.
- Thứ tự và dedupe dựa trên timestamp theo EVT01, không dựa vào session/sequence.

## 4. TV4: sửa Driver/emitter

File: `apps/web/src/features/driver/GpsEmitter.tsx`.

| Lỗi hiện tại | Yêu cầu sửa | Cách kiểm chứng |
| --- | --- | --- |
| Import `MAX_GPS_SEQUENCE`, `GpsLocationRequest` nhưng package không export | Phối hợp đầu mối shared types để thống nhất exports và cách dùng; bỏ import không dùng | Frontend build và lint đạt |
| Payload dùng `latitude/longitude`, timestamp số `Date.now()` | Dùng request chuẩn `lat/lng`, timestamp ISO có timezone; nếu giữ dữ liệu nội bộ khác tên thì phải có mapper rõ ràng | Test payload đúng tên/kiểu field |
| Payload mẫu có `driverId`, session mặc định `sess_<driverId>` | Không chuyển nguyên payload này thành request API; định danh mẫu có thể hiển thị riêng. Session nếu gửi phải là UUID, hoặc bỏ khi không dùng | Test request không có actor tự khai báo, session đúng quy tắc |
| Tăng `currentSeq`, nhưng kiểm tra dừng bằng `sequence.current` luôn bằng 0 | Dùng một nguồn đếm nhất quán; không để bộ đếm vượt giới hạn triển khai | Test sequence, Stop/Start và biên giới hạn |
| Effect đọc `eventCount` nhưng thiếu dependency | Sửa cách quản lý state/ref và timer; không chỉ tắt cảnh báo, tránh reset timer sau mỗi mẫu | Lint đạt; test mỗi 8 giây, rerender và cleanup |

Giữ hành vi hiện có: khởi tạo dừng, không phát ngay khi bấm Start, mẫu đầu sau
8 giây, Stop không phát thêm, Start lại tiếp tục đếm và unmount hủy timer.
Emitter hiện là bản mẫu chưa gọi REST; chưa được kết luận có lỗi gửi GPS thật.

## 5. TV2 phối hợp TV4/TV1: thống nhất contract GPS dùng chung

Files:

- `packages/types/src/index.ts`
- `packages/types/src/gps.ts`
- `packages/types/src/gps.spec.ts`
- `docs/gps-event-contract.md` và phần GPS của tài liệu contract liên quan.

Các vấn đề:

1. `index.ts` và `gps.ts` đang mô tả hai schema khác nhau. Chọn một định nghĩa
   thống nhất theo mục 3 và export nhất quán cho consumer.
2. `index.ts` không còn các export mà emitter đang dùng. Không chỉ thêm export
   để hết lỗi build rồi giữ nguyên hai schema mâu thuẫn.
3. `gps.ts` bắt buộc `seq`, cấm `sessionId`, chưa đúng đặc tả mới.
4. Validator request chỉ nhận timestamp UTC đúng định dạng mili giây. Cần phân biệt
   request ISO có timezone với event đã chuẩn hóa; không bắt mọi đầu vào có cùng
   hình thức với output canonical.
5. Cập nhật tests và tài liệu cũ cho nhất quán. Các test đang xác nhận contract cũ
   không phải bằng chứng contract đó đúng với PF SPEC 01 v1.3.

TV2 phụ trách schema GPS và phối hợp TV4 chốt event; TV1 phối hợp phần API/data
contract. Không yêu cầu triển khai thêm Worker persistence hoặc cloud trong lượt sửa này.

## 6. TV1: đồng bộ DTO/API và OpenAPI

Files:

- `apps/api/src/modules/location/dto/ingest-location.dto.ts`
- `docs/openapi.json`

DTO hiện bắt buộc `driverId`, `latitude`, `longitude`, timestamp số. Cần đổi theo
request chuẩn, validation miền tọa độ, timestamp và metadata tùy chọn. Khi nối
endpoint, backend lấy `driverId` từ danh tính đã xác thực, không tin body.

OpenAPI hiện dùng `lat/lng` nhưng vẫn bắt buộc `seq`, không cho `sessionId`;
cần đồng bộ cùng shared types/DTO/tests, không cập nhật riêng một phía.
Publisher/controller ingest thuộc kế hoạch tuần 3; việc sửa contract không tự
mở rộng thành yêu cầu hoàn thiện toàn bộ pipeline ngay trong tuần 2.

## 7. Lịch sử thay đổi và trách nhiệm tích hợp

| Commit | Tài khoản tác giả | Thay đổi liên quan |
| --- | --- | --- |
| `8d2872a` | `AkaLissandra` | Nhánh contract cũ: exports từ `gps.ts`, emitter dùng `lat/lng`, timestamp ISO; contract này cũng còn lệch đặc tả mới ở metadata/timestamp validation |
| `b0f1a19` | `LeNa11-mia` | Đổi emitter/shared types sang `latitude/longitude`, timestamp số; thêm DTO cùng dạng |
| `9240eb3` | `datdooo` | Merge hai nhánh: giữ import/ref từ một phía và payload/bộ đếm phía kia; index kết quả không còn exports emitter cần |
| `9e3d65a` | `Dinh Tuan` | Nhận bản tích hợp trên vào develop local |
| `dfebc12` | `Dinh Tuan` | Thay đổi Photon/Customer, không sửa GPS |

Đây là truy vết kỹ thuật, không phải kết luận lỗi cá nhân. Tài khoản Git không tự
chứng minh số thành viên; phân công xử lý dựa trên VII.3/VII.4. Người tích hợp cần
phối hợp TV4/TV2/TV1 kiểm tra kết quả merge, không chỉ dựa vào việc Git báo merge thành công.

## 8. Kiểm chứng và tiêu chí bàn giao

Kết quả local ở lượt kiểm tra code trước khi lập file này, tại `9e3d65a`:

| Kiểm tra | Kết quả |
| --- | --- |
| Frontend build | Không đạt: TS2305 thiếu hai export, TS6133 import không dùng |
| Frontend lint | Không đạt: import không dùng; thêm cảnh báo dependency `eventCount` |
| Frontend tests | 176 test / 17 file đạt; chưa bắt được lỗi tích hợp GPS này |
| Root tests GPS/shared/smoke | 59 test / 3 file đạt; chưa chứng minh schema khớp đặc tả mới |
| GPS đầu-cuối/cloud | Chưa kiểm chứng trong lượt này |

Lệnh chạy lại từ thư mục gốc sau khi sửa:

```powershell
npm run lint:web
npm run build:web
npm run test --workspace=@parcelflow/web
npm test
```

Nếu sửa backend/shared consumer, chạy thêm trong `apps/api` theo scripts hiện có:

```powershell
npm run typecheck
npm test
npm run build
```

Chỉ bàn giao bản sửa khi lint/build đạt, test mới kiểm tra exports và schema
thống nhất, các ca Start/Stop/restart/unmount đạt. Test không được chỉ import
trực tiếp `gps.ts` rồi bỏ qua public exports mà frontend sử dụng. Kiểm chứng
mock/local phải ghi rõ, không diễn giải thành GPS đã chạy thật trên cloud.
